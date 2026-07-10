import type { Express, Request, Response } from "express";
import { and, asc, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "./db.ts";
import {
  users,
  committees,
  committeeMembers,
  meetings,
  decisions,
  committeeSchema,
  committeeMemberSchema,
  meetingSchema,
  decisionSchema,
  type User,
  type Committee,
} from "../shared/schema.ts";
import { requireAuth, requireAdmin } from "./auth.ts";

function getUser(req: Request): User {
  return (req as any).user as User;
}

const LEADERSHIP_ROLES = ["super_admin", "admin", "deacon"] as const;

function isLeadership(user: User): boolean {
  return (LEADERSHIP_ROLES as readonly string[]).includes(user.role);
}

function isAdminRole(user: User): boolean {
  return user.role === "super_admin" || user.role === "admin";
}

async function getMembership(userId: number, committeeId: number) {
  const [row] = await db
    .select()
    .from(committeeMembers)
    .where(and(eq(committeeMembers.committeeId, committeeId), eq(committeeMembers.userId, userId)));
  return row ?? null;
}

// Visibility rules:
// - Sensitive committees (e.g. Personnel): only committee members + Super Admin.
// - Other committees: committee members, plus leadership (Super Admin, Admin, Deacon).
async function canViewCommittee(user: User, committee: Committee): Promise<boolean> {
  if (user.role === "super_admin") return true;
  const membership = await getMembership(user.id, committee.id);
  if (membership) return true;
  if (committee.isSensitive) return false;
  return isLeadership(user);
}

// Management rules (roster, meetings, decisions):
// - Sensitive committees: Super Admin, or the committee's chair/secretary.
// - Other committees: Admin/Super Admin, or the committee's chair/secretary.
async function canManageCommittee(user: User, committee: Committee): Promise<boolean> {
  if (user.role === "super_admin") return true;
  const membership = await getMembership(user.id, committee.id);
  if (membership && (membership.position === "chair" || membership.position === "secretary")) {
    return true;
  }
  if (committee.isSensitive) return false;
  return isAdminRole(user);
}

async function loadCommittee(req: Request, res: Response): Promise<Committee | null> {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ message: "Invalid committee id" });
    return null;
  }
  const [committee] = await db.select().from(committees).where(eq(committees.id, id));
  if (!committee) {
    res.status(404).json({ message: "Committee not found" });
    return null;
  }
  return committee;
}

async function visibleCommitteeIds(user: User): Promise<number[]> {
  const all = await db.select().from(committees);
  if (user.role === "super_admin") return all.map((c) => c.id);
  const memberships = await db
    .select({ committeeId: committeeMembers.committeeId })
    .from(committeeMembers)
    .where(eq(committeeMembers.userId, user.id));
  const memberOf = new Set(memberships.map((m) => m.committeeId));
  return all
    .filter((c) => memberOf.has(c.id) || (!c.isSensitive && isLeadership(user)))
    .map((c) => c.id);
}

function emptyToNull(value: string | null | undefined): string | null {
  return value ? value : null;
}

export function registerGovernanceRoutes(app: Express) {
  // ---------- Committees ----------
  app.get("/api/committees", requireAuth, async (req, res) => {
    const user = getUser(req);
    const all = await db.select().from(committees).orderBy(asc(committees.name));
    const memberships = await db
      .select()
      .from(committeeMembers)
      .where(eq(committeeMembers.userId, user.id));
    const membershipByCommittee = new Map(memberships.map((m) => [m.committeeId, m]));

    const memberCounts = await db
      .select({ committeeId: committeeMembers.committeeId, count: sql<number>`count(*)::int` })
      .from(committeeMembers)
      .groupBy(committeeMembers.committeeId);
    const countByCommittee = new Map(memberCounts.map((r) => [r.committeeId, r.count]));

    const result = [];
    for (const committee of all) {
      const membership = membershipByCommittee.get(committee.id) ?? null;
      const canView =
        user.role === "super_admin" ||
        !!membership ||
        (!committee.isSensitive && isLeadership(user));
      if (!canView) continue;
      result.push({
        ...committee,
        memberCount: countByCommittee.get(committee.id) ?? 0,
        myPosition: membership?.position ?? null,
        canManage: await canManageCommittee(user, committee),
      });
    }
    res.json({ committees: result, canCreate: isAdminRole(user) });
  });

  app.post("/api/committees", requireAdmin, async (req, res) => {
    const parsed = committeeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid input" });
    }
    const [existing] = await db
      .select({ id: committees.id })
      .from(committees)
      .where(sql`lower(${committees.name}) = lower(${parsed.data.name})`);
    if (existing) {
      return res.status(409).json({ message: "A committee with that name already exists" });
    }
    const [created] = await db
      .insert(committees)
      .values({
        name: parsed.data.name,
        description: emptyToNull(parsed.data.description),
        isSensitive: parsed.data.isSensitive,
      })
      .returning();
    res.status(201).json({ committee: created });
  });

  app.patch("/api/committees/:id", requireAuth, async (req, res) => {
    const committee = await loadCommittee(req, res);
    if (!committee) return;
    const user = getUser(req);
    if (!(await canManageCommittee(user, committee))) {
      return res.status(403).json({ message: "You do not have permission to edit this committee" });
    }
    const parsed = committeeSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid input" });
    }
    const updates: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.description !== undefined) updates.description = emptyToNull(parsed.data.description);
    if (parsed.data.isSensitive !== undefined) updates.isSensitive = parsed.data.isSensitive;
    const [updated] = await db
      .update(committees)
      .set(updates)
      .where(eq(committees.id, committee.id))
      .returning();
    res.json({ committee: updated });
  });

  app.delete("/api/committees/:id", requireAdmin, async (req, res) => {
    const committee = await loadCommittee(req, res);
    if (!committee) return;
    const user = getUser(req);
    if (committee.isSensitive && user.role !== "super_admin") {
      return res.status(403).json({ message: "Only a Super Admin can delete a restricted committee" });
    }
    await db.delete(committees).where(eq(committees.id, committee.id));
    res.json({ message: "Deleted" });
  });

  // ---------- Committee detail (roster + meetings + decisions) ----------
  app.get("/api/committees/:id", requireAuth, async (req, res) => {
    const committee = await loadCommittee(req, res);
    if (!committee) return;
    const user = getUser(req);
    if (!(await canViewCommittee(user, committee))) {
      return res.status(403).json({ message: "You do not have access to this committee" });
    }

    const roster = await db
      .select({
        id: committeeMembers.id,
        userId: committeeMembers.userId,
        position: committeeMembers.position,
        termStart: committeeMembers.termStart,
        termEnd: committeeMembers.termEnd,
        fullName: users.fullName,
        username: users.username,
        email: users.email,
      })
      .from(committeeMembers)
      .innerJoin(users, eq(committeeMembers.userId, users.id))
      .where(eq(committeeMembers.committeeId, committee.id))
      .orderBy(asc(committeeMembers.position), asc(users.fullName));

    const meetingRows = await db
      .select()
      .from(meetings)
      .where(eq(meetings.committeeId, committee.id))
      .orderBy(desc(meetings.meetingDate));

    const decisionRows = await db
      .select()
      .from(decisions)
      .where(eq(decisions.committeeId, committee.id))
      .orderBy(desc(decisions.decisionDate));

    res.json({
      committee,
      roster,
      meetings: meetingRows,
      decisions: decisionRows,
      canManage: await canManageCommittee(user, committee),
    });
  });

  // ---------- Roster management ----------
  app.post("/api/committees/:id/members", requireAuth, async (req, res) => {
    const committee = await loadCommittee(req, res);
    if (!committee) return;
    const user = getUser(req);
    if (!(await canManageCommittee(user, committee))) {
      return res.status(403).json({ message: "You do not have permission to manage this committee's roster" });
    }
    const parsed = committeeMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid input" });
    }
    const [target] = await db.select().from(users).where(eq(users.id, parsed.data.userId));
    if (!target || target.status !== "active") {
      return res.status(400).json({ message: "Selected user is not an active member" });
    }
    const existing = await getMembership(parsed.data.userId, committee.id);
    if (existing) {
      return res.status(409).json({ message: "That person is already on this committee" });
    }
    const [created] = await db
      .insert(committeeMembers)
      .values({
        committeeId: committee.id,
        userId: parsed.data.userId,
        position: parsed.data.position,
        termStart: emptyToNull(parsed.data.termStart),
        termEnd: emptyToNull(parsed.data.termEnd),
      })
      .returning();
    res.status(201).json({ member: created });
  });

  app.patch("/api/committees/:id/members/:memberId", requireAuth, async (req, res) => {
    const committee = await loadCommittee(req, res);
    if (!committee) return;
    const user = getUser(req);
    if (!(await canManageCommittee(user, committee))) {
      return res.status(403).json({ message: "You do not have permission to manage this committee's roster" });
    }
    const memberId = Number(req.params.memberId);
    if (!Number.isInteger(memberId)) return res.status(400).json({ message: "Invalid member id" });
    const parsed = committeeMemberSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid input" });
    }
    const updates: Record<string, unknown> = {};
    if (parsed.data.position !== undefined) updates.position = parsed.data.position;
    if (parsed.data.termStart !== undefined) updates.termStart = emptyToNull(parsed.data.termStart);
    if (parsed.data.termEnd !== undefined) updates.termEnd = emptyToNull(parsed.data.termEnd);
    const [updated] = await db
      .update(committeeMembers)
      .set(updates)
      .where(and(eq(committeeMembers.id, memberId), eq(committeeMembers.committeeId, committee.id)))
      .returning();
    if (!updated) return res.status(404).json({ message: "Roster entry not found" });
    res.json({ member: updated });
  });

  app.delete("/api/committees/:id/members/:memberId", requireAuth, async (req, res) => {
    const committee = await loadCommittee(req, res);
    if (!committee) return;
    const user = getUser(req);
    if (!(await canManageCommittee(user, committee))) {
      return res.status(403).json({ message: "You do not have permission to manage this committee's roster" });
    }
    const memberId = Number(req.params.memberId);
    if (!Number.isInteger(memberId)) return res.status(400).json({ message: "Invalid member id" });
    await db
      .delete(committeeMembers)
      .where(and(eq(committeeMembers.id, memberId), eq(committeeMembers.committeeId, committee.id)));
    res.json({ message: "Removed" });
  });

  // ---------- Eligible users for roster (active users) ----------
  app.get("/api/committees/:id/eligible-users", requireAuth, async (req, res) => {
    const committee = await loadCommittee(req, res);
    if (!committee) return;
    const user = getUser(req);
    if (!(await canManageCommittee(user, committee))) {
      return res.status(403).json({ message: "You do not have permission to manage this committee's roster" });
    }
    const existing = await db
      .select({ userId: committeeMembers.userId })
      .from(committeeMembers)
      .where(eq(committeeMembers.committeeId, committee.id));
    const excludeIds = existing.map((m) => m.userId);
    const rows = await db
      .select({ id: users.id, fullName: users.fullName, username: users.username, role: users.role })
      .from(users)
      .where(eq(users.status, "active"))
      .orderBy(asc(users.fullName));
    res.json({ users: rows.filter((u) => !excludeIds.includes(u.id)) });
  });

  // ---------- Meetings ----------
  app.post("/api/committees/:id/meetings", requireAuth, async (req, res) => {
    const committee = await loadCommittee(req, res);
    if (!committee) return;
    const user = getUser(req);
    if (!(await canManageCommittee(user, committee))) {
      return res.status(403).json({ message: "You do not have permission to record meetings for this committee" });
    }
    const parsed = meetingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid input" });
    }
    const [created] = await db
      .insert(meetings)
      .values({
        committeeId: committee.id,
        title: parsed.data.title,
        meetingDate: parsed.data.meetingDate,
        attendees: emptyToNull(parsed.data.attendees),
        agenda: emptyToNull(parsed.data.agenda),
        minutes: emptyToNull(parsed.data.minutes),
        createdBy: user.id,
      })
      .returning();
    res.status(201).json({ meeting: created });
  });

  app.patch("/api/committees/:id/meetings/:meetingId", requireAuth, async (req, res) => {
    const committee = await loadCommittee(req, res);
    if (!committee) return;
    const user = getUser(req);
    if (!(await canManageCommittee(user, committee))) {
      return res.status(403).json({ message: "You do not have permission to edit meetings for this committee" });
    }
    const meetingId = Number(req.params.meetingId);
    if (!Number.isInteger(meetingId)) return res.status(400).json({ message: "Invalid meeting id" });
    const parsed = meetingSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid input" });
    }
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.title !== undefined) updates.title = parsed.data.title;
    if (parsed.data.meetingDate !== undefined) updates.meetingDate = parsed.data.meetingDate;
    if (parsed.data.attendees !== undefined) updates.attendees = emptyToNull(parsed.data.attendees);
    if (parsed.data.agenda !== undefined) updates.agenda = emptyToNull(parsed.data.agenda);
    if (parsed.data.minutes !== undefined) updates.minutes = emptyToNull(parsed.data.minutes);
    const [updated] = await db
      .update(meetings)
      .set(updates)
      .where(and(eq(meetings.id, meetingId), eq(meetings.committeeId, committee.id)))
      .returning();
    if (!updated) return res.status(404).json({ message: "Meeting not found" });
    res.json({ meeting: updated });
  });

  app.delete("/api/committees/:id/meetings/:meetingId", requireAuth, async (req, res) => {
    const committee = await loadCommittee(req, res);
    if (!committee) return;
    const user = getUser(req);
    if (!(await canManageCommittee(user, committee))) {
      return res.status(403).json({ message: "You do not have permission to delete meetings for this committee" });
    }
    const meetingId = Number(req.params.meetingId);
    if (!Number.isInteger(meetingId)) return res.status(400).json({ message: "Invalid meeting id" });
    await db
      .delete(meetings)
      .where(and(eq(meetings.id, meetingId), eq(meetings.committeeId, committee.id)));
    res.json({ message: "Deleted" });
  });

  // ---------- Decision log ----------
  // Global log: decisions from committees the user can see, plus
  // congregation-level decisions (no committee) visible to all logged-in users.
  app.get("/api/decisions", requireAuth, async (req, res) => {
    const user = getUser(req);
    const ids = await visibleCommitteeIds(user);
    const conditions = [sql`${decisions.committeeId} is null`];
    if (ids.length) conditions.push(inArray(decisions.committeeId, ids));

    const rows = await db
      .select({
        id: decisions.id,
        committeeId: decisions.committeeId,
        meetingId: decisions.meetingId,
        decisionDate: decisions.decisionDate,
        decision: decisions.decision,
        owner: decisions.owner,
        status: decisions.status,
        notes: decisions.notes,
        createdAt: decisions.createdAt,
        committeeName: committees.name,
        meetingTitle: meetings.title,
        meetingDate: meetings.meetingDate,
      })
      .from(decisions)
      .leftJoin(committees, eq(decisions.committeeId, committees.id))
      .leftJoin(meetings, eq(decisions.meetingId, meetings.id))
      .where(sql`(${sql.join(conditions, sql` or `)})`)
      .orderBy(desc(decisions.decisionDate), desc(decisions.createdAt));

    const manageable = new Set<number>();
    for (const id of ids) {
      const [committee] = await db.select().from(committees).where(eq(committees.id, id));
      if (committee && (await canManageCommittee(user, committee))) manageable.add(id);
    }

    res.json({
      decisions: rows.map((r) => ({
        ...r,
        canManage: r.committeeId ? manageable.has(r.committeeId) : isAdminRole(user),
      })),
      committees: (
        await db.select().from(committees).where(ids.length ? inArray(committees.id, ids) : sql`false`)
      ).map((c) => ({ id: c.id, name: c.name })),
      canCreateGeneral: isAdminRole(user),
    });
  });

  app.post("/api/decisions", requireAuth, async (req, res) => {
    const user = getUser(req);
    const parsed = decisionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid input" });
    }
    const data = parsed.data;
    let committeeId: number | null = data.committeeId ?? null;
    let meetingId: number | null = data.meetingId ?? null;

    if (meetingId) {
      const [meeting] = await db.select().from(meetings).where(eq(meetings.id, meetingId));
      if (!meeting) return res.status(400).json({ message: "Linked meeting not found" });
      if (committeeId && committeeId !== meeting.committeeId) {
        return res.status(400).json({ message: "Linked meeting belongs to a different committee" });
      }
      committeeId = meeting.committeeId;
    }

    if (committeeId) {
      const [committee] = await db.select().from(committees).where(eq(committees.id, committeeId));
      if (!committee) return res.status(400).json({ message: "Committee not found" });
      if (!(await canManageCommittee(user, committee))) {
        return res.status(403).json({ message: "You do not have permission to record decisions for this committee" });
      }
    } else if (!isAdminRole(user)) {
      return res.status(403).json({ message: "Only admins can record congregation-level decisions" });
    }

    const [created] = await db
      .insert(decisions)
      .values({
        committeeId,
        meetingId,
        decisionDate: emptyToNull(data.decisionDate),
        decision: data.decision,
        owner: emptyToNull(data.owner),
        status: data.status,
        notes: emptyToNull(data.notes),
        createdBy: user.id,
      })
      .returning();
    res.status(201).json({ decision: created });
  });

  async function loadDecisionForManage(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ message: "Invalid decision id" });
      return null;
    }
    const [decision] = await db.select().from(decisions).where(eq(decisions.id, id));
    if (!decision) {
      res.status(404).json({ message: "Decision not found" });
      return null;
    }
    const user = getUser(req);
    if (decision.committeeId) {
      const [committee] = await db.select().from(committees).where(eq(committees.id, decision.committeeId));
      if (!committee || !(await canManageCommittee(user, committee))) {
        res.status(403).json({ message: "You do not have permission to manage this decision" });
        return null;
      }
    } else if (!isAdminRole(user)) {
      res.status(403).json({ message: "Only admins can manage congregation-level decisions" });
      return null;
    }
    return decision;
  }

  app.patch("/api/decisions/:id", requireAuth, async (req, res) => {
    const decision = await loadDecisionForManage(req, res);
    if (!decision) return;
    const parsed = decisionSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid input" });
    }
    const data = parsed.data;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.decisionDate !== undefined) updates.decisionDate = emptyToNull(data.decisionDate);
    if (data.decision !== undefined) updates.decision = data.decision;
    if (data.owner !== undefined) updates.owner = emptyToNull(data.owner);
    if (data.status !== undefined) updates.status = data.status;
    if (data.notes !== undefined) updates.notes = emptyToNull(data.notes);
    if (data.meetingId !== undefined) {
      if (data.meetingId) {
        if (!decision.committeeId) {
          return res.status(400).json({
            message: "Congregation-level decisions cannot be linked to a committee meeting",
          });
        }
        const [meeting] = await db.select().from(meetings).where(eq(meetings.id, data.meetingId));
        if (!meeting) return res.status(400).json({ message: "Linked meeting not found" });
        if (meeting.committeeId !== decision.committeeId) {
          return res.status(400).json({ message: "Linked meeting belongs to a different committee" });
        }
        updates.meetingId = data.meetingId;
      } else {
        updates.meetingId = null;
      }
    }
    const [updated] = await db
      .update(decisions)
      .set(updates)
      .where(eq(decisions.id, decision.id))
      .returning();
    res.json({ decision: updated });
  });

  app.delete("/api/decisions/:id", requireAuth, async (req, res) => {
    const decision = await loadDecisionForManage(req, res);
    if (!decision) return;
    await db.delete(decisions).where(eq(decisions.id, decision.id));
    res.json({ message: "Deleted" });
  });

  // ---------- Dashboard: my committees + upcoming/recent meetings ----------
  app.get("/api/governance/overview", requireAuth, async (req, res) => {
    const user = getUser(req);
    const memberships = await db
      .select({
        committeeId: committeeMembers.committeeId,
        position: committeeMembers.position,
        termStart: committeeMembers.termStart,
        termEnd: committeeMembers.termEnd,
        name: committees.name,
        isSensitive: committees.isSensitive,
      })
      .from(committeeMembers)
      .innerJoin(committees, eq(committeeMembers.committeeId, committees.id))
      .where(eq(committeeMembers.userId, user.id))
      .orderBy(asc(committees.name));

    const ids = await visibleCommitteeIds(user);
    const today = new Date().toISOString().slice(0, 10);

    let upcoming: any[] = [];
    let recent: any[] = [];
    if (ids.length) {
      upcoming = await db
        .select({
          id: meetings.id,
          committeeId: meetings.committeeId,
          committeeName: committees.name,
          title: meetings.title,
          meetingDate: meetings.meetingDate,
        })
        .from(meetings)
        .innerJoin(committees, eq(meetings.committeeId, committees.id))
        .where(and(inArray(meetings.committeeId, ids), gte(meetings.meetingDate, today)))
        .orderBy(asc(meetings.meetingDate))
        .limit(5);

      recent = await db
        .select({
          id: meetings.id,
          committeeId: meetings.committeeId,
          committeeName: committees.name,
          title: meetings.title,
          meetingDate: meetings.meetingDate,
        })
        .from(meetings)
        .innerJoin(committees, eq(meetings.committeeId, committees.id))
        .where(and(inArray(meetings.committeeId, ids), lt(meetings.meetingDate, today)))
        .orderBy(desc(meetings.meetingDate))
        .limit(5);
    }

    res.json({ myCommittees: memberships, upcomingMeetings: upcoming, recentMeetings: recent });
  });
}
