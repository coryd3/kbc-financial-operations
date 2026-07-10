import type { Express, Request, Response } from "express";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "./db.ts";
import {
  users,
  members,
  households,
  memberSchema,
  selfMemberUpdateSchema,
  householdSchema,
  linkMemberSchema,
  LEADERSHIP_ROLES,
  MEMBER_STATUSES,
  type Member,
  type User,
} from "../shared/schema.ts";
import { requireAuth, requireRole } from "./auth.ts";

const requireLeadership = requireRole(...LEADERSHIP_ROLES);

function getUser(req: Request): User {
  return (req as any).user as User;
}

function isLeadership(user: User): boolean {
  return LEADERSHIP_ROLES.includes(user.role);
}

// Shape a member record for the directory based on the viewer's privileges.
// Leadership sees everything (including notes). A member always sees their own
// full record (minus notes unless leadership). Everyone else gets privacy-
// filtered contact info and no notes.
function toDirectoryMember(member: Member, viewer: User) {
  const leader = isLeadership(viewer);
  const isSelf = member.userId != null && member.userId === viewer.id;
  const base = {
    id: member.id,
    firstName: member.firstName,
    lastName: member.lastName,
    householdId: member.householdId,
    status: member.status,
    joinDate: member.joinDate,
    userId: member.userId,
    hideEmail: member.hideEmail,
    hidePhone: member.hidePhone,
    hideAddress: member.hideAddress,
    email: leader || isSelf || !member.hideEmail ? member.email : null,
    phone: leader || isSelf || !member.hidePhone ? member.phone : null,
    address: leader || isSelf || !member.hideAddress ? member.address : null,
  };
  if (leader) {
    return {
      ...base,
      notes: member.notes,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
    };
  }
  return base;
}

// Build the shared directory filters (search / status / household) from query params.
function buildMemberFilters(req: Request) {
  const search = String(req.query.search ?? "").trim();
  const status = String(req.query.status ?? "").trim();
  const householdId = Number(req.query.householdId);

  const conditions = [];
  if (search) {
    conditions.push(
      or(
        ilike(members.firstName, `%${search}%`),
        ilike(members.lastName, `%${search}%`),
        ilike(sql`${members.firstName} || ' ' || ${members.lastName}`, `%${search}%`),
      ),
    );
  }
  if (status && MEMBER_STATUSES.includes(status as any)) {
    conditions.push(eq(members.status, status as any));
  }
  if (Number.isInteger(householdId) && householdId > 0) {
    conditions.push(eq(members.householdId, householdId));
  }
  return conditions;
}

function csvEscape(value: unknown): string {
  let s = value == null ? "" : String(value);
  // Guard against CSV formula injection: if a cell would be interpreted as a
  // formula by Excel/Sheets (=, +, -, @, or tab/CR at the start), prefix it
  // with a single quote so it is treated as text.
  if (/^[\s]*[=+\-@\t\r]/.test(s)) {
    s = `'${s}`;
  }
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(headers: string[], rows: (unknown[])[]): string {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) lines.push(row.map(csvEscape).join(","));
  // BOM so Excel opens it as UTF-8.
  return "\ufeff" + lines.join("\r\n") + "\r\n";
}

function sendCsv(res: Response, filename: string, csv: string) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
}

function normalizeMemberInput(data: Record<string, any>) {
  const out: Record<string, any> = { ...data };
  for (const key of ["email", "phone", "address", "notes", "joinDate"]) {
    if (key in out && out[key] === "") out[key] = null;
  }
  if ("householdId" in out && !out.householdId) out.householdId = null;
  return out;
}

export function registerMemberRoutes(app: Express) {
  // ---------- Directory (all approved users) ----------
  app.get("/api/members", requireAuth, async (req, res) => {
    const viewer = getUser(req);
    const conditions = buildMemberFilters(req);

    const rows = await db
      .select()
      .from(members)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(members.lastName), asc(members.firstName));

    res.json({ members: rows.map((m) => toDirectoryMember(m, viewer)) });
  });

  // ---------- Directory CSV export (all approved users, privacy-filtered) ----------
  // Never includes leadership notes, even for leadership viewers — this is the
  // member-facing export. Leadership can use the admin export for full data.
  app.get("/api/members/export.csv", requireAuth, async (req, res) => {
    const viewer = getUser(req);
    const conditions = buildMemberFilters(req);

    const rows = await db
      .select()
      .from(members)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(members.lastName), asc(members.firstName));
    const householdRows = await db.select().from(households);
    const householdNames = new Map(householdRows.map((h) => [h.id, h.name]));

    const csvRows = rows.map((m) => {
      const filtered = toDirectoryMember(m, viewer);
      return [
        m.lastName,
        m.firstName,
        m.householdId ? householdNames.get(m.householdId) ?? "" : "",
        m.status,
        filtered.email ?? "",
        filtered.phone ?? "",
        filtered.address ?? "",
        m.joinDate ?? "",
      ];
    });

    sendCsv(
      res,
      "kbc-member-directory.csv",
      toCsv(
        ["Last Name", "First Name", "Household", "Status", "Email", "Phone", "Address", "Join Date"],
        csvRows,
      ),
    );
  });

  // ---------- Households (all approved users, for grouping/filtering) ----------
  // Household addresses are leadership-only: individual members control their
  // own address visibility via hideAddress, so the household address must not
  // bypass that preference for non-leadership viewers.
  app.get("/api/households", requireAuth, async (req, res) => {
    const viewer = getUser(req);
    const rows = await db.select().from(households).orderBy(asc(households.name));
    const leader = isLeadership(viewer);
    res.json({
      households: rows.map((h) => (leader ? h : { ...h, address: null })),
    });
  });

  // ---------- Self-service profile ----------
  app.get("/api/members/me", requireAuth, async (req, res) => {
    const viewer = getUser(req);
    const [row] = await db.select().from(members).where(eq(members.userId, viewer.id));
    if (!row) {
      return res.status(404).json({ message: "No member profile is linked to your account yet." });
    }
    res.json({ member: toDirectoryMember(row, viewer) });
  });

  app.patch("/api/members/me", requireAuth, async (req, res) => {
    const viewer = getUser(req);
    const parsed = selfMemberUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid input" });
    }
    const [existing] = await db.select().from(members).where(eq(members.userId, viewer.id));
    if (!existing) {
      return res.status(404).json({ message: "No member profile is linked to your account yet." });
    }
    const updates = normalizeMemberInput(parsed.data);
    const [updated] = await db
      .update(members)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(members.id, existing.id))
      .returning();
    res.json({ member: toDirectoryMember(updated, viewer) });
  });

  // ---------- Leadership: member management ----------
  // Full-data CSV export for leadership: includes hidden contact info, privacy
  // flags, and leadership notes. Never exposed to non-leadership roles.
  app.get("/api/admin/members/export.csv", requireLeadership, async (req, res) => {
    const conditions = buildMemberFilters(req);

    const rows = await db
      .select()
      .from(members)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(members.lastName), asc(members.firstName));
    const householdRows = await db.select().from(households);
    const householdNames = new Map(householdRows.map((h) => [h.id, h.name]));

    const csvRows = rows.map((m) => [
      m.lastName,
      m.firstName,
      m.householdId ? householdNames.get(m.householdId) ?? "" : "",
      m.status,
      m.email ?? "",
      m.phone ?? "",
      m.address ?? "",
      m.joinDate ?? "",
      m.hideEmail ? "yes" : "no",
      m.hidePhone ? "yes" : "no",
      m.hideAddress ? "yes" : "no",
      m.userId != null ? "yes" : "no",
      m.notes ?? "",
    ]);

    sendCsv(
      res,
      "kbc-members-full.csv",
      toCsv(
        [
          "Last Name",
          "First Name",
          "Household",
          "Status",
          "Email",
          "Phone",
          "Address",
          "Join Date",
          "Email Hidden",
          "Phone Hidden",
          "Address Hidden",
          "Linked Account",
          "Leadership Notes",
        ],
        csvRows,
      ),
    );
  });

  app.post("/api/admin/members", requireLeadership, async (req, res) => {
    const parsed = memberSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid input" });
    }
    const values = normalizeMemberInput(parsed.data);
    if (values.householdId) {
      const [h] = await db.select({ id: households.id }).from(households).where(eq(households.id, values.householdId));
      if (!h) return res.status(400).json({ message: "Household not found" });
    }
    const [created] = await db.insert(members).values(values as any).returning();
    res.status(201).json({ member: created });
  });

  async function loadMember(req: Request, res: Response): Promise<Member | null> {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ message: "Invalid member id" });
      return null;
    }
    const [row] = await db.select().from(members).where(eq(members.id, id));
    if (!row) {
      res.status(404).json({ message: "Member not found" });
      return null;
    }
    return row;
  }

  app.patch("/api/admin/members/:id", requireLeadership, async (req, res) => {
    const target = await loadMember(req, res);
    if (!target) return;
    const parsed = memberSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid input" });
    }
    const updates = normalizeMemberInput(parsed.data);
    if (updates.householdId) {
      const [h] = await db.select({ id: households.id }).from(households).where(eq(households.id, updates.householdId));
      if (!h) return res.status(400).json({ message: "Household not found" });
    }
    const [updated] = await db
      .update(members)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(members.id, target.id))
      .returning();
    res.json({ member: updated });
  });

  app.delete("/api/admin/members/:id", requireLeadership, async (req, res) => {
    const target = await loadMember(req, res);
    if (!target) return;
    await db.delete(members).where(eq(members.id, target.id));
    res.json({ message: "Member deleted" });
  });

  // Link (or unlink with userId: null) a member profile to a registered user account.
  app.post("/api/admin/members/:id/link", requireLeadership, async (req, res) => {
    const target = await loadMember(req, res);
    if (!target) return;
    const parsed = linkMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid user id" });
    }
    const userId = parsed.data.userId;
    if (userId !== null) {
      const [account] = await db.select().from(users).where(eq(users.id, userId));
      if (!account) return res.status(404).json({ message: "User account not found" });
      const [alreadyLinked] = await db
        .select({ id: members.id })
        .from(members)
        .where(eq(members.userId, userId));
      if (alreadyLinked && alreadyLinked.id !== target.id) {
        return res.status(409).json({ message: "That user account is already linked to another member profile" });
      }
    }
    const [updated] = await db
      .update(members)
      .set({ userId, updatedAt: new Date() })
      .where(eq(members.id, target.id))
      .returning();
    res.json({ member: updated });
  });

  // User accounts available for linking (active/pending users not yet linked).
  app.get("/api/admin/linkable-users", requireLeadership, async (_req, res) => {
    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        email: users.email,
        status: users.status,
      })
      .from(users)
      .where(
        and(
          or(eq(users.status, "active"), eq(users.status, "pending")),
          sql`${users.id} not in (select ${members.userId} from ${members} where ${members.userId} is not null)`,
        ),
      )
      .orderBy(asc(users.fullName));
    res.json({ users: rows });
  });

  // ---------- Leadership: household management ----------
  app.post("/api/admin/households", requireLeadership, async (req, res) => {
    const parsed = householdSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid input" });
    }
    const [created] = await db
      .insert(households)
      .values({ name: parsed.data.name, address: parsed.data.address || null })
      .returning();
    res.status(201).json({ household: created });
  });

  app.patch("/api/admin/households/:id", requireLeadership, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid household id" });
    const parsed = householdSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid input" });
    }
    const updates: Record<string, any> = { ...parsed.data };
    if ("address" in updates && updates.address === "") updates.address = null;
    const [updated] = await db
      .update(households)
      .set(updates)
      .where(eq(households.id, id))
      .returning();
    if (!updated) return res.status(404).json({ message: "Household not found" });
    res.json({ household: updated });
  });

  app.delete("/api/admin/households/:id", requireLeadership, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid household id" });
    // Members referencing this household get household_id set to null (FK on delete).
    const [deleted] = await db.delete(households).where(eq(households.id, id)).returning();
    if (!deleted) return res.status(404).json({ message: "Household not found" });
    res.json({ message: "Household deleted" });
  });
}
