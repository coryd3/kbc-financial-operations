import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { like, inArray, eq, and } from "drizzle-orm";
import { db, pool } from "./db.ts";
import {
  users,
  donors,
  givingFunds,
  contributionBatches,
  monthlyCloses,
  monthlyCloseItems,
  ROLES,
  type Role,
} from "../shared/schema.ts";
import { registerFinanceRoutes } from "./finance.ts";
import { registerContributionRoutes } from "./contributions.ts";

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const raw = req.headers["x-test-user-id"];
    (req as any).session = raw ? { userId: Number(raw) } : {};
    next();
  });
  registerFinanceRoutes(app);
  registerContributionRoutes(app);
  return app;
}

const app = buildTestApp();
const PREFIX = "closetest_";
const TEST_YEAR = 2031;

const roleUserIds: Record<Role, number> = {} as Record<Role, number>;
let bookkeeperId: number;
let treasurerId: number;
let fundId: number;
let donorId: number;

const as = (userId: number) => ({ "x-test-user-id": String(userId) });

beforeAll(async () => {
  await cleanup();
  const inserted = await db
    .insert(users)
    .values(
      ROLES.map((role) => ({
        username: `${PREFIX}${role}`,
        passwordHash: "x",
        fullName: `Test ${role}`,
        role,
        status: "active" as const,
      })),
    )
    .returning({ id: users.id, username: users.username });
  const byName = Object.fromEntries(inserted.map((u) => [u.username, u.id]));
  for (const role of ROLES) roleUserIds[role] = byName[`${PREFIX}${role}`];
  bookkeeperId = roleUserIds["bookkeeper"];
  treasurerId = roleUserIds["treasurer"];

  const [fund] = await db
    .insert(givingFunds)
    .values({ name: `${PREFIX}General`, sortOrder: 0 })
    .returning();
  fundId = fund.id;

  const donorRes = await request(app)
    .post("/api/giving/donors")
    .set(as(bookkeeperId))
    .send({ firstName: "Test", lastName: `${PREFIX}Donor` });
  expect(donorRes.status).toBe(201);
  donorId = donorRes.body.donor.id;
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

async function cleanup() {
  const closes = await db
    .select({ id: monthlyCloses.id })
    .from(monthlyCloses)
    .where(eq(monthlyCloses.year, TEST_YEAR));
  if (closes.length) {
    const ids = closes.map((c) => c.id);
    await db.delete(monthlyCloseItems).where(inArray(monthlyCloseItems.closeId, ids));
    await db.delete(monthlyCloses).where(inArray(monthlyCloses.id, ids));
  }
  const batches = await db
    .select({ id: contributionBatches.id })
    .from(contributionBatches)
    .where(like(contributionBatches.description, `${PREFIX}%`));
  if (batches.length) {
    await db.delete(contributionBatches).where(
      inArray(
        contributionBatches.id,
        batches.map((b) => b.id),
      ),
    );
  }
  await db.delete(donors).where(like(donors.lastName, `${PREFIX}%`));
  await db.delete(givingFunds).where(like(givingFunds.name, `${PREFIX}%`));
  await db.delete(users).where(like(users.username, `${PREFIX}%`));
}

async function createClose(month: number) {
  const res = await request(app)
    .post("/api/finance/closes")
    .set(as(treasurerId))
    .send({ year: TEST_YEAR, month });
  expect(res.status).toBe(201);
  return res.body.close as { id: number; items: { id: number }[] };
}

async function completeAllItems(close: { id: number; items: { id: number }[] }) {
  for (const item of close.items) {
    const res = await request(app)
      .patch(`/api/finance/closes/${close.id}/items/${item.id}`)
      .set(as(treasurerId))
      .send({ isDone: true });
    expect(res.status).toBe(200);
  }
}

async function createBatch(batchDate: string) {
  const res = await request(app)
    .post("/api/giving/batches")
    .set(as(bookkeeperId))
    .send({ batchDate, description: `${PREFIX}batch` });
  expect(res.status).toBe(201);
  return res.body.batch as { id: number };
}

async function addContribution(batchId: number, amountCents: number) {
  const res = await request(app)
    .post(`/api/giving/batches/${batchId}/contributions`)
    .set(as(bookkeeperId))
    .send({ donorId, fundId, amountCents, method: "cash" });
  expect(res.status).toBe(201);
}

describe("monthly close vs open contribution batches", () => {
  it("lists open batches for the close month in GET /api/finance/closes", async () => {
    const close = await createClose(1);
    const batch = await createBatch(`${TEST_YEAR}-01-12`);
    await addContribution(batch.id, 12500);
    // batch outside the month should not appear
    await createBatch(`${TEST_YEAR}-02-02`);

    const res = await request(app).get("/api/finance/closes").set(as(treasurerId));
    expect(res.status).toBe(200);
    const row = res.body.closes.find((c: any) => c.id === close.id);
    expect(row).toBeTruthy();
    expect(row.openBatches).toHaveLength(1);
    expect(row.openBatches[0]).toMatchObject({
      id: batch.id,
      batchDate: `${TEST_YEAR}-01-12`,
      totalCents: 12500,
      contributionCount: 1,
    });
  });

  it("blocks sign-off with 409 while open batches remain", async () => {
    const closes = await request(app).get("/api/finance/closes").set(as(treasurerId));
    const close = closes.body.closes.find(
      (c: any) => c.year === TEST_YEAR && c.month === 1,
    );
    await completeAllItems(close);

    const res = await request(app)
      .post(`/api/finance/closes/${close.id}/signoff`)
      .set(as(treasurerId))
      .send({ externalLedgerReference: "close-test-open" });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/still open/i);
    expect(res.body.openBatches).toHaveLength(1);
  });

  it("allows sign-off when open batches are acknowledged", async () => {
    const closes = await request(app).get("/api/finance/closes").set(as(treasurerId));
    const close = closes.body.closes.find(
      (c: any) => c.year === TEST_YEAR && c.month === 1,
    );
    const res = await request(app)
      .post(`/api/finance/closes/${close.id}/signoff`)
      .set(as(treasurerId))
      .send({
        acknowledgeOpenBatches: true,
        notes: "signed with open batch",
        externalLedgerReference: "close-test-acknowledged",
      });
    expect(res.status).toBe(200);
    expect(res.body.close.status).toBe("closed");
  });

  it("does not report open batches on a closed month", async () => {
    const res = await request(app).get("/api/finance/closes").set(as(treasurerId));
    const row = res.body.closes.find((c: any) => c.year === TEST_YEAR && c.month === 1);
    expect(row.status).toBe("closed");
    expect(row.openBatches).toHaveLength(0);
  });

  it("signs off cleanly once the month's batches are closed", async () => {
    const close = await createClose(3);
    const batch = await createBatch(`${TEST_YEAR}-03-08`);
    await addContribution(batch.id, 5000);
    const closeBatchRes = await request(app)
      .post(`/api/giving/batches/${batch.id}/close`)
      .set(as(treasurerId))
      .send({ externalLedgerReference: "close-test-batch" });
    expect(closeBatchRes.status).toBe(200);

    await completeAllItems(close);
    const res = await request(app)
      .post(`/api/finance/closes/${close.id}/signoff`)
      .set(as(treasurerId))
      .send({ externalLedgerReference: "close-test-clean" });
    expect(res.status).toBe(200);
    expect(res.body.close.status).toBe("closed");
  });
});
