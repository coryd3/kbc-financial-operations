import type { Express } from "express";
import fs from "node:fs";
import path from "node:path";
import { DOCS_NAV, DOCS_PAGES, findDocsPage, docsSectionFor } from "../shared/docsNav.ts";

// The app lives in app/, the markdown lives in <repo>/docs and snippet
// sources in <repo>/dist. Both dev (`cd app && npm run dev`) and production
// (`cd app && npm start`) run with app/ as cwd.
const REPO_ROOT = path.resolve(process.cwd(), "..");
const DOCS_ROOT = path.join(REPO_ROOT, "docs");

/** Resolve pymdownx-style snippet includes: --8<-- "dist/file.md" */
function resolveSnippets(markdown: string): string {
  return markdown.replace(/^--8<--\s+"([^"]+)"\s*$/gm, (_m, rel: string) => {
    // Snippets are only ever repo-relative markdown files; refuse anything else.
    if (!/^[\w./-]+\.md$/.test(rel) || rel.includes("..")) return "";
    const abs = path.join(REPO_ROOT, rel);
    if (!abs.startsWith(REPO_ROOT + path.sep)) return "";
    try {
      return fs.readFileSync(abs, "utf8");
    } catch {
      return "";
    }
  });
}

/**
 * Convert MkDocs admonitions into blockquotes react-markdown can render:
 *   !!! warning "Public Site Caution"
 *       Indented body text…
 * becomes
 *   > **Public Site Caution**
 *   >
 *   > Indented body text…
 */
function convertAdmonitions(markdown: string): string {
  const lines = markdown.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^!!!\s+(\w+)(?:\s+"([^"]*)")?\s*$/);
    if (!m) {
      out.push(lines[i]);
      continue;
    }
    const title = m[2] || m[1].charAt(0).toUpperCase() + m[1].slice(1);
    out.push(`> **${title}**`);
    out.push(">");
    i++;
    while (i < lines.length && (lines[i].startsWith("    ") || lines[i].trim() === "")) {
      if (lines[i].trim() === "" && !(i + 1 < lines.length && lines[i + 1].startsWith("    "))) {
        break;
      }
      out.push(lines[i].trim() === "" ? ">" : `> ${lines[i].slice(4)}`);
      i++;
    }
    i--;
  }
  return out.join("\n");
}

function loadPageMarkdown(file: string): string | null {
  const abs = path.join(DOCS_ROOT, file);
  if (!abs.startsWith(DOCS_ROOT + path.sep)) return null;
  try {
    const raw = fs.readFileSync(abs, "utf8");
    return convertAdmonitions(resolveSnippets(raw));
  } catch {
    return null;
  }
}

export function registerDocsRoutes(app: Express) {
  // Full page content. Slug is the markdown path without ".md".
  app.get(/^\/api\/docs\/page\/(.+)$/, (req, res) => {
    const slug = String((req.params as any)[0] ?? "");
    const pageRef = findDocsPage(slug);
    if (!pageRef) {
      return res.status(404).json({ message: "Documentation page not found" });
    }
    const markdown = loadPageMarkdown(pageRef.file);
    if (markdown === null) {
      return res.status(404).json({ message: "Documentation page not found" });
    }
    const idx = DOCS_PAGES.findIndex((p) => p.slug === slug);
    const prev = idx > 0 ? DOCS_PAGES[idx - 1] : null;
    const next = idx >= 0 && idx < DOCS_PAGES.length - 1 ? DOCS_PAGES[idx + 1] : null;
    res.json({
      slug: pageRef.slug,
      title: pageRef.title,
      section: docsSectionFor(slug)?.title ?? null,
      markdown,
      prev: prev ? { slug: prev.slug, title: prev.title } : null,
      next: next ? { slug: next.slug, title: next.title } : null,
    });
  });

  // Simple full-text search across all pages.
  app.get("/api/docs/search", (req, res) => {
    const q = String(req.query.q ?? "").trim();
    if (q.length < 2) return res.json({ results: [] });
    const needle = q.toLowerCase();
    const results: {
      slug: string;
      title: string;
      section: string | null;
      snippets: string[];
    }[] = [];
    for (const pageRef of DOCS_PAGES) {
      const markdown = loadPageMarkdown(pageRef.file);
      if (markdown === null) continue;
      const titleHit = pageRef.title.toLowerCase().includes(needle);
      const snippets: string[] = [];
      for (const line of markdown.split("\n")) {
        if (snippets.length >= 3) break;
        if (line.toLowerCase().includes(needle)) {
          const clean = line
            .replace(/^#+\s*/, "")
            .replace(/[*_`>|]/g, "")
            .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
            .trim();
          if (clean) snippets.push(clean.length > 160 ? clean.slice(0, 157) + "…" : clean);
        }
      }
      if (titleHit || snippets.length > 0) {
        results.push({
          slug: pageRef.slug,
          title: pageRef.title,
          section: docsSectionFor(pageRef.slug)?.title ?? null,
          snippets,
        });
      }
      if (results.length >= 25) break;
    }
    res.json({ results });
  });
}

export const __docsInternals = { resolveSnippets, convertAdmonitions, loadPageMarkdown, DOCS_NAV };
