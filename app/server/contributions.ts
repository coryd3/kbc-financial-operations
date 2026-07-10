import type { Express, Request } from "express";
import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { db } from "./db.ts";
import {
  givingFunds,
  donors,
  contributionBatches,
  contributions,
  offeringCounts,
  members,
  users,
  givingFundSchema,
  donorSchema,
  donorMergeSchema,
  contributionBatchSchema,
  contributionSchema,
  batchCloseSchema,
  GIVING_ROLES,
  FUND_REPORT_ROLES,
  type User,
} from "../shared/schema.ts";
import { requireRole } from "./auth.ts";

function getUser(req: Request): User {
  return (req as any).user as User;
}

function firstError(parsed: { error: { errors: { message?: string }[] } }): string {
  return parsed.error.errors[0]?.message ?? "Invalid input";
}

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Individual donor giving data is confidential (Bookkeeper / Treasurer /
// Super Admin only). Fund-level aggregates additionally allow the Finance
// Committee, with no donor-level detail.
const requireGiving = requireRole(...GIVING_ROLES);
const requireFundReport = requireRole(...FUND_REPORT_ROLES);

function countTotal(c: {
  cashCents: number;
  coinCents: number;
  checksCents: number;
  otherCents: number;
}): number {
  return c.cashCents + c.coinCents + c.checksCents + c.otherCents;
}

async function batchTotals(batchIds: number[]) {
  if (!batchIds.length) return new Map<number, { totalCents: number; count: number }>();
  const rows = await db
    .select({
      batchId: contributions.batchId,
      totalCents: sql<number>`coalesce(sum(${contributions.amountCents}), 0)::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(contributions)
    .where(inArray(contributions.batchId, batchIds))
    .groupBy(contributions.batchId);
  return new Map(rows.map((r) => [r.batchId, { totalCents: r.totalCents, count: r.count }]));
}

export function registerContributionRoutes(app: Express) {
  // ---------- Funds ----------
  app.get("/api/giving/funds", requireFundReport, async (_req, res) => {
    const rows = await db
      .select()
      .from(givingFunds)
      .orderBy(asc(givingFunds.sortOrder), asc(givingFunds.name));
    res.json({ funds: rows });
  });

  app.post("/api/giving/funds", requireGiving, async (req, res) => {
    const parsed = givingFundSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: firstError(parsed) });
    const d = parsed.data;
    const [existing] = await db
      .select({ id: givingFunds.id })
      .from(givingFunds)
      .where(ilike(givingFunds.name, d.name));
    if (existing) return res.status(409).json({ message: "A fund with that name already exists" });
    const [created] = await db
      .insert(givingFunds)
      .values({
        name: d.name,
        description: d.description || null,
        isActive: d.isActive,
        sortOrder: d.sortOrder,
      })
      .returning();
    res.status(201).json({ fund: created });
  });

  app.patch("/api/giving/funds/:id", requireGiving, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const parsed = givingFundSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: firstError(parsed) });
    const d = parsed.data;
    const [updated] = await db
      .update(givingFunds)
      .set({
        ...(d.name !== undefined ? { name: d.name } : {}),
        ...(d.description !== undefined ? { description: d.description || null } : {}),
        ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
        ...(d.sortOrder !== undefined ? { sortOrder: d.sortOrder } : {}),
      })
      .where(eq(givingFunds.id, id))
      .returning();
    if (!updated) return res.status(404).json({ message: "Fund not found" });
    res.json({ fund: updated });
  });

  // ---------- Donors ----------
  app.get("/api/giving/donors", requireGiving, async (req, res) => {
    const search = String(req.query.search ?? "").trim();
    const conditions = [] as any[];
    if (search) {
      conditions.push(
        or(
          ilike(donors.firstName, `%${search}%`),
          ilike(donors.lastName, `%${search}%`),
          ilike(donors.envelopeNumber, `%${search}%`),
          ilike(sql`${donors.firstName} || ' ' || ${donors.lastName}`, `%${search}%`),
        ),
      );
    }
    if (String(req.query.active ?? "") === "1") conditions.push(eq(donors.isActive, true));
    const rows = await db
      .select({
        donor: donors,
        memberFirstName: members.firstName,
        memberLastName: members.lastName,
      })
      .from(donors)
      .leftJoin(members, eq(donors.memberId, members.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(donors.lastName), asc(donors.firstName))
      .limit(500);
    const ids = rows.map((r) => r.donor.id);
    const totals = ids.length
      ? await db
          .select({
            donorId: contributions.donorId,
            totalCents: sql<number>`coalesce(sum(${contributions.amountCents}), 0)::int`,
            count: sql<number>`count(*)::int`,
            lastDate: sql<string | null>`max(${contributions.contributionDate})`,
          })
          .from(contributions)
          .where(inArray(contributions.donorId, ids))
          .groupBy(contributions.donorId)
      : [];
    const totalMap = new Map(totals.map((t) => [t.donorId, t]));
    res.json({
      donors: rows.map((r) => ({
        ...r.donor,
        memberName: r.memberFirstName ? `${r.memberFirstName} ${r.memberLastName}` : null,
        totalCents: totalMap.get(r.donor.id)?.totalCents ?? 0,
        contributionCount: totalMap.get(r.donor.id)?.count ?? 0,
        lastContributionDate: totalMap.get(r.donor.id)?.lastDate ?? null,
      })),
    });
  });

  async function validateDonorInput(
    d: { memberId?: number | null },
    excludeDonorId?: number,
  ): Promise<string | null> {
    if (d.memberId != null) {
      const [member] = await db.select({ id: members.id }).from(members).where(eq(members.id, d.memberId));
      if (!member) return "Linked member record not found";
      const [taken] = await db
        .select({ id: donors.id })
        .from(donors)
        .where(eq(donors.memberId, d.memberId));
      if (taken && taken.id !== excludeDonorId) {
        return "That member is already linked to another donor record";
      }
    }
    return null;
  }

  app.post("/api/giving/donors", requireGiving, async (req, res) => {
    const parsed = donorSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: firstError(parsed) });
    const d = parsed.data;
    const linkError = await validateDonorInput(d);
    if (linkError) return res.status(400).json({ message: linkError });
    const [created] = await db
      .insert(donors)
      .values({
        firstName: d.firstName,
        lastName: d.lastName,
        email: d.email || null,
        phone: d.phone || null,
        address: d.address || null,
        envelopeNumber: d.envelopeNumber || null,
        memberId: d.memberId ?? null,
        notes: d.notes || null,
        isActive: d.isActive,
      })
      .returning();
    res.status(201).json({ donor: created });
  });

  app.patch("/api/giving/donors/:id", requireGiving, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const parsed = donorSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: firstError(parsed) });
    const d = parsed.data;
    if (d.memberId !== undefined) {
      const linkError = await validateDonorInput(d, id);
      if (linkError) return res.status(400).json({ message: linkError });
    }
    const [updated] = await db
      .update(donors)
      .set({
        ...(d.firstName !== undefined ? { firstName: d.firstName } : {}),
        ...(d.lastName !== undefined ? { lastName: d.lastName } : {}),
        ...(d.email !== undefined ? { email: d.email || null } : {}),
        ...(d.phone !== undefined ? { phone: d.phone || null } : {}),
        ...(d.address !== undefined ? { address: d.address || null } : {}),
        ...(d.envelopeNumber !== undefined ? { envelopeNumber: d.envelopeNumber || null } : {}),
        ...(d.memberId !== undefined ? { memberId: d.memberId ?? null } : {}),
        ...(d.notes !== undefined ? { notes: d.notes || null } : {}),
        ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
        updatedAt: new Date(),
      })
      .where(eq(donors.id, id))
      .returning();
    if (!updated) return res.status(404).json({ message: "Donor not found" });
    res.json({ donor: updated });
  });

  app.delete("/api/giving/donors/:id", requireGiving, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(contributions)
      .where(eq(contributions.donorId, id));
    if (count > 0) {
      return res.status(400).json({
        message:
          "This donor has recorded contributions and cannot be deleted. Mark the donor inactive or merge them into another donor instead.",
      });
    }
    const [deleted] = await db.delete(donors).where(eq(donors.id, id)).returning();
    if (!deleted) return res.status(404).json({ message: "Donor not found" });
    res.json({ message: "Deleted" });
  });

  // Merge: move all contributions from :id into another donor, then delete :id.
  app.post("/api/giving/donors/:id/merge", requireGiving, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const parsed = donorMergeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: firstError(parsed) });
    const intoId = parsed.data.intoDonorId;
    if (intoId === id) return res.status(400).json({ message: "A donor cannot be merged into itself" });
    const [source] = await db.select().from(donors).where(eq(donors.id, id));
    if (!source) return res.status(404).json({ message: "Donor not found" });
    const [target] = await db.select().from(donors).where(eq(donors.id, intoId));
    if (!target) return res.status(404).json({ message: "Target donor not found" });
    await db.transaction(async (tx) => {
      await tx.update(contributions).set({ donorId: intoId }).where(eq(contributions.donorId, id));
      // Preserve a member link if the target lacks one.
      if (source.memberId != null && target.memberId == null) {
        await tx.update(donors).set({ memberId: null }).where(eq(donors.id, id));
        await tx
          .update(donors)
          .set({ memberId: source.memberId, updatedAt: new Date() })
          .where(eq(donors.id, intoId));
      }
      await tx.delete(donors).where(eq(donors.id, id));
    });
    res.json({ message: `Merged ${source.firstName} ${source.lastName} into ${target.firstName} ${target.lastName}` });
  });

  // Donor detail + full giving history.
  app.get("/api/giving/donors/:id", requireGiving, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const [row] = await db
      .select({
        donor: donors,
        memberFirstName: members.firstName,
        memberLastName: members.lastName,
      })
      .from(donors)
      .leftJoin(members, eq(donors.memberId, members.id))
      .where(eq(donors.id, id));
    if (!row) return res.status(404).json({ message: "Donor not found" });
    const history = await db
      .select({
        contribution: contributions,
        fundName: givingFunds.name,
        batchDate: contributionBatches.batchDate,
        batchStatus: contributionBatches.status,
      })
      .from(contributions)
      .innerJoin(givingFunds, eq(contributions.fundId, givingFunds.id))
      .innerJoin(contributionBatches, eq(contributions.batchId, contributionBatches.id))
      .where(eq(contributions.donorId, id))
      .orderBy(desc(contributions.contributionDate), desc(contributions.id))
      .limit(1000);
    const byYear = await db
      .select({
        year: sql<number>`extract(year from ${contributions.contributionDate})::int`,
        totalCents: sql<number>`coalesce(sum(${contributions.amountCents}), 0)::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(contributions)
      .where(eq(contributions.donorId, id))
      .groupBy(sql`extract(year from ${contributions.contributionDate})`)
      .orderBy(desc(sql`extract(year from ${contributions.contributionDate})`));
    res.json({
      donor: {
        ...row.donor,
        memberName: row.memberFirstName ? `${row.memberFirstName} ${row.memberLastName}` : null,
      },
      contributions: history.map((h) => ({
        ...h.contribution,
        fundName: h.fundName,
        batchDate: h.batchDate,
        batchStatus: h.batchStatus,
      })),
      byYear,
    });
  });

  // Statement data for a date range (client renders the printable document).
  app.get("/api/giving/donors/:id/statement", requireGiving, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const start = String(req.query.start ?? "");
    const end = String(req.query.end ?? "");
    if (!DATE_RE.test(start) || !DATE_RE.test(end)) {
      return res.status(400).json({ message: "start and end must be YYYY-MM-DD dates" });
    }
    if (start > end) return res.status(400).json({ message: "The start date must be before the end date" });
    const [donor] = await db.select().from(donors).where(eq(donors.id, id));
    if (!donor) return res.status(404).json({ message: "Donor not found" });
    const rows = await db
      .select({
        contribution: contributions,
        fundName: givingFunds.name,
      })
      .from(contributions)
      .innerJoin(givingFunds, eq(contributions.fundId, givingFunds.id))
      .where(
        and(
          eq(contributions.donorId, id),
          gte(contributions.contributionDate, start),
          lte(contributions.contributionDate, end),
        ),
      )
      .orderBy(asc(contributions.contributionDate), asc(contributions.id));
    const fundTotals = new Map<string, number>();
    let totalCents = 0;
    for (const r of rows) {
      totalCents += r.contribution.amountCents;
      fundTotals.set(r.fundName, (fundTotals.get(r.fundName) ?? 0) + r.contribution.amountCents);
    }
    res.json({
      donor,
      start,
      end,
      contributions: rows.map((r) => ({ ...r.contribution, fundName: r.fundName })),
      fundTotals: [...fundTotals.entries()].map(([fundName, cents]) => ({ fundName, totalCents: cents })),
      totalCents,
    });
  });

  // Bulk statements: every donor with contributions in the range, in one
  // response (used for year-end statement printing for all donors at once).
  app.get("/api/giving/statements", requireGiving, async (req, res) => {
    const start = String(req.query.start ?? "");
    const end = String(req.query.end ?? "");
    if (!DATE_RE.test(start) || !DATE_RE.test(end)) {
      return res.status(400).json({ message: "start and end must be YYYY-MM-DD dates" });
    }
    if (start > end) return res.status(400).json({ message: "The start date must be before the end date" });
    const rows = await db
      .select({
        contribution: contributions,
        fundName: givingFunds.name,
        donor: donors,
      })
      .from(contributions)
      .innerJoin(givingFunds, eq(contributions.fundId, givingFunds.id))
      .innerJoin(donors, eq(contributions.donorId, donors.id))
      .where(and(gte(contributions.contributionDate, start), lte(contributions.contributionDate, end)))
      .orderBy(
        asc(donors.lastName),
        asc(donors.firstName),
        asc(donors.id),
        asc(contributions.contributionDate),
        asc(contributions.id),
      );
    type Statement = {
      donor: typeof donors.$inferSelect;
      contributions: (typeof contributions.$inferSelect & { fundName: string })[];
      fundTotals: { fundName: string; totalCents: number }[];
      totalCents: number;
    };
    const byDonor = new Map<number, Statement & { fundMap: Map<string, number> }>();
    for (const r of rows) {
      let entry = byDonor.get(r.donor.id);
      if (!entry) {
        entry = { donor: r.donor, contributions: [], fundTotals: [], totalCents: 0, fundMap: new Map() };
        byDonor.set(r.donor.id, entry);
      }
      entry.contributions.push({ ...r.contribution, fundName: r.fundName });
      entry.totalCents += r.contribution.amountCents;
      entry.fundMap.set(r.fundName, (entry.fundMap.get(r.fundName) ?? 0) + r.contribution.amountCents);
    }
    const statements = [...byDonor.values()].map(({ fundMap, ...s }) => ({
      ...s,
      fundTotals: [...fundMap.entries()].map(([fundName, cents]) => ({ fundName, totalCents: cents })),
    }));
    res.json({ start, end, statements });
  });

  // ---------- Batches ----------
  app.get("/api/giving/batches", requireGiving, async (_req, res) => {
    const rows = await db
      .select({
        batch: contributionBatches,
        enteredByName: users.fullName,
        count: offeringCounts,
      })
      .from(contributionBatches)
      .leftJoin(users, eq(contributionBatches.enteredBy, users.id))
      .leftJoin(offeringCounts, eq(contributionBatches.offeringCountId, offeringCounts.id))
      .orderBy(desc(contributionBatches.batchDate), desc(contributionBatches.id))
      .limit(200);
    const totals = await batchTotals(rows.map((r) => r.batch.id));
    res.json({
      batches: rows.map((r) => ({
        ...r.batch,
        enteredByName: r.enteredByName,
        totalCents: totals.get(r.batch.id)?.totalCents ?? 0,
        contributionCount: totals.get(r.batch.id)?.count ?? 0,
        countTotalCents: r.count ? countTotal(r.count) : null,
        countDate: r.count?.countDate ?? null,
      })),
    });
  });

  async function validateBatchCount(offeringCountId: number | null | undefined, excludeBatchId?: number) {
    if (offeringCountId == null) return null;
    const [count] = await db
      .select()
      .from(offeringCounts)
      .where(eq(offeringCounts.id, offeringCountId));
    if (!count) return "Offering count not found";
    const [taken] = await db
      .select({ id: contributionBatches.id })
      .from(contributionBatches)
      .where(eq(contributionBatches.offeringCountId, offeringCountId));
    if (taken && taken.id !== excludeBatchId) {
      return `Offering count #${offeringCountId} is already linked to batch #${taken.id}`;
    }
    return null;
  }

  app.post("/api/giving/batches", requireGiving, async (req, res) => {
    const parsed = contributionBatchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: firstError(parsed) });
    const d = parsed.data;
    const countError = await validateBatchCount(d.offeringCountId);
    if (countError) return res.status(400).json({ message: countError });
    const [created] = await db
      .insert(contributionBatches)
      .values({
        batchDate: d.batchDate,
        description: d.description || null,
        offeringCountId: d.offeringCountId ?? null,
        notes: d.notes || null,
        enteredBy: getUser(req).id,
      })
      .returning();
    res.status(201).json({ batch: created });
  });

  app.get("/api/giving/batches/:id", requireGiving, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const [row] = await db
      .select({
        batch: contributionBatches,
        enteredByName: users.fullName,
        count: offeringCounts,
      })
      .from(contributionBatches)
      .leftJoin(users, eq(contributionBatches.enteredBy, users.id))
      .leftJoin(offeringCounts, eq(contributionBatches.offeringCountId, offeringCounts.id))
      .where(eq(contributionBatches.id, id));
    if (!row) return res.status(404).json({ message: "Batch not found" });
    const entries = await db
      .select({
        contribution: contributions,
        donorFirstName: donors.firstName,
        donorLastName: donors.lastName,
        fundName: givingFunds.name,
      })
      .from(contributions)
      .innerJoin(donors, eq(contributions.donorId, donors.id))
      .innerJoin(givingFunds, eq(contributions.fundId, givingFunds.id))
      .where(eq(contributions.batchId, id))
      .orderBy(desc(contributions.id));
    const totalCents = entries.reduce((s, e) => s + e.contribution.amountCents, 0);
    res.json({
      batch: {
        ...row.batch,
        enteredByName: row.enteredByName,
        totalCents,
        contributionCount: entries.length,
        countTotalCents: row.count ? countTotal(row.count) : null,
        countDate: row.count?.countDate ?? null,
      },
      contributions: entries.map((e) => ({
        ...e.contribution,
        donorName: `${e.donorFirstName} ${e.donorLastName}`,
        fundName: e.fundName,
      })),
    });
  });

  app.patch("/api/giving/batches/:id", requireGiving, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const [batch] = await db.select().from(contributionBatches).where(eq(contributionBatches.id, id));
    if (!batch) return res.status(404).json({ message: "Batch not found" });
    if (batch.status === "closed") {
      return res.status(400).json({ message: "Closed batches can no longer be edited" });
    }
    const parsed = contributionBatchSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: firstError(parsed) });
    const d = parsed.data;
    if (d.offeringCountId !== undefined) {
      const countError = await validateBatchCount(d.offeringCountId, id);
      if (countError) return res.status(400).json({ message: countError });
    }
    const [updated] = await db
      .update(contributionBatches)
      .set({
        ...(d.batchDate !== undefined ? { batchDate: d.batchDate } : {}),
        ...(d.description !== undefined ? { description: d.description || null } : {}),
        ...(d.offeringCountId !== undefined ? { offeringCountId: d.offeringCountId ?? null } : {}),
        ...(d.notes !== undefined ? { notes: d.notes || null } : {}),
      })
      .where(eq(contributionBatches.id, id))
      .returning();
    res.json({ batch: updated });
  });

  app.delete("/api/giving/batches/:id", requireGiving, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const [batch] = await db.select().from(contributionBatches).where(eq(contributionBatches.id, id));
    if (!batch) return res.status(404).json({ message: "Batch not found" });
    if (batch.status === "closed") {
      return res.status(400).json({ message: "Closed batches cannot be deleted" });
    }
    // Deleting an open batch removes its (draft) contributions via cascade.
    await db.delete(contributionBatches).where(eq(contributionBatches.id, id));
    res.json({ message: "Deleted" });
  });

  // Close a batch. If an offering count is linked, the batch total must match
  // the count total unless allowMismatch is explicitly set (the variance is
  // reported either way so discrepancies get resolved, per the documented
  // contribution entry process).
  app.post("/api/giving/batches/:id/close", requireGiving, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const parsed = batchCloseSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ message: firstError(parsed) });
    const [batch] = await db.select().from(contributionBatches).where(eq(contributionBatches.id, id));
    if (!batch) return res.status(404).json({ message: "Batch not found" });
    if (batch.status === "closed") return res.status(400).json({ message: "This batch is already closed" });
    const totals = await batchTotals([id]);
    const totalCents = totals.get(id)?.totalCents ?? 0;
    const entryCount = totals.get(id)?.count ?? 0;
    if (entryCount === 0) {
      return res.status(400).json({ message: "Add at least one contribution before closing the batch" });
    }
    if (batch.offeringCountId != null) {
      const [count] = await db
        .select()
        .from(offeringCounts)
        .where(eq(offeringCounts.id, batch.offeringCountId));
      if (count) {
        const expected = countTotal(count);
        const variance = totalCents - expected;
        if (variance !== 0 && !parsed.data.allowMismatch) {
          return res.status(409).json({
            message:
              variance > 0
                ? `Batch total is over the offering count by ${(variance / 100).toFixed(2)}. Resolve the discrepancy or close with an override.`
                : `Batch total is under the offering count by ${(Math.abs(variance) / 100).toFixed(2)}. Resolve the discrepancy or close with an override.`,
            varianceCents: variance,
            batchTotalCents: totalCents,
            countTotalCents: expected,
          });
        }
      }
    }
    const [updated] = await db
      .update(contributionBatches)
      .set({ status: "closed", closedBy: getUser(req).id, closedAt: new Date() })
      .where(eq(contributionBatches.id, id))
      .returning();
    res.json({ batch: updated });
  });

  app.post("/api/giving/batches/:id/reopen", requireGiving, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const [batch] = await db.select().from(contributionBatches).where(eq(contributionBatches.id, id));
    if (!batch) return res.status(404).json({ message: "Batch not found" });
    if (batch.status !== "closed") return res.status(400).json({ message: "Only a closed batch can be reopened" });
    const [updated] = await db
      .update(contributionBatches)
      .set({ status: "open", closedBy: null, closedAt: null })
      .where(eq(contributionBatches.id, id))
      .returning();
    res.json({ batch: updated });
  });

  // ---------- Contributions within a batch ----------
  app.post("/api/giving/batches/:id/contributions", requireGiving, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const [batch] = await db.select().from(contributionBatches).where(eq(contributionBatches.id, id));
    if (!batch) return res.status(404).json({ message: "Batch not found" });
    if (batch.status === "closed") {
      return res.status(400).json({ message: "This batch is closed — reopen it to make changes" });
    }
    const parsed = contributionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: firstError(parsed) });
    const d = parsed.data;
    const [donor] = await db.select({ id: donors.id }).from(donors).where(eq(donors.id, d.donorId));
    if (!donor) return res.status(400).json({ message: "Donor not found" });
    const [fund] = await db.select().from(givingFunds).where(eq(givingFunds.id, d.fundId));
    if (!fund) return res.status(400).json({ message: "Fund not found" });
    if (!fund.isActive) return res.status(400).json({ message: "That fund is inactive" });
    const [created] = await db
      .insert(contributions)
      .values({
        batchId: id,
        donorId: d.donorId,
        fundId: d.fundId,
        contributionDate: d.contributionDate || batch.batchDate,
        amountCents: d.amountCents,
        method: d.method,
        checkNumber: d.method === "check" ? d.checkNumber || null : null,
        note: d.note || null,
        enteredBy: getUser(req).id,
      })
      .returning();
    res.status(201).json({ contribution: created });
  });

  async function loadContributionWithBatch(id: number) {
    const [row] = await db
      .select({ contribution: contributions, batchStatus: contributionBatches.status, batchDate: contributionBatches.batchDate })
      .from(contributions)
      .innerJoin(contributionBatches, eq(contributions.batchId, contributionBatches.id))
      .where(eq(contributions.id, id));
    return row ?? null;
  }

  app.patch("/api/giving/contributions/:id", requireGiving, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const row = await loadContributionWithBatch(id);
    if (!row) return res.status(404).json({ message: "Contribution not found" });
    if (row.batchStatus === "closed") {
      return res.status(400).json({ message: "This batch is closed — reopen it to make changes" });
    }
    const parsed = contributionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: firstError(parsed) });
    const d = parsed.data;
    const [donor] = await db.select({ id: donors.id }).from(donors).where(eq(donors.id, d.donorId));
    if (!donor) return res.status(400).json({ message: "Donor not found" });
    const [fund] = await db.select().from(givingFunds).where(eq(givingFunds.id, d.fundId));
    if (!fund) return res.status(400).json({ message: "Fund not found" });
    const [updated] = await db
      .update(contributions)
      .set({
        donorId: d.donorId,
        fundId: d.fundId,
        contributionDate: d.contributionDate || row.batchDate,
        amountCents: d.amountCents,
        method: d.method,
        checkNumber: d.method === "check" ? d.checkNumber || null : null,
        note: d.note || null,
      })
      .where(eq(contributions.id, id))
      .returning();
    res.json({ contribution: updated });
  });

  app.delete("/api/giving/contributions/:id", requireGiving, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const row = await loadContributionWithBatch(id);
    if (!row) return res.status(404).json({ message: "Contribution not found" });
    if (row.batchStatus === "closed") {
      return res.status(400).json({ message: "This batch is closed — reopen it to make changes" });
    }
    await db.delete(contributions).where(eq(contributions.id, id));
    res.json({ message: "Deleted" });
  });

  // ---------- Fund summaries (aggregates only — no donor detail) ----------
  app.get("/api/giving/reports/funds", requireFundReport, async (req, res) => {
    const now = new Date();
    let start: string;
    let end: string;
    const qsStart = String(req.query.start ?? "");
    const qsEnd = String(req.query.end ?? "");
    if (DATE_RE.test(qsStart) && DATE_RE.test(qsEnd)) {
      start = qsStart;
      end = qsEnd;
    } else {
      const year = Math.min(Math.max(Number(req.query.year) || now.getFullYear(), 2000), 2100);
      start = `${year}-01-01`;
      end = `${year}-12-31`;
    }
    if (start > end) return res.status(400).json({ message: "The start date must be before the end date" });

    const range = and(
      gte(contributions.contributionDate, start),
      lte(contributions.contributionDate, end),
    );

    const byFund = await db
      .select({
        fundId: givingFunds.id,
        fundName: givingFunds.name,
        totalCents: sql<number>`coalesce(sum(${contributions.amountCents}), 0)::int`,
        contributionCount: sql<number>`count(${contributions.id})::int`,
        donorCount: sql<number>`count(distinct ${contributions.donorId})::int`,
      })
      .from(givingFunds)
      .leftJoin(contributions, and(eq(contributions.fundId, givingFunds.id), range))
      .groupBy(givingFunds.id, givingFunds.name, givingFunds.sortOrder)
      .orderBy(asc(givingFunds.sortOrder), asc(givingFunds.name));

    const monthly = await db
      .select({
        month: sql<string>`to_char(${contributions.contributionDate}, 'YYYY-MM')`,
        fundId: contributions.fundId,
        totalCents: sql<number>`coalesce(sum(${contributions.amountCents}), 0)::int`,
      })
      .from(contributions)
      .where(range)
      .groupBy(sql`to_char(${contributions.contributionDate}, 'YYYY-MM')`, contributions.fundId)
      .orderBy(asc(sql`to_char(${contributions.contributionDate}, 'YYYY-MM')`));

    const totalCents = byFund.reduce((s, f) => s + f.totalCents, 0);
    res.json({ start, end, byFund, monthly, totalCents });
  });
}
