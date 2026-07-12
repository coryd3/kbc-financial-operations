import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { eq, like } from "drizzle-orm";
import { db, pool } from "./db.ts";
import { auditEvents, users } from "../shared/schema.ts";
import { __docsInternals, registerDocsRoutes } from "./docs.ts";

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const raw = req.headers["x-test-user-id"];
    (req as any).session = {
      ...(raw ? { userId: Number(raw) } : {}),
      cookie: {},
      destroy: (callback: () => void) => callback(),
    };
    next();
  });
  registerDocsRoutes(app);
  return app;
}

const app = buildTestApp();
const PREFIX = "docsfeedbacktest_";
const as = (userId: number) => ({ "x-test-user-id": String(userId) });
const page = __docsInternals.DOCS_PAGES[0];
let revision = "";
let feedbackSections: Array<{ id: string; title: string }> = [];
let memberId: number;
let adminId: number;

async function cleanup() {
  await db.delete(auditEvents).where(eq(auditEvents.entityType, "documentation_feedback"));
  await db.delete(users).where(like(users.username, `${PREFIX}%`));
}

beforeAll(async () => {
  await cleanup();
  const inserted = await db
    .insert(users)
    .values([
      { username: `${PREFIX}member`, passwordHash: "x", fullName: "Document Reviewer", role: "member", status: "active" },
      { username: `${PREFIX}admin`, passwordHash: "x", fullName: "Feedback Administrator", role: "admin", status: "active" },
    ])
    .returning({ id: users.id, username: users.username });
  memberId = inserted.find((user) => user.username.endsWith("member"))!.id;
  adminId = inserted.find((user) => user.username.endsWith("admin"))!.id;
  const response = await request(app).get(`/api/docs/page/${page.slug}`);
  expect(response.status).toBe(200);
  revision = response.body.revision;
  feedbackSections = response.body.feedbackSections;
  expect(feedbackSections.length).toBeGreaterThanOrEqual(2);
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

describe("section-aware documentation feedback", () => {
  it("publishes metadata and filters search results by intended audience", async () => {
    const nav = await request(app).get("/api/docs/nav");
    expect(nav.status).toBe(200);
    expect(nav.body.audiences).toContain("treasurer");
    const pages = nav.body.sections.flatMap((section: any) => section.pages);
    expect(pages.every((item: any) => item.metadata?.documentType && item.metadata?.audiences?.length)).toBe(true);
    const churchSearch = await request(app).get("/api/docs/search?q=Document%20Inventory&audience=congregation");
    expect(churchSearch.status).toBe(200);
    expect(churchSearch.body.results).toHaveLength(0);
    const projectSearch = await request(app).get("/api/docs/search?q=Document%20Inventory&audience=project");
    expect(projectSearch.body.results.some((item: any) => item.slug === "document-inventory")).toBe(true);
    const treasurerSearch = await request(app).get("/api/docs/search?q=Quick%20Start&audience=treasurer");
    expect(treasurerSearch.body.results.some((item: any) => item.slug === "start-here/treasurer-finance-chair-quick-start")).toBe(true);
    const churchQuickStart = await request(app).get("/api/docs/search?q=Quick%20Start&audience=congregation");
    expect(churchQuickStart.body.results).toHaveLength(0);
  });

  it("accepts separate comments for separate sections and prevents duplicates", async () => {
    const [firstSection, secondSection] = feedbackSections;
    const first = await request(app)
      .post("/api/docs/feedback")
      .set(as(memberId))
      .send({
        pageSlug: page.slug,
        documentationRevision: revision,
        sectionId: firstSection.id,
        sectionTitle: "Browser-supplied title is not trusted",
        helpful: true,
        category: "suggestion",
        comment: "Clarify who owns the next review.",
      });
    expect(first.status).toBe(201);

    const duplicate = await request(app)
      .post("/api/docs/feedback")
      .set(as(memberId))
      .send({
        pageSlug: page.slug,
        documentationRevision: revision,
        sectionId: firstSection.id,
        sectionTitle: firstSection.title,
        helpful: false,
        category: "unclear",
        comment: "A second comment on the same revision and section.",
      });
    expect(duplicate.status).toBe(409);

    const secondResponse = await request(app)
      .post("/api/docs/feedback")
      .set(as(memberId))
      .send({
        pageSlug: page.slug,
        documentationRevision: revision,
        sectionId: secondSection.id,
        sectionTitle: secondSection.title,
        helpful: true,
        category: "suggestion",
        comment: "Add a target date for this step.",
      });
    expect(secondResponse.status).toBe(201);
  });

  it("requires a written comment for section feedback", async () => {
    const response = await request(app)
      .post("/api/docs/feedback")
      .set(as(memberId))
      .send({
        pageSlug: page.slug,
        documentationRevision: revision,
        sectionId: feedbackSections[0].id,
        sectionTitle: feedbackSections[0].title,
        helpful: true,
        category: "suggestion",
        comment: "",
      });
    expect(response.status).toBe(400);
  });

  it("lets a reviewer see only their own comments with deep-link information", async () => {
    const response = await request(app).get("/api/docs/feedback/mine").set(as(memberId));
    expect(response.status).toBe(200);
    expect(response.body.feedback).toHaveLength(2);
    expect(response.body.feedback[0]).toMatchObject({
      pageTitle: page.title,
      sectionId: feedbackSections[1].id,
      sectionTitle: feedbackSections[1].title,
    });
  });

  it("allows an administrator to accept and export governed feedback", async () => {
    const list = await request(app).get("/api/admin/docs/feedback").set(as(adminId));
    expect(list.status).toBe(200);
    const target = list.body.feedback.find((item: any) => item.sectionId === feedbackSections[0].id);
    expect(target).toMatchObject({
      pageTitle: page.title,
      sectionTitle: feedbackSections[0].title,
      submittedBy: "Document Reviewer",
    });

    const accepted = await request(app)
      .patch(`/api/admin/docs/feedback/${target.id}`)
      .set(as(adminId))
      .send({ status: "accepted" });
    expect(accepted.status).toBe(200);
    expect(accepted.body.feedback.status).toBe("accepted");

    const exported = await request(app)
      .get("/api/admin/docs/feedback/export?status=accepted")
      .set(as(adminId));
    expect(exported.status).toBe(200);
    expect(exported.headers["content-type"]).toContain("text/markdown");
    expect(exported.text).toContain(feedbackSections[0].title);
    expect(exported.text).toContain(`/docs/${page.slug}#${feedbackSections[0].id}`);

    const memberExport = await request(app)
      .get("/api/admin/docs/feedback/export?status=accepted")
      .set(as(memberId));
    expect(memberExport.status).toBe(403);
  });
});
