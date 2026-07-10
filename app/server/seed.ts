import bcrypt from "bcryptjs";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "./db.ts";
import {
  users,
  announcements,
  checklistTemplates,
  checklistTemplateSteps,
  committees,
  decisions,
  budgetCategories,
  type Role,
} from "../shared/schema.ts";
import { ensureScheduledInstances } from "./checklists.ts";

const SUPER_ADMIN_USERNAME = process.env.SUPER_ADMIN_USERNAME || "kbcadmin";

function generateTempPassword(): string {
  // 16 chars from a URL-safe alphabet, cryptographically random.
  return crypto.randomBytes(12).toString("base64url");
}

export async function seed() {
  const existingSuperAdmin = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "super_admin"));

  if (existingSuperAdmin.length === 0) {
    const tempPassword = process.env.SUPER_ADMIN_TEMP_PASSWORD || generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    await db.insert(users).values({
      username: SUPER_ADMIN_USERNAME,
      passwordHash,
      fullName: "KBC Super Admin",
      role: "super_admin",
      status: "active",
      mustChangePassword: true,
      approvedAt: new Date(),
    });
    if (process.env.SUPER_ADMIN_TEMP_PASSWORD) {
      console.log(
        `[seed] Created initial Super Admin "${SUPER_ADMIN_USERNAME}" using the ` +
          `SUPER_ADMIN_TEMP_PASSWORD environment variable. A password change is required on first login.`,
      );
    } else {
      console.log(
        `[seed] Created initial Super Admin account.\n` +
          `[seed]   Username: ${SUPER_ADMIN_USERNAME}\n` +
          `[seed]   One-time temporary password: ${tempPassword}\n` +
          `[seed] This password is shown only once, in this console. ` +
          `A password change is required on first login.`,
      );
    }
  }

  const existingAnnouncements = await db.select({ id: announcements.id }).from(announcements).limit(1);
  if (existingAnnouncements.length === 0) {
    const [admin] = await db.select().from(users).where(eq(users.username, SUPER_ADMIN_USERNAME));
    await db.insert(announcements).values([
      {
        title: "Welcome to the KBC Operations Portal",
        body: "This is the new online home for Kingsville Baptist Church operations. Members can register for an account to access member-only information. Registrations are reviewed by a church administrator before access is granted.",
        isPublic: true,
        createdBy: admin?.id ?? null,
      },
      {
        title: "Bookkeeper Position Approved",
        body: "On June 28, 2026, the congregation approved adding a paid, part-time Bookkeeper position. The Personnel and Nominating Committees are working together on the hiring process. See the Documentation section for the full details.",
        isPublic: true,
        createdBy: admin?.id ?? null,
      },
      {
        title: "Member Portal Rollout",
        body: "Members: additional tools for finance, giving records, the member directory, and committee work will be added to this portal over the coming months. Watch this space for updates.",
        isPublic: false,
        createdBy: admin?.id ?? null,
      },
    ]);
    console.log("[seed] Created starter announcements.");
  }

  await seedChecklistTemplates();
  await ensureScheduledInstances(true);

  const existingCommittees = await db.select({ id: committees.id }).from(committees).limit(1);
  if (existingCommittees.length === 0) {
    await db.insert(committees).values([
      {
        name: "Finance Committee",
        description:
          "Oversees the church budget, financial controls, and reporting. Responsible for adjusting the budget to fund approved operational needs.",
        isSensitive: false,
      },
      {
        name: "Personnel Committee",
        description:
          "Handles staffing, hiring, and personnel matters. Access to this committee's records is restricted to its members.",
        isSensitive: true,
      },
      {
        name: "Deacons",
        description: "The deacon body providing spiritual leadership and member care.",
        isSensitive: false,
      },
      {
        name: "Nominating Committee",
        description: "Recommends members for committee service and church offices.",
        isSensitive: false,
      },
    ]);
    console.log("[seed] Created starter committees.");
  }

  const existingDecisions = await db.select({ id: decisions.id }).from(decisions).limit(1);
  if (existingDecisions.length === 0) {
    const [superAdmin] = await db.select().from(users).where(eq(users.username, SUPER_ADMIN_USERNAME));
    const allCommittees = await db.select().from(committees);
    const financeId = allCommittees.find((c) => c.name === "Finance Committee")?.id ?? null;

    await db.insert(decisions).values([
      {
        committeeId: null,
        decisionDate: "2026-06-28",
        decision: "Congregation approved adding a paid, part-time Bookkeeper position.",
        owner: "Congregation / Personnel Committee / Nominating Committee / Finance Committee",
        status: "complete",
        notes:
          "Motion tasked Personnel and Nominating Committees to work together to add a paid, part-time Bookkeeper position, not to exceed $150 per week ($18.75 per hour for approximately 8 hours). Personnel Committee has authority to hire; Finance Committee is responsible for adjusting the budget to fund this need.",
        createdBy: superAdmin?.id ?? null,
      },
      {
        committeeId: null,
        decisionDate: "2026-07-06",
        decision: "Repository structure created for KBC financial operations modernization.",
        owner: "Cory Davis",
        status: "complete",
        notes: "Created source-materials, docs, templates, and archive structure.",
        createdBy: superAdmin?.id ?? null,
      },
      {
        committeeId: financeId,
        decisionDate: null,
        decision: "Confirm Treasurer and authorized Bookkeeper / Financial Administrator duty split.",
        owner: "Finance Committee",
        status: "needs_review",
        notes:
          "Personnel Committee owns hiring, but Finance should define duties, access, controls, reporting expectations, and budget impact before hiring materials are finalized.",
        createdBy: superAdmin?.id ?? null,
      },
    ]);
    console.log("[seed] Created starter decision log entries.");
  }

  const existingCategories = await db.select({ id: budgetCategories.id }).from(budgetCategories).limit(1);
  if (existingCategories.length === 0) {
    await db.insert(budgetCategories).values([
      { name: "Offerings — General Fund", type: "income", sortOrder: 0 },
      { name: "Designated Gifts", type: "income", sortOrder: 1 },
      { name: "Other Income", type: "income", sortOrder: 2 },
      { name: "Personnel", type: "expense", sortOrder: 0 },
      { name: "Missions", type: "expense", sortOrder: 1 },
      { name: "Facilities & Utilities", type: "expense", sortOrder: 2 },
      { name: "Ministry & Programs", type: "expense", sortOrder: 3 },
      { name: "Administration", type: "expense", sortOrder: 4 },
      { name: "Other Expense", type: "expense", sortOrder: 5 },
    ]);
    console.log("[seed] Created default budget categories.");
  }
}

type SeedStep = { title: string; role?: Role };

const SEED_TEMPLATES: {
  name: string;
  description: string;
  recurrence: "weekly" | "monthly" | "on_demand";
  steps: SeedStep[];
}[] = [
  {
    name: "Payroll Run",
    description:
      "Recurring payroll coordination checklist based on the documented payroll process. Start one instance per pay period.",
    recurrence: "monthly",
    steps: [
      { title: "Confirm approved compensation and any changes", role: "treasurer" },
      { title: "Verify time or salary inputs", role: "bookkeeper" },
      { title: "Submit payroll through the approved provider or system", role: "bookkeeper" },
      { title: "Record payroll entries in the books", role: "bookkeeper" },
      { title: "File payroll reports and confirmations", role: "bookkeeper" },
      { title: "Review payroll totals during monthly close", role: "treasurer" },
    ],
  },
  {
    name: "Weekly Bookkeeping",
    description: "Weekly bookkeeping routine based on the documented weekly bookkeeping checklist.",
    recurrence: "weekly",
    steps: [
      { title: "Record income", role: "bookkeeper" },
      { title: "Enter bills and expenses", role: "bookkeeper" },
      { title: "Match receipts and supporting documents", role: "bookkeeper" },
      { title: "Prepare payments for approval", role: "bookkeeper" },
      { title: "Review outstanding reimbursement requests", role: "bookkeeper" },
      { title: "Flag exceptions for Treasurer or Finance Committee review", role: "treasurer" },
    ],
  },
  {
    name: "Monthly Close Prep",
    description: "Month-end close routine based on the documented monthly close checklist.",
    recurrence: "monthly",
    steps: [
      { title: "Complete bank reconciliations", role: "bookkeeper" },
      { title: "Review uncleared transactions", role: "bookkeeper" },
      { title: "Verify restricted fund balances", role: "bookkeeper" },
      { title: "Review budget variances", role: "treasurer" },
      { title: "Prepare monthly reports", role: "bookkeeper" },
      { title: "Submit report packet for Treasurer and Finance Committee review", role: "treasurer" },
    ],
  },
  {
    name: "Business Meeting Prep",
    description:
      "Preparation for church business meeting financial reporting, based on the documented business meeting report process and Finance Committee meeting checklist. Start on demand before each business meeting.",
    recurrence: "on_demand",
    steps: [
      { title: "Bookkeeper prepares the monthly packet", role: "bookkeeper" },
      { title: "Treasurer reviews the packet before the meeting", role: "treasurer" },
      { title: "Flag missing receipts, unclear transactions, and unusual items", role: "treasurer" },
      { title: "Finance Committee reviews and resolves questions or exceptions", role: "finance_committee" },
      { title: "Prepare the financial summary for the congregation", role: "finance_committee" },
      { title: "Confirm presenter and present summary at the business meeting", role: "treasurer" },
      { title: "Record motions, approvals, and follow-up items" },
    ],
  },
];

async function seedChecklistTemplates() {
  const existing = await db.select({ id: checklistTemplates.id }).from(checklistTemplates).limit(1);
  if (existing.length > 0) return;

  const [admin] = await db.select().from(users).where(eq(users.username, SUPER_ADMIN_USERNAME));
  for (const t of SEED_TEMPLATES) {
    const [template] = await db
      .insert(checklistTemplates)
      .values({
        name: t.name,
        description: t.description,
        recurrence: t.recurrence,
        isActive: true,
        createdBy: admin?.id ?? null,
      })
      .returning();
    await db.insert(checklistTemplateSteps).values(
      t.steps.map((s, i) => ({
        templateId: template.id,
        position: i + 1,
        title: s.title,
        assignedRole: s.role ?? null,
      })),
    );
  }
  console.log("[seed] Created starter checklist templates from documented procedures.");
}
