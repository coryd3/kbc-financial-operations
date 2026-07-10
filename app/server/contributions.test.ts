import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { like, inArray, eq } from "drizzle-orm";
import { db, pool } from "./db.ts";
import {
  users,
  donors,
  givingFunds,
  contributionBatches,
  offeringCounts,
  GIVING_ROLES,
  FUND_REPORT_ROLES,
  ROLES,
  type Role,
} from "../shared/schema.ts";
import { registerContributionRoutes } from "./contributions.ts";

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const raw = req.headers["x-test-user-id"];
    (req as any).session = raw ? { userId: Number(raw) } : {};
    next();
  });
  registerContributionRoutes(app);
  return app;
}

const app = buildTestApp();
const PREFIX = "givtest_";

const roleUserIds: Record<Role, number> = {} as Record<Role, number>;
let bookkeeperId: number;
let treasurerId: number;
let fundId: number;

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
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

async function cleanup() {
  const testDonors = await db
    .select({ id: donors.id })
    .from(donors)
    .where(like(donors.lastName, `${PREFIX}%`));
  const batches = await db
    .select({ id: contributionBatches.id })
    .from(contributionBatches)
    .where(like(contributionBatches.description, `${PREFIX}%`));
  if (batches.length) {
    // contributions cascade with batch deletion
    await db.delete(contributionBatches).where(
      inArray(
        contributionBatches.id,
        batches.map((b) => b.id),
      ),
    );
  }
  if (testDonors.length) {
    await db.delete(donors).where(
      inArray(
        donors.id,
        testDonors.map((d) => d.id),
      ),
    );
  }
  await db.delete(offeringCounts).where(like(offeringCounts.counter1, `${PREFIX}%`));
  await db.delete(givingFunds).where(like(givingFunds.name, `${PREFIX}%`));
  await db.delete(users).where(like(users.username, `${PREFIX}%`));
}

async function createDonor(lastName: string) {
  const res = await request(app)
    .post("/api/giving/donors")
    .set(as(bookkeeperId))
    .send({ firstName: "Test", lastName: `${PREFIX}${lastName}` });
  expect(res.status).toBe(201);
  return res.body.donor as { id: number };
}

async function createBatch(extra: Record<string, unknown> = {}) {
  const res = await request(app)
    .post("/api/giving/batches")
    .set(as(bookkeeperId))
    .send({ batchDate: "2026-07-05", description: `${PREFIX}batch`, ...extra });
  expect(res.status).toBe(201);
  return res.body.batch as { id: number };
}

async function addContribution(batchId: number, donorId: number, amountCents: number, extra: Record<string, unknown> = {}) {
  const res = await request(app)
    .post(`/api/giving/batches/${batchId}/contributions`)
    .set(as(bookkeeperId))
    .send({ donorId, fundId, amountCents, method: "cash", ...extra });
  return res;
}

describe("role gating: individual giving data is confidential", () => {
  it("only GIVING_ROLES can list donors — admin, deacon, finance_committee, member, etc. are all rejected", async () => {
    for (const role of ROLES) {
      const res = await request(app).get("/api/giving/donors").set(as(roleUserIds[role]));
      if (GIVING_ROLES.includes(role)) {
        expect(res.status, role).toBe(200);
      } else {
        expect(res.status, role).toBe(403);
      }
    }
  });

  it("admin specifically cannot see donor detail or batches", async () => {
    const donor = await createDonor("AdminBlock");
    const detail = await request(app).get(`/api/giving/donors/${donor.id}`).set(as(roleUserIds["admin"]));
    expect(detail.status).toBe(403);
    const batches = await request(app).get("/api/giving/batches").set(as(roleUserIds["admin"]));
    expect(batches.status).toBe(403);
  });

  it("fund summary is open to FUND_REPORT_ROLES (incl. finance_committee) but nobody else", async () => {
    for (const role of ROLES) {
      const res = await request(app).get("/api/giving/reports/funds").set(as(roleUserIds[role]));
      if (FUND_REPORT_ROLES.includes(role)) {
        expect(res.status, role).toBe(200);
      } else {
        expect(res.status, role).toBe(403);
      }
    }
  });

  it("finance_committee sees aggregates but cannot reach donor-level endpoints", async () => {
    const fc = roleUserIds["finance_committee"];
    const summary = await request(app).get("/api/giving/reports/funds").set(as(fc));
    expect(summary.status).toBe(200);
    // aggregate payload must never include donor names
    expect(JSON.stringify(summary.body)).not.toContain(`${PREFIX}AdminBlock`);
    expect(JSON.stringify(summary.body)).not.toContain('"donorId"');
    const donorsRes = await request(app).get("/api/giving/donors").set(as(fc));
    expect(donorsRes.status).toBe(403);
  });

  it("unauthenticated requests are rejected", async () => {
    const res = await request(app).get("/api/giving/donors");
    expect(res.status).toBe(401);
  });
});

describe("batch entry and reconciliation against offering counts", () => {
  it("closing a batch whose total mismatches the linked count returns 409 with the variance", async () => {
    const [count] = await db
      .insert(offeringCounts)
      .values({
        countDate: "2026-07-05",
        cashCents: 10000,
        coinCents: 0,
        checksCents: 5000,
        checkCount: 1,
        otherCents: 0,
        counter1: `${PREFIX}c1`,
        counter2: `${PREFIX}c2`,
        status: "verified",
      })
      .returning();
    const donor = await createDonor("Reconcile");
    const batch = await createBatch({ offeringCountId: count.id });
    await addContribution(batch.id, donor.id, 10000);

    const close = await request(app)
      .post(`/api/giving/batches/${batch.id}/close`)
      .set(as(treasurerId))
      .send({ externalLedgerReference: "test-ledger-1" });
    expect(close.status).toBe(409);
    expect(close.body.varianceCents).toBe(-5000);
    expect(close.body.batchTotalCents).toBe(10000);
    expect(close.body.countTotalCents).toBe(15000);

    // matching the count allows the close
    await addContribution(batch.id, donor.id, 5000, { method: "check", checkNumber: "101" });
    const close2 = await request(app)
      .post(`/api/giving/batches/${batch.id}/close`)
      .set(as(treasurerId))
      .send({ externalLedgerReference: "test-ledger-2" });
    expect(close2.status).toBe(200);
    expect(close2.body.batch.status).toBe("closed");
  });

  it("a mismatched batch can be closed with an explicit override", async () => {
    const donor = await createDonor("Override");
    const [count] = await db
      .insert(offeringCounts)
      .values({
        countDate: "2026-07-12",
        cashCents: 9999,
        coinCents: 0,
        checksCents: 0,
        checkCount: 0,
        otherCents: 0,
        counter1: `${PREFIX}c3`,
        counter2: `${PREFIX}c4`,
        status: "verified",
      })
      .returning();
    const batch = await createBatch({ offeringCountId: count.id });
    await addContribution(batch.id, donor.id, 5000);
    const close = await request(app)
      .post(`/api/giving/batches/${batch.id}/close`)
      .set(as(treasurerId))
      .send({
        allowMismatch: true,
        mismatchOverrideReason: "Test discrepancy approved after review",
        externalLedgerReference: "test-ledger-3",
      });
    expect(close.status).toBe(200);
  });

  it("an empty batch cannot be closed", async () => {
    const batch = await createBatch();
    const close = await request(app)
      .post(`/api/giving/batches/${batch.id}/close`)
      .set(as(treasurerId))
      .send({ externalLedgerReference: "test-ledger-4" });
    expect(close.status).toBe(400);
  });

  it("closed batches are immutable and cannot be reopened", async () => {
    const donor = await createDonor("Locked");
    const batch = await createBatch();
    const added = await addContribution(batch.id, donor.id, 2500);
    expect(added.status).toBe(201);
    const contributionId = added.body.contribution.id;

    const close = await request(app)
      .post(`/api/giving/batches/${batch.id}/close`)
      .set(as(treasurerId))
      .send({ externalLedgerReference: "test-ledger-5" });
    expect(close.status).toBe(200);

    const addBlocked = await addContribution(batch.id, donor.id, 1000);
    expect(addBlocked.status).toBe(400);

    const editBlocked = await request(app)
      .patch(`/api/giving/contributions/${contributionId}`)
      .set(as(bookkeeperId))
      .send({ donorId: donor.id, fundId, amountCents: 9999, method: "cash" });
    expect(editBlocked.status).toBe(400);

    const deleteBlocked = await request(app)
      .delete(`/api/giving/contributions/${contributionId}`)
      .set(as(bookkeeperId));
    expect(deleteBlocked.status).toBe(400);

    const deleteBatchBlocked = await request(app)
      .delete(`/api/giving/batches/${batch.id}`)
      .set(as(bookkeeperId));
    expect(deleteBatchBlocked.status).toBe(400);

    const reopen = await request(app)
      .post(`/api/giving/batches/${batch.id}/reopen`)
      .set(as(treasurerId));
    expect(reopen.status).toBe(409);

    const editStillBlocked = await request(app)
      .patch(`/api/giving/contributions/${contributionId}`)
      .set(as(bookkeeperId))
      .send({ donorId: donor.id, fundId, amountCents: 9999, method: "cash" });
    expect(editStillBlocked.status).toBe(400);
  });

  it("check contributions require a check number", async () => {
    const donor = await createDonor("CheckNo");
    const batch = await createBatch();
    const res = await addContribution(batch.id, donor.id, 1000, { method: "check" });
    expect(res.status).toBe(400);
  });

  it("corrects a closed contribution with an immutable adjustment batch", async () => {
    const donor = await createDonor("Adjustment");
    const batch = await createBatch();
    const added = await addContribution(batch.id, donor.id, 2500);
    await request(app)
      .post(`/api/giving/batches/${batch.id}/close`)
      .set(as(treasurerId))
      .send({ externalLedgerReference: "adjustment-original" });

    const adjusted = await request(app)
      .post(`/api/giving/contributions/${added.body.contribution.id}/adjust`)
      .set(as(bookkeeperId))
      .send({
        replacementAmountCents: 3000,
        reason: "Correct amount after reviewing the original receipt",
        externalLedgerReference: "adjustment-prepared",
      });
    expect(adjusted.status).toBe(201);
    expect(adjusted.body.batch.kind).toBe("adjustment");
    expect(adjusted.body.batch.status).toBe("open");

    const detail = await request(app)
      .get(`/api/giving/batches/${adjusted.body.batch.id}`)
      .set(as(bookkeeperId));
    expect(detail.body.contributions).toHaveLength(2);
    expect(detail.body.contributions.map((entry: any) => entry.amountCents).sort((a: number, b: number) => a - b)).toEqual([-2500, 3000]);

    const approved = await request(app)
      .post(`/api/giving/batches/${adjusted.body.batch.id}/close`)
      .set(as(treasurerId))
      .send({ externalLedgerReference: "adjustment-approved" });
    expect(approved.status).toBe(200);
  });
});

describe("donor management", () => {
  it("a donor with contributions cannot be deleted, but can be merged", async () => {
    const source = await createDonor("MergeSource");
    const target = await createDonor("MergeTarget");
    const batch = await createBatch();
    await addContribution(batch.id, source.id, 3000);

    const del = await request(app).delete(`/api/giving/donors/${source.id}`).set(as(bookkeeperId));
    expect(del.status).toBe(400);

    const merge = await request(app)
      .post(`/api/giving/donors/${source.id}/merge`)
      .set(as(treasurerId))
      .send({ intoDonorId: target.id });
    expect(merge.status).toBe(200);

    const gone = await request(app).get(`/api/giving/donors/${source.id}`).set(as(bookkeeperId));
    expect(gone.status).toBe(404);

    const detail = await request(app).get(`/api/giving/donors/${target.id}`).set(as(bookkeeperId));
    expect(detail.status).toBe(200);
    expect(detail.body.contributions).toHaveLength(1);
    expect(detail.body.contributions[0].amountCents).toBe(3000);
  });

  it("statement endpoint returns only contributions inside the range with fund totals", async () => {
    const donor = await createDonor("Statement");
    const batch = await createBatch();
    await addContribution(batch.id, donor.id, 2000, { contributionDate: "2026-01-15" });
    await addContribution(batch.id, donor.id, 3000, { contributionDate: "2026-06-15" });
    await addContribution(batch.id, donor.id, 7000, { contributionDate: "2025-12-31" });
    await request(app)
      .post(`/api/giving/batches/${batch.id}/close`)
      .set(as(treasurerId))
      .send({ externalLedgerReference: "statement-test" });

    const res = await request(app)
      .get(`/api/giving/donors/${donor.id}/statement?start=2026-01-01&end=2026-12-31`)
      .set(as(treasurerId));
    expect(res.status).toBe(200);
    expect(res.body.totalCents).toBe(5000);
    expect(res.body.contributions).toHaveLength(2);
    expect(res.body.fundTotals).toHaveLength(1);
    expect(res.body.fundTotals[0].totalCents).toBe(5000);

    const bad = await request(app)
      .get(`/api/giving/donors/${donor.id}/statement?start=2026-12-31&end=2026-01-01`)
      .set(as(treasurerId));
    expect(bad.status).toBe(400);
  });

  it("bulk statements endpoint groups by donor and only includes donors with giving in range", async () => {
    const alpha = await createDonor("BulkAlpha");
    const beta = await createDonor("BulkBeta");
    const outside = await createDonor("BulkOutside");
    const batch = await createBatch();
    await addContribution(batch.id, alpha.id, 2000, { contributionDate: "2026-02-01" });
    await addContribution(batch.id, alpha.id, 3000, { contributionDate: "2026-03-01" });
    await addContribution(batch.id, beta.id, 4000, { contributionDate: "2026-04-01" });
    await addContribution(batch.id, outside.id, 5000, { contributionDate: "2025-06-01" });
    await request(app)
      .post(`/api/giving/batches/${batch.id}/close`)
      .set(as(treasurerId))
      .send({ externalLedgerReference: "bulk-statement-test" });

    const res = await request(app)
      .get("/api/giving/statements?start=2026-01-01&end=2026-12-31")
      .set(as(treasurerId));
    expect(res.status).toBe(200);
    const ids = res.body.statements.map((s: any) => s.donor.id);
    expect(ids).toContain(alpha.id);
    expect(ids).toContain(beta.id);
    expect(ids).not.toContain(outside.id);
    const alphaStmt = res.body.statements.find((s: any) => s.donor.id === alpha.id);
    expect(alphaStmt.totalCents).toBe(5000);
    expect(alphaStmt.contributions).toHaveLength(2);
    expect(alphaStmt.fundTotals[0].totalCents).toBe(5000);
    const betaStmt = res.body.statements.find((s: any) => s.donor.id === beta.id);
    expect(betaStmt.totalCents).toBe(4000);

    const bad = await request(app)
      .get("/api/giving/statements?start=2026-12-31&end=2026-01-01")
      .set(as(treasurerId));
    expect(bad.status).toBe(400);

    const invalid = await request(app)
      .get("/api/giving/statements?start=notadate&end=2026-12-31")
      .set(as(treasurerId));
    expect(invalid.status).toBe(400);
  });

  it("bulk statements endpoint is restricted to giving roles (admin excluded)", async () => {
    for (const role of ROLES) {
      const res = await request(app)
        .get("/api/giving/statements?start=2026-01-01&end=2026-12-31")
        .set(as(roleUserIds[role]));
      if ((GIVING_ROLES as readonly string[]).includes(role)) {
        expect(res.status, role).toBe(200);
      } else {
        expect(res.status, role).toBe(403);
      }
    }
    const anon = await request(app).get("/api/giving/statements?start=2026-01-01&end=2026-12-31");
    expect(anon.status).toBe(401);
  });

  it("a member cannot be linked to two donor records", async () => {
    // create a household-less member directly
    const { members } = await import("../shared/schema.ts");
    const [member] = await db
      .insert(members)
      .values({ firstName: "Giv", lastName: `${PREFIX}Member` })
      .returning();
    try {
      const d1 = await createDonor("LinkOne");
      const link1 = await request(app)
        .patch(`/api/giving/donors/${d1.id}`)
        .set(as(bookkeeperId))
        .send({ memberId: member.id });
      expect(link1.status).toBe(200);

      const d2 = await createDonor("LinkTwo");
      const link2 = await request(app)
        .patch(`/api/giving/donors/${d2.id}`)
        .set(as(bookkeeperId))
        .send({ memberId: member.id });
      expect(link2.status).toBe(400);
    } finally {
      await db.delete(donors).where(eq(donors.memberId, member.id));
      await db.delete(members).where(eq(members.id, member.id));
    }
  });
});
