import type { Express, Request } from "express";
import { and, asc, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "./db.ts";
import {
  budgetCategories,
  offeringCounts,
  deposits,
  transactions,
  monthlyCloses,
  monthlyCloseItems,
  contributionBatches,
  contributions,
  users,
  budgetCategorySchema,
  offeringCountSchema,
  depositSchema,
  transactionSchema,
  monthlyCloseCreateSchema,
  closeSignoffSchema,
  MONTHLY_CLOSE_TEMPLATE,
  FINANCE_VIEW_ROLES,
  COUNT_ENTRY_ROLES,
  COUNT_VIEW_ROLES,
  DEPOSIT_MANAGE_ROLES,
  LEDGER_EDIT_ROLES,
  CLOSE_MANAGE_ROLES,
  CLOSE_SIGNOFF_ROLES,
  REPORT_VIEW_ROLES,
  CATEGORY_MANAGE_ROLES,
  type User,
} from "../shared/schema.ts";
import { requireRole } from "./auth.ts";

function getUser(req: Request): User {
  return (req as any).user as User;
}

function firstError(parsed: { error: { errors: { message?: string }[] } }): string {
  return parsed.error.errors[0]?.message ?? "Invalid input";
}

const requireFinanceView = requireRole(...FINANCE_VIEW_ROLES);
const requireCountEntry = requireRole(...COUNT_ENTRY_ROLES);
const requireCountView = requireRole(...COUNT_VIEW_ROLES);
const requireDepositManage = requireRole(...DEPOSIT_MANAGE_ROLES);
const requireLedgerEdit = requireRole(...LEDGER_EDIT_ROLES);
const requireCloseManage = requireRole(...CLOSE_MANAGE_ROLES);
const requireCloseSignoff = requireRole(...CLOSE_SIGNOFF_ROLES);
const requireReportView = requireRole(...REPORT_VIEW_ROLES);
const requireCategoryManage = requireRole(...CATEGORY_MANAGE_ROLES);

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function monthBounds(year: number, month: number): { start: string; end: string } {
  const mm = String(month).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${String(lastDay).padStart(2, "0")}` };
}

export type OpenBatchSummary = {
  id: number;
  batchDate: string;
  description: string | null;
  totalCents: number;
  contributionCount: number;
};

async function getOpenBatchesForMonth(year: number, month: number): Promise<OpenBatchSummary[]> {
  const { start, end } = monthBounds(year, month);
  const rows = await db
    .select({
      id: contributionBatches.id,
      batchDate: contributionBatches.batchDate,
      description: contributionBatches.description,
      totalCents: sql<number>`coalesce(sum(${contributions.amountCents}), 0)::int`,
      contributionCount: sql<number>`count(${contributions.id})::int`,
    })
    .from(contributionBatches)
    .leftJoin(contributions, eq(contributions.batchId, contributionBatches.id))
    .where(
      and(
        eq(contributionBatches.status, "open"),
        gte(contributionBatches.batchDate, start),
        lte(contributionBatches.batchDate, end),
      ),
    )
    .groupBy(contributionBatches.id)
    .orderBy(asc(contributionBatches.batchDate), asc(contributionBatches.id));
  return rows;
}

export function registerFinanceRoutes(app: Express) {
  // ---------- Budget categories ----------
  app.get("/api/finance/categories", requireCountView, async (_req, res) => {
    const rows = await db
      .select()
      .from(budgetCategories)
      .orderBy(asc(budgetCategories.type), asc(budgetCategories.sortOrder), asc(budgetCategories.name));
    res.json({ categories: rows });
  });

  app.post("/api/finance/categories", requireCategoryManage, async (req, res) => {
    const parsed = budgetCategorySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: firstError(parsed) });
    const [created] = await db.insert(budgetCategories).values(parsed.data).returning();
    res.status(201).json({ category: created });
  });

  app.patch("/api/finance/categories/:id", requireCategoryManage, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const parsed = budgetCategorySchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: firstError(parsed) });
    const [updated] = await db
      .update(budgetCategories)
      .set(parsed.data)
      .where(eq(budgetCategories.id, id))
      .returning();
    if (!updated) return res.status(404).json({ message: "Category not found" });
    res.json({ category: updated });
  });

  // ---------- Offering counts ----------
  app.get("/api/finance/counts", requireCountView, async (req, res) => {
    const unlinkedOnly = req.query.unlinked === "1";
    const conditions = unlinkedOnly ? [isNull(offeringCounts.depositId)] : [];
    const rows = await db
      .select({
        count: offeringCounts,
        enteredByName: users.fullName,
      })
      .from(offeringCounts)
      .leftJoin(users, eq(offeringCounts.enteredBy, users.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(offeringCounts.countDate), desc(offeringCounts.id))
      .limit(200);
    const verifierIds = rows
      .map((r) => r.count.verifiedBy)
      .filter((v): v is number => v != null);
    const verifiers = verifierIds.length
      ? await db.select({ id: users.id, fullName: users.fullName }).from(users).where(inArray(users.id, verifierIds))
      : [];
    const verifierMap = new Map(verifiers.map((v) => [v.id, v.fullName]));
    res.json({
      counts: rows.map((r) => ({
        ...r.count,
        totalCents:
          r.count.cashCents + r.count.coinCents + r.count.checksCents + r.count.otherCents,
        enteredByName: r.enteredByName,
        verifiedByName: r.count.verifiedBy ? verifierMap.get(r.count.verifiedBy) ?? null : null,
      })),
    });
  });

  app.post("/api/finance/counts", requireCountEntry, async (req, res) => {
    const parsed = offeringCountSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: firstError(parsed) });
    const d = parsed.data;
    const [created] = await db
      .insert(offeringCounts)
      .values({
        countDate: d.countDate,
        serviceNote: d.serviceNote || null,
        cashCents: d.cashCents,
        coinCents: d.coinCents,
        checksCents: d.checksCents,
        checkCount: d.checkCount,
        otherCents: d.otherCents,
        notes: d.notes || null,
        counter1: d.counter1.trim(),
        counter2: d.counter2.trim(),
        enteredBy: getUser(req).id,
      })
      .returning();
    res.status(201).json({ count: created });
  });

  // Dual-control: a different user must confirm the count.
  app.post("/api/finance/counts/:id/verify", requireCountEntry, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const [row] = await db.select().from(offeringCounts).where(eq(offeringCounts.id, id));
    if (!row) return res.status(404).json({ message: "Count not found" });
    if (row.status === "verified") return res.status(400).json({ message: "This count is already verified" });
    const actor = getUser(req);
    if (row.enteredBy === actor.id) {
      return res
        .status(403)
        .json({ message: "A different person must confirm the count (dual-control)" });
    }
    const [updated] = await db
      .update(offeringCounts)
      .set({ status: "verified", verifiedBy: actor.id, verifiedAt: new Date() })
      .where(eq(offeringCounts.id, id))
      .returning();
    res.json({ count: updated });
  });

  app.patch("/api/finance/counts/:id", requireCountEntry, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const [row] = await db.select().from(offeringCounts).where(eq(offeringCounts.id, id));
    if (!row) return res.status(404).json({ message: "Count not found" });
    if (row.status === "verified") {
      return res.status(400).json({ message: "Verified counts can no longer be edited" });
    }
    const parsed = offeringCountSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: firstError(parsed) });
    const d = parsed.data;
    const [updated] = await db
      .update(offeringCounts)
      .set({
        countDate: d.countDate,
        serviceNote: d.serviceNote || null,
        cashCents: d.cashCents,
        coinCents: d.coinCents,
        checksCents: d.checksCents,
        checkCount: d.checkCount,
        otherCents: d.otherCents,
        notes: d.notes || null,
        counter1: d.counter1.trim(),
        counter2: d.counter2.trim(),
      })
      .where(eq(offeringCounts.id, id))
      .returning();
    res.json({ count: updated });
  });

  // ---------- Deposits ----------
  app.get("/api/finance/deposits", requireFinanceView, async (_req, res) => {
    const rows = await db
      .select()
      .from(deposits)
      .orderBy(desc(deposits.depositDate), desc(deposits.id))
      .limit(200);
    const depositIds = rows.map((r) => r.id);
    const linkedCounts = depositIds.length
      ? await db
          .select({
            id: offeringCounts.id,
            depositId: offeringCounts.depositId,
            countDate: offeringCounts.countDate,
            cashCents: offeringCounts.cashCents,
            coinCents: offeringCounts.coinCents,
            checksCents: offeringCounts.checksCents,
            otherCents: offeringCounts.otherCents,
          })
          .from(offeringCounts)
          .where(inArray(offeringCounts.depositId, depositIds))
      : [];
    res.json({
      deposits: rows.map((dep) => ({
        ...dep,
        counts: linkedCounts
          .filter((c) => c.depositId === dep.id)
          .map((c) => ({
            id: c.id,
            countDate: c.countDate,
            totalCents: c.cashCents + c.coinCents + c.checksCents + c.otherCents,
          })),
      })),
    });
  });

  app.post("/api/finance/deposits", requireDepositManage, async (req, res) => {
    const parsed = depositSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: firstError(parsed) });
    const d = parsed.data;
    if (d.countIds.length) {
      const linked = await db
        .select({ id: offeringCounts.id, depositId: offeringCounts.depositId, status: offeringCounts.status })
        .from(offeringCounts)
        .where(inArray(offeringCounts.id, d.countIds));
      if (linked.length !== d.countIds.length) {
        return res.status(400).json({ message: "One or more selected counts were not found" });
      }
      const alreadyLinked = linked.find((c) => c.depositId != null);
      if (alreadyLinked) {
        return res.status(400).json({ message: `Count #${alreadyLinked.id} is already linked to a deposit` });
      }
      const unverified = linked.find((c) => c.status !== "verified");
      if (unverified) {
        return res.status(400).json({ message: `Count #${unverified.id} must be verified by a second person before it can be deposited` });
      }
    }
    const [created] = await db
      .insert(deposits)
      .values({
        depositDate: d.depositDate,
        amountCents: d.amountCents,
        bankRef: d.bankRef || null,
        notes: d.notes || null,
        recordedBy: getUser(req).id,
      })
      .returning();
    if (d.countIds.length) {
      await db
        .update(offeringCounts)
        .set({ depositId: created.id })
        .where(inArray(offeringCounts.id, d.countIds));
    }
    res.status(201).json({ deposit: created });
  });

  app.post("/api/finance/deposits/:id/reconcile", requireDepositManage, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const [row] = await db.select().from(deposits).where(eq(deposits.id, id));
    if (!row) return res.status(404).json({ message: "Deposit not found" });
    if (row.status === "reconciled") return res.status(400).json({ message: "Deposit is already reconciled" });
    const [updated] = await db
      .update(deposits)
      .set({ status: "reconciled", reconciledBy: getUser(req).id, reconciledAt: new Date() })
      .where(eq(deposits.id, id))
      .returning();
    res.json({ deposit: updated });
  });

  // ---------- Transactions ----------
  app.get("/api/finance/transactions", requireFinanceView, async (req, res) => {
    const conditions = [] as any[];
    const type = String(req.query.type ?? "");
    if (type === "income" || type === "expense") conditions.push(eq(transactions.type, type));
    const categoryId = Number(req.query.categoryId);
    if (Number.isInteger(categoryId) && categoryId > 0) {
      conditions.push(eq(transactions.categoryId, categoryId));
    }
    const search = String(req.query.search ?? "").trim();
    if (search) {
      conditions.push(
        or(ilike(transactions.payee, `%${search}%`), ilike(transactions.memo, `%${search}%`)),
      );
    }
    const month = String(req.query.month ?? ""); // YYYY-MM
    if (/^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split("-").map(Number);
      const start = `${month}-01`;
      const endDate = new Date(Date.UTC(y, m, 0)).getUTCDate();
      conditions.push(gte(transactions.txnDate, start));
      conditions.push(lte(transactions.txnDate, `${month}-${String(endDate).padStart(2, "0")}`));
    }
    const rows = await db
      .select({
        txn: transactions,
        categoryName: budgetCategories.name,
        enteredByName: users.fullName,
      })
      .from(transactions)
      .innerJoin(budgetCategories, eq(transactions.categoryId, budgetCategories.id))
      .leftJoin(users, eq(transactions.enteredBy, users.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(transactions.txnDate), desc(transactions.id))
      .limit(300);
    res.json({
      transactions: rows.map((r) => ({
        ...r.txn,
        categoryName: r.categoryName,
        enteredByName: r.enteredByName,
      })),
    });
  });

  async function validateTxnCategory(categoryId: number, type: string): Promise<string | null> {
    const [cat] = await db.select().from(budgetCategories).where(eq(budgetCategories.id, categoryId));
    if (!cat) return "Category not found";
    if (!cat.isActive) return "That category is inactive";
    if (cat.type !== type) return `"${cat.name}" is an ${cat.type} category — the entry type must match`;
    return null;
  }

  app.post("/api/finance/transactions", requireLedgerEdit, async (req, res) => {
    const parsed = transactionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: firstError(parsed) });
    const d = parsed.data;
    const catError = await validateTxnCategory(d.categoryId, d.type);
    if (catError) return res.status(400).json({ message: catError });
    const [created] = await db
      .insert(transactions)
      .values({
        txnDate: d.txnDate,
        type: d.type,
        categoryId: d.categoryId,
        amountCents: d.amountCents,
        payee: d.payee.trim(),
        memo: d.memo || null,
        enteredBy: getUser(req).id,
      })
      .returning();
    res.status(201).json({ transaction: created });
  });

  app.patch("/api/finance/transactions/:id", requireLedgerEdit, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const parsed = transactionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: firstError(parsed) });
    const d = parsed.data;
    const catError = await validateTxnCategory(d.categoryId, d.type);
    if (catError) return res.status(400).json({ message: catError });
    const [updated] = await db
      .update(transactions)
      .set({
        txnDate: d.txnDate,
        type: d.type,
        categoryId: d.categoryId,
        amountCents: d.amountCents,
        payee: d.payee.trim(),
        memo: d.memo || null,
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, id))
      .returning();
    if (!updated) return res.status(404).json({ message: "Transaction not found" });
    res.json({ transaction: updated });
  });

  app.delete("/api/finance/transactions/:id", requireLedgerEdit, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const [deleted] = await db.delete(transactions).where(eq(transactions.id, id)).returning();
    if (!deleted) return res.status(404).json({ message: "Transaction not found" });
    res.json({ message: "Deleted" });
  });

  // ---------- Monthly close ----------
  app.get("/api/finance/closes", requireFinanceView, async (_req, res) => {
    const rows = await db
      .select({
        close: monthlyCloses,
        signedOffByName: users.fullName,
      })
      .from(monthlyCloses)
      .leftJoin(users, eq(monthlyCloses.signedOffBy, users.id))
      .orderBy(desc(monthlyCloses.year), desc(monthlyCloses.month));
    const closeIds = rows.map((r) => r.close.id);
    const items = closeIds.length
      ? await db
          .select()
          .from(monthlyCloseItems)
          .where(inArray(monthlyCloseItems.closeId, closeIds))
          .orderBy(asc(monthlyCloseItems.sortOrder))
      : [];
    const openBatchesByClose = new Map<number, OpenBatchSummary[]>();
    for (const r of rows) {
      if (r.close.status !== "closed") {
        openBatchesByClose.set(r.close.id, await getOpenBatchesForMonth(r.close.year, r.close.month));
      }
    }
    res.json({
      closes: rows.map((r) => ({
        ...r.close,
        signedOffByName: r.signedOffByName,
        items: items.filter((i) => i.closeId === r.close.id),
        openBatches: openBatchesByClose.get(r.close.id) ?? [],
      })),
    });
  });

  app.post("/api/finance/closes", requireCloseManage, async (req, res) => {
    const parsed = monthlyCloseCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: firstError(parsed) });
    const { year, month } = parsed.data;
    const [existing] = await db
      .select({ id: monthlyCloses.id })
      .from(monthlyCloses)
      .where(and(eq(monthlyCloses.year, year), eq(monthlyCloses.month, month)));
    if (existing) return res.status(409).json({ message: "A close record for that month already exists" });
    const [created] = await db.insert(monthlyCloses).values({ year, month }).returning();
    await db.insert(monthlyCloseItems).values(
      MONTHLY_CLOSE_TEMPLATE.map((label, idx) => ({
        closeId: created.id,
        label,
        sortOrder: idx,
      })),
    );
    const items = await db
      .select()
      .from(monthlyCloseItems)
      .where(eq(monthlyCloseItems.closeId, created.id))
      .orderBy(asc(monthlyCloseItems.sortOrder));
    res.status(201).json({ close: { ...created, items } });
  });

  app.patch("/api/finance/closes/:closeId/items/:itemId", requireCloseManage, async (req, res) => {
    const closeId = parseId(req.params.closeId);
    const itemId = parseId(req.params.itemId);
    if (!closeId || !itemId) return res.status(400).json({ message: "Invalid id" });
    const isDone = req.body?.isDone;
    if (typeof isDone !== "boolean") return res.status(400).json({ message: "isDone must be true or false" });
    const [close] = await db.select().from(monthlyCloses).where(eq(monthlyCloses.id, closeId));
    if (!close) return res.status(404).json({ message: "Close record not found" });
    if (close.status === "closed") {
      return res.status(400).json({ message: "This month has been signed off and can no longer be changed" });
    }
    const actor = getUser(req);
    const [updated] = await db
      .update(monthlyCloseItems)
      .set({
        isDone,
        completedBy: isDone ? actor.id : null,
        completedAt: isDone ? new Date() : null,
      })
      .where(and(eq(monthlyCloseItems.id, itemId), eq(monthlyCloseItems.closeId, closeId)))
      .returning();
    if (!updated) return res.status(404).json({ message: "Checklist item not found" });
    // Move to in_review once any item is checked
    if (close.status === "open" && isDone) {
      await db.update(monthlyCloses).set({ status: "in_review" }).where(eq(monthlyCloses.id, closeId));
    }
    res.json({ item: updated });
  });

  app.post("/api/finance/closes/:id/signoff", requireCloseSignoff, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const parsed = closeSignoffSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ message: firstError(parsed) });
    const [close] = await db.select().from(monthlyCloses).where(eq(monthlyCloses.id, id));
    if (!close) return res.status(404).json({ message: "Close record not found" });
    if (close.status === "closed") return res.status(400).json({ message: "This month is already closed" });
    const items = await db.select().from(monthlyCloseItems).where(eq(monthlyCloseItems.closeId, id));
    const incomplete = items.filter((i) => !i.isDone);
    if (incomplete.length) {
      return res.status(400).json({
        message: `All checklist items must be completed before sign-off (${incomplete.length} remaining)`,
      });
    }
    const openBatches = await getOpenBatchesForMonth(close.year, close.month);
    if (openBatches.length && !parsed.data.acknowledgeOpenBatches) {
      return res.status(409).json({
        message: `${openBatches.length} contribution ${openBatches.length === 1 ? "batch is" : "batches are"} still open for this month. Close them in Giving, or acknowledge to sign off anyway.`,
        openBatches,
      });
    }
    const [updated] = await db
      .update(monthlyCloses)
      .set({
        status: "closed",
        notes: parsed.data.notes || close.notes,
        signedOffBy: getUser(req).id,
        signedOffAt: new Date(),
      })
      .where(eq(monthlyCloses.id, id))
      .returning();
    res.json({ close: updated });
  });

  app.post("/api/finance/closes/:id/reopen", requireCloseSignoff, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const [close] = await db.select().from(monthlyCloses).where(eq(monthlyCloses.id, id));
    if (!close) return res.status(404).json({ message: "Close record not found" });
    if (close.status !== "closed") return res.status(400).json({ message: "Only a closed month can be reopened" });
    const [updated] = await db
      .update(monthlyCloses)
      .set({ status: "in_review", signedOffBy: null, signedOffAt: null })
      .where(eq(monthlyCloses.id, id))
      .returning();
    res.json({ close: updated });
  });

  // ---------- Reports ----------
  app.get("/api/finance/reports/summary", requireReportView, async (req, res) => {
    const now = new Date();
    const year = Math.min(Math.max(Number(req.query.year) || now.getFullYear(), 2000), 2100);
    const priorYear = year - 1;
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;
    const priorStart = `${priorYear}-01-01`;
    const priorEnd = `${priorYear}-12-31`;

    const monthly = await db
      .select({
        month: sql<number>`extract(month from ${transactions.txnDate})::int`,
        type: transactions.type,
        totalCents: sql<number>`coalesce(sum(${transactions.amountCents}), 0)::int`,
      })
      .from(transactions)
      .where(and(gte(transactions.txnDate, yearStart), lte(transactions.txnDate, yearEnd)))
      .groupBy(sql`extract(month from ${transactions.txnDate})`, transactions.type);

    const byCategory = await db
      .select({
        categoryId: transactions.categoryId,
        categoryName: budgetCategories.name,
        type: transactions.type,
        totalCents: sql<number>`coalesce(sum(${transactions.amountCents}), 0)::int`,
      })
      .from(transactions)
      .innerJoin(budgetCategories, eq(transactions.categoryId, budgetCategories.id))
      .where(and(gte(transactions.txnDate, yearStart), lte(transactions.txnDate, yearEnd)))
      .groupBy(transactions.categoryId, budgetCategories.name, transactions.type)
      .orderBy(desc(sql`sum(${transactions.amountCents})`));

    const [ytd] = await db
      .select({
        incomeCents: sql<number>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amountCents} else 0 end), 0)::int`,
        expenseCents: sql<number>`coalesce(sum(case when ${transactions.type} = 'expense' then ${transactions.amountCents} else 0 end), 0)::int`,
      })
      .from(transactions)
      .where(and(gte(transactions.txnDate, yearStart), lte(transactions.txnDate, yearEnd)));

    const [prior] = await db
      .select({
        incomeCents: sql<number>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amountCents} else 0 end), 0)::int`,
        expenseCents: sql<number>`coalesce(sum(case when ${transactions.type} = 'expense' then ${transactions.amountCents} else 0 end), 0)::int`,
      })
      .from(transactions)
      .where(and(gte(transactions.txnDate, priorStart), lte(transactions.txnDate, priorEnd)));

    res.json({
      year,
      priorYear,
      monthly,
      byCategory,
      ytd: ytd ?? { incomeCents: 0, expenseCents: 0 },
      prior: prior ?? { incomeCents: 0, expenseCents: 0 },
    });
  });
}
