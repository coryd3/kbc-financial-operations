import type { Express, Request } from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import GithubSlugger from "github-slugger";
import { and, count, desc, eq, gte } from "drizzle-orm";
import { db } from "./db.ts";
import { getSessionUser, requireAuth, requireCapability } from "./auth.ts";
import { recordAuditEvent } from "./audit.ts";
import {
  documentationFeedback,
  documentationFeedbackReviewSchema,
  documentationFeedbackSchema,
  users,
} from "../shared/schema.ts";
import type { DocsPageRef, DocsSection } from "../shared/docsNav.ts";

const isProduction = process.env.NODE_ENV === "production";
const contentRoot = isProduction
  ? path.resolve(import.meta.dirname, "content")
  : path.resolve(process.cwd(), "..");
const docsRoot = path.join(contentRoot, "docs");
const mkdocsPath = path.join(contentRoot, "mkdocs.yml");
const snippetRoot = isProduction ? path.join(contentRoot, "repo") : contentRoot;
const assetRoot = path.join(contentRoot, "assets");

function page(file: string, title: string): DocsPageRef {
  return { slug: file.replace(/\.md$/, ""), file, title };
}

function flattenPages(value: unknown): DocsPageRef[] {
  if (!Array.isArray(value)) return [];
  const pages: DocsPageRef[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    for (const [title, target] of Object.entries(item)) {
      if (typeof target === "string" && target.endsWith(".md")) pages.push(page(target, title));
      else pages.push(...flattenPages(target));
    }
  }
  return pages;
}

function loadNavigation(): DocsSection[] {
  const raw = fs.readFileSync(mkdocsPath, "utf8");
  const navOffset = raw.search(/^nav:\s*$/m);
  if (navOffset < 0) throw new Error("mkdocs.yml does not define navigation");
  const parsed = YAML.parse(raw.slice(navOffset)) as { nav?: unknown[] };
  return (parsed.nav ?? []).flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    return Object.entries(item).map(([title, value]) => ({ title, pages: flattenPages(value) }));
  });
}

const DOCS_NAV = loadNavigation();
const DOCS_PAGES = DOCS_NAV.flatMap((section) => section.pages);
const pagesBySlug = new Map(DOCS_PAGES.map((item) => [item.slug, item]));

function resolveSnippets(markdown: string): string {
  return markdown.replace(/^--8<--\s+"([^"]+)"\s*$/gm, (_match, relative: string) => {
    if (!/^[\w./-]+\.md$/.test(relative) || relative.includes("..")) return "";
    const absolute = path.resolve(snippetRoot, relative);
    if (!absolute.startsWith(snippetRoot + path.sep)) return "";
    try {
      return fs.readFileSync(absolute, "utf8");
    } catch {
      return "";
    }
  });
}

function convertAdmonitions(markdown: string): string {
  const lines = markdown.split("\n");
  const output: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^!!!\s+(\w+)(?:\s+"([^"]*)")?\s*$/);
    if (!match) {
      output.push(lines[index]);
      continue;
    }
    const title = match[2] || match[1].charAt(0).toUpperCase() + match[1].slice(1);
    output.push(`> **${title}**`, ">");
    index += 1;
    while (index < lines.length && (lines[index].startsWith("    ") || lines[index].trim() === "")) {
      if (lines[index].trim() === "" && !lines[index + 1]?.startsWith("    ")) break;
      output.push(lines[index].trim() === "" ? ">" : `> ${lines[index].slice(4)}`);
      index += 1;
    }
    index -= 1;
  }
  return output.join("\n");
}

function cleanMkDocsSyntax(markdown: string): string {
  return markdown
    .replace(/\(\.\.\/generated\/source-materials\/bylaws\/Constitution-Bylaws-and-Covenant-2018\.pdf\)/g,
      "(/api/docs/assets/constitution-bylaws-2018.pdf)")
    .replace(/\{\s*target="_blank"\s+rel="noopener"\s*\}/g, "");
}

type CachedPage = {
  markdown: string;
  revision: string;
  searchableLines: string[];
  feedbackSections: Map<string, string>;
};

function extractFeedbackSections(markdown: string): Map<string, string> {
  const slugger = new GithubSlugger();
  const sections = new Map<string, string>();
  for (const line of markdown.split("\n")) {
    const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!match) continue;
    const level = match[1].length;
    const title = match[2]
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/<[^>]+>/g, "")
      .replace(/[*_`~]/g, "")
      .trim();
    const id = slugger.slug(title);
    if (level >= 2 && level <= 4 && title) sections.set(id, title);
  }
  return sections;
}

const pageCache = new Map<string, CachedPage>();
for (const reference of DOCS_PAGES) {
  const absolute = path.resolve(docsRoot, reference.file);
  if (!absolute.startsWith(docsRoot + path.sep) || !fs.existsSync(absolute)) continue;
  const markdown = cleanMkDocsSyntax(convertAdmonitions(resolveSnippets(fs.readFileSync(absolute, "utf8"))));
  pageCache.set(reference.slug, {
    markdown,
    revision: crypto.createHash("sha256").update(markdown).digest("hex").slice(0, 12),
    searchableLines: markdown.split("\n"),
    feedbackSections: extractFeedbackSections(markdown),
  });
}

function sectionFor(slug: string): DocsSection | undefined {
  return DOCS_NAV.find((section) => section.pages.some((candidate) => candidate.slug === slug));
}

const reviewFeedback = requireCapability("documentation_feedback_review");

export function registerDocsRoutes(app: Express) {
  app.get("/api/docs/nav", (_req, res) => res.json({ sections: DOCS_NAV }));

  app.get(/^\/api\/docs\/page\/(.+)$/, (req, res) => {
    const slug = String((req.params as any)[0] ?? "");
    const reference = pagesBySlug.get(slug);
    const cached = pageCache.get(slug);
    if (!reference || !cached) return res.status(404).json({ message: "Documentation page not found" });
    const index = DOCS_PAGES.findIndex((candidate) => candidate.slug === slug);
    const prev = index > 0 ? DOCS_PAGES[index - 1] : null;
    const next = index < DOCS_PAGES.length - 1 ? DOCS_PAGES[index + 1] : null;
    res.json({
      slug,
      title: reference.title,
      section: sectionFor(slug)?.title ?? null,
      markdown: cached.markdown,
      revision: cached.revision,
      feedbackSections: [...cached.feedbackSections].map(([id, title]) => ({ id, title })),
      prev: prev ? { slug: prev.slug, title: prev.title } : null,
      next: next ? { slug: next.slug, title: next.title } : null,
    });
  });

  app.get("/api/docs/search", (req, res) => {
    const query = String(req.query.q ?? "").trim().toLowerCase();
    if (query.length < 2) return res.json({ results: [] });
    const results = DOCS_PAGES.flatMap((reference) => {
      const cached = pageCache.get(reference.slug);
      if (!cached) return [];
      const snippets = cached.searchableLines
        .filter((line) => line.toLowerCase().includes(query))
        .map((line) => line.replace(/^#+\s*/, "").replace(/[*_`>|]/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").trim())
        .filter(Boolean)
        .slice(0, 3)
        .map((line) => (line.length > 160 ? `${line.slice(0, 157)}...` : line));
      if (!reference.title.toLowerCase().includes(query) && !snippets.length) return [];
      return [{ slug: reference.slug, title: reference.title, section: sectionFor(reference.slug)?.title ?? null, snippets }];
    }).slice(0, 25);
    res.json({ results });
  });

  app.get("/api/docs/assets/constitution-bylaws-2018.pdf", (_req, res) => {
    const file = path.join(assetRoot, "constitution-bylaws-2018.pdf");
    if (!fs.existsSync(file)) return res.status(404).json({ message: "Document asset not found" });
    res.set({ "Content-Type": "application/pdf", "Content-Disposition": "inline" });
    res.sendFile(file);
  });

  app.post("/api/docs/feedback", requireAuth, async (req, res) => {
    const parsed = documentationFeedbackSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid feedback" });
    const current = pageCache.get(parsed.data.pageSlug);
    if (!current || current.revision !== parsed.data.documentationRevision) {
      return res.status(409).json({ message: "This page changed. Refresh it before submitting feedback." });
    }
    const canonicalSectionTitle = parsed.data.sectionId
      ? current.feedbackSections.get(parsed.data.sectionId)
      : null;
    if (parsed.data.sectionId && !canonicalSectionTitle) {
      return res.status(400).json({ message: "That document section does not exist in this page version." });
    }
    const user = (req as any).user as { id: number };
    const since = new Date(Date.now() - 24 * 60 * 60_000);
    const [daily] = await db
      .select({ value: count() })
      .from(documentationFeedback)
      .where(and(eq(documentationFeedback.userId, user.id), gte(documentationFeedback.createdAt, since)));
    if ((daily?.value ?? 0) >= 10) {
      return res.status(429).json({ message: "You have reached the daily feedback limit." });
    }
    try {
      const [created] = await db
        .insert(documentationFeedback)
        .values({
          ...parsed.data,
          comment: parsed.data.comment || null,
          sectionTitle: canonicalSectionTitle,
          userId: user.id,
        })
        .returning();
      await recordAuditEvent(req, "docs.feedback_created", {
        entityType: "documentation_feedback",
        entityId: created.id,
        details: { pageSlug: created.pageSlug },
      });
      res.status(201).json({ feedback: created });
    } catch (error: any) {
      if (error?.code === "23505") {
        return res.status(409).json({ message: "You already submitted feedback for this section of this page version." });
      }
      throw error;
    }
  });

  app.get("/api/docs/feedback/mine", requireAuth, async (req, res) => {
    const user = (req as any).user as { id: number };
    const rows = await db
      .select()
      .from(documentationFeedback)
      .where(eq(documentationFeedback.userId, user.id))
      .orderBy(desc(documentationFeedback.createdAt));
    res.json({
      feedback: rows.map((item) => ({
        ...item,
        pageTitle: pagesBySlug.get(item.pageSlug)?.title ?? item.pageSlug,
      })),
    });
  });

  app.get("/api/admin/docs/feedback", reviewFeedback, async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const rows = await db
      .select({
        feedback: documentationFeedback,
        submittedBy: users.fullName,
      })
      .from(documentationFeedback)
      .innerJoin(users, eq(users.id, documentationFeedback.userId))
      .where(status ? eq(documentationFeedback.status, status as any) : undefined)
      .orderBy(desc(documentationFeedback.createdAt));
    res.json({
      feedback: rows.map((row) => ({
        ...row.feedback,
        pageTitle: pagesBySlug.get(row.feedback.pageSlug)?.title ?? row.feedback.pageSlug,
        submittedBy: row.submittedBy,
      })),
    });
  });

  app.get("/api/admin/docs/feedback/new-count", reviewFeedback, async (_req, res) => {
    const [row] = await db
      .select({ value: count() })
      .from(documentationFeedback)
      .where(eq(documentationFeedback.status, "new"));
    res.json({ newFeedbackCount: row?.value ?? 0 });
  });

  app.get("/api/admin/docs/feedback/export", reviewFeedback, async (req, res) => {
    const requestedStatus = typeof req.query.status === "string" ? req.query.status : "accepted";
    if (!["accepted", "planned", "resolved"].includes(requestedStatus)) {
      return res.status(400).json({ message: "Export status must be accepted, planned, or resolved" });
    }
    const rows = await db
      .select({ feedback: documentationFeedback, submittedBy: users.fullName })
      .from(documentationFeedback)
      .innerJoin(users, eq(users.id, documentationFeedback.userId))
      .where(eq(documentationFeedback.status, requestedStatus as any))
      .orderBy(documentationFeedback.pageSlug, documentationFeedback.sectionTitle, documentationFeedback.createdAt);
    const lines = [
      "# KBC Documentation Feedback Export",
      "",
      `Status: ${requestedStatus}`,
      `Generated: ${new Date().toISOString()}`,
      "",
      "Use these comments as review input. Verify every proposed change against the source document, committee authority, and KBC governance requirements.",
      "",
    ];
    for (const row of rows) {
      const item = row.feedback;
      const pageTitle = pagesBySlug.get(item.pageSlug)?.title ?? item.pageSlug;
      const sectionLabel = item.sectionTitle || "Whole page";
      const anchor = item.sectionId ? `#${item.sectionId}` : "";
      lines.push(
        `## ${pageTitle}: ${sectionLabel}`,
        "",
        `- Source: /docs/${item.pageSlug}${anchor}`,
        `- Revision: ${item.documentationRevision}`,
        `- Category: ${item.category}`,
        `- Submitted by: ${row.submittedBy}`,
        "",
        item.comment?.trim() || "No written comment was provided.",
        "",
        "---",
        "",
      );
    }
    res.set({
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="documentation-feedback-${requestedStatus}.md"`,
    });
    res.send(lines.join("\n"));
  });

  app.patch("/api/admin/docs/feedback/:id", reviewFeedback, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid feedback id" });
    const parsed = documentationFeedbackReviewSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid feedback status" });
    const user = (req as any).user as { id: number };
    const now = new Date();
    const [updated] = await db
      .update(documentationFeedback)
      .set({
        status: parsed.data.status,
        reviewerId: user.id,
        reviewedAt: now,
        resolvedAt: ["resolved", "declined"].includes(parsed.data.status) ? now : null,
      })
      .where(eq(documentationFeedback.id, id))
      .returning();
    if (!updated) return res.status(404).json({ message: "Feedback not found" });
    await recordAuditEvent(req, "docs.feedback_reviewed", {
      entityType: "documentation_feedback",
      entityId: id,
      details: { status: parsed.data.status },
    });
    res.json({ feedback: updated });
  });
}

export const __docsInternals = { resolveSnippets, convertAdmonitions, extractFeedbackSections, DOCS_NAV, DOCS_PAGES };
