import type { Express, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { and, desc, eq, gte, ilike, or, sql, count } from "drizzle-orm";
import { db } from "./db.ts";
import {
  users,
  announcements,
  pageViews,
  registerSchema,
  loginSchema,
  changePasswordSchema,
  announcementSchema,
  assignRoleSchema,
  type User,
} from "../shared/schema.ts";
import { getSessionUser, requireAuth, requireAdmin, toSafeUser } from "./auth.ts";
import { registerChecklistRoutes } from "./checklists.ts";
import { loginBlockedForSeconds, recordLoginFailure, recordLoginSuccess } from "./loginThrottle.ts";
import { notifyNewRegistration } from "./notifications.ts";
import { registerFinanceRoutes } from "./finance.ts";

function getUser(req: Request): User {
  return (req as any).user as User;
}

export function registerRoutes(app: Express) {
  registerChecklistRoutes(app);
  registerFinanceRoutes(app);

  // ---------- Auth ----------
  app.post("/api/auth/register", async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid input" });
    }
    const { username, password, fullName, email, phone } = parsed.data;
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.username}) = lower(${username})`);
    if (existing) {
      return res.status(409).json({ message: "That username is already taken" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const [created] = await db
      .insert(users)
      .values({
        username,
        passwordHash,
        fullName,
        email: email || null,
        phone: phone || null,
        role: "member",
        status: "pending",
      })
      .returning();
    notifyNewRegistration(created);
    res.status(201).json({
      message: "Registration received. An administrator will review your request.",
      user: toSafeUser(created),
    });
  });

  app.post("/api/auth/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid input" });
    }
    const { username, password } = parsed.data;
    const ip = req.ip ?? "unknown";
    const blockedSeconds = await loginBlockedForSeconds(ip, username);
    if (blockedSeconds > 0) {
      const minutes = Math.max(1, Math.ceil(blockedSeconds / 60));
      res.set("Retry-After", String(blockedSeconds));
      return res.status(429).json({
        message: `Too many failed login attempts. Please wait about ${minutes} minute${minutes === 1 ? "" : "s"} and try again.`,
      });
    }
    const [user] = await db
      .select()
      .from(users)
      .where(sql`lower(${users.username}) = lower(${username})`);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      await recordLoginFailure(ip, username);
      return res.status(401).json({ message: "Incorrect username or password" });
    }
    await recordLoginSuccess(ip, username);
    if (user.status === "pending") {
      return res.status(403).json({ message: "Your registration is still awaiting approval by an administrator." });
    }
    if (user.status === "rejected") {
      return res.status(403).json({ message: "Your registration was not approved. Please contact the church office." });
    }
    if (user.status === "deactivated") {
      return res.status(403).json({ message: "This account has been deactivated. Please contact the church office." });
    }
    req.session.userId = user.id;
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
    res.json({ user: toSafeUser({ ...user, lastLoginAt: new Date() }) });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ message: "Not logged in" });
    res.json({ user: toSafeUser(user) });
  });

  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid input" });
    }
    const user = getUser(req);
    const ok = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!ok) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }
    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
    await db
      .update(users)
      .set({ passwordHash, mustChangePassword: false })
      .where(eq(users.id, user.id));
    res.json({ message: "Password updated" });
  });

  // ---------- Announcements ----------
  app.get("/api/announcements", async (req, res) => {
    const user = await getSessionUser(req);
    const rows = user
      ? await db.select().from(announcements).orderBy(desc(announcements.createdAt))
      : await db
          .select()
          .from(announcements)
          .where(eq(announcements.isPublic, true))
          .orderBy(desc(announcements.createdAt));
    res.json({ announcements: rows });
  });

  app.post("/api/admin/announcements", requireAdmin, async (req, res) => {
    const parsed = announcementSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid input" });
    }
    const [created] = await db
      .insert(announcements)
      .values({ ...parsed.data, createdBy: getUser(req).id })
      .returning();
    res.status(201).json({ announcement: created });
  });

  app.patch("/api/admin/announcements/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid id" });
    const parsed = announcementSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid input" });
    }
    const [updated] = await db
      .update(announcements)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(announcements.id, id))
      .returning();
    if (!updated) return res.status(404).json({ message: "Announcement not found" });
    res.json({ announcement: updated });
  });

  app.delete("/api/admin/announcements/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid id" });
    await db.delete(announcements).where(eq(announcements.id, id));
    res.json({ message: "Deleted" });
  });

  // ---------- Admin: user management ----------
  // Rules:
  // - Super Admin can manage everyone (except demoting themselves out of super_admin
  //   if they are the last super admin).
  // - Admin can manage everyone EXCEPT super_admins and other admins.
  function canManage(actor: User, target: User): boolean {
    if (actor.id === target.id) return false;
    if (actor.role === "super_admin") return true;
    if (actor.role === "admin") {
      return target.role !== "super_admin" && target.role !== "admin";
    }
    return false;
  }

  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    const search = String(req.query.search ?? "").trim();
    const status = String(req.query.status ?? "").trim();
    const conditions = [];
    if (search) {
      conditions.push(
        or(
          ilike(users.username, `%${search}%`),
          ilike(users.fullName, `%${search}%`),
          ilike(users.email, `%${search}%`),
        ),
      );
    }
    if (status && ["pending", "active", "rejected", "deactivated"].includes(status)) {
      conditions.push(eq(users.status, status as any));
    }
    const rows = await db
      .select()
      .from(users)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(users.createdAt));
    const actor = getUser(req);
    res.json({
      users: rows.map((u) => ({ ...toSafeUser(u), canManage: canManage(actor, u) })),
    });
  });

  app.get("/api/admin/pending-count", requireAdmin, async (_req, res) => {
    const [row] = await db
      .select({ value: count() })
      .from(users)
      .where(eq(users.status, "pending"));
    res.json({ pendingCount: row?.value ?? 0 });
  });

  async function loadTarget(req: Request, res: Response): Promise<User | null> {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ message: "Invalid user id" });
      return null;
    }
    const [target] = await db.select().from(users).where(eq(users.id, id));
    if (!target) {
      res.status(404).json({ message: "User not found" });
      return null;
    }
    const actor = getUser(req);
    if (!canManage(actor, target)) {
      res.status(403).json({ message: "You do not have permission to manage this user" });
      return null;
    }
    return target;
  }

  app.post("/api/admin/users/:id/approve", requireAdmin, async (req, res) => {
    const target = await loadTarget(req, res);
    if (!target) return;
    if (target.status !== "pending") {
      return res.status(400).json({ message: "Only pending registrations can be approved" });
    }
    const [updated] = await db
      .update(users)
      .set({ status: "active", approvedAt: new Date() })
      .where(eq(users.id, target.id))
      .returning();
    res.json({ user: toSafeUser(updated) });
  });

  app.post("/api/admin/users/:id/reject", requireAdmin, async (req, res) => {
    const target = await loadTarget(req, res);
    if (!target) return;
    if (target.status !== "pending") {
      return res.status(400).json({ message: "Only pending registrations can be rejected" });
    }
    const [updated] = await db
      .update(users)
      .set({ status: "rejected" })
      .where(eq(users.id, target.id))
      .returning();
    res.json({ user: toSafeUser(updated) });
  });

  app.post("/api/admin/users/:id/deactivate", requireAdmin, async (req, res) => {
    const target = await loadTarget(req, res);
    if (!target) return;
    if (target.status !== "active") {
      return res.status(400).json({ message: "Only active accounts can be deactivated" });
    }
    const [updated] = await db
      .update(users)
      .set({ status: "deactivated" })
      .where(eq(users.id, target.id))
      .returning();
    res.json({ user: toSafeUser(updated) });
  });

  app.post("/api/admin/users/:id/reactivate", requireAdmin, async (req, res) => {
    const target = await loadTarget(req, res);
    if (!target) return;
    if (target.status !== "deactivated" && target.status !== "rejected") {
      return res.status(400).json({ message: "Only deactivated or rejected accounts can be reactivated" });
    }
    const [updated] = await db
      .update(users)
      .set({ status: "active", approvedAt: target.approvedAt ?? new Date() })
      .where(eq(users.id, target.id))
      .returning();
    res.json({ user: toSafeUser(updated) });
  });

  app.patch("/api/admin/users/:id/role", requireAdmin, async (req, res) => {
    const parsed = assignRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid role" });
    }
    const target = await loadTarget(req, res);
    if (!target) return;
    const actor = getUser(req);
    const newRole = parsed.data.role;
    if (actor.role === "admin" && (newRole === "super_admin" || newRole === "admin")) {
      return res.status(403).json({ message: "Only a Super Admin can assign Admin or Super Admin roles" });
    }
    const [updated] = await db
      .update(users)
      .set({ role: newRole })
      .where(eq(users.id, target.id))
      .returning();
    res.json({ user: toSafeUser(updated) });
  });

  // ---------- Usage tracking ----------
  app.post("/api/track", async (req, res) => {
    const path = typeof req.body?.path === "string" ? req.body.path.slice(0, 500) : null;
    if (!path || !path.startsWith("/")) {
      return res.status(400).json({ message: "Invalid path" });
    }
    if (!req.session.visitorId) {
      req.session.visitorId = nanoid(21);
    }
    const user = await getSessionUser(req);
    await db.insert(pageViews).values({
      path,
      visitorId: req.session.visitorId,
      role: user ? user.role : "public",
      userId: user?.id ?? null,
    });
    res.json({ ok: true });
  });

  app.get("/api/admin/analytics/summary", requireAdmin, async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const dailyViews = await db
      .select({
        day: sql<string>`to_char(${pageViews.viewedAt}, 'YYYY-MM-DD')`,
        views: count(),
        visitors: sql<number>`count(distinct ${pageViews.visitorId})::int`,
      })
      .from(pageViews)
      .where(gte(pageViews.viewedAt, since))
      .groupBy(sql`to_char(${pageViews.viewedAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${pageViews.viewedAt}, 'YYYY-MM-DD')`);

    const topPages = await db
      .select({ path: pageViews.path, views: count() })
      .from(pageViews)
      .where(gte(pageViews.viewedAt, since))
      .groupBy(pageViews.path)
      .orderBy(desc(count()))
      .limit(10);

    const byRole = await db
      .select({ role: pageViews.role, views: count() })
      .from(pageViews)
      .where(gte(pageViews.viewedAt, since))
      .groupBy(pageViews.role)
      .orderBy(desc(count()));

    const [totals] = await db
      .select({
        totalViews: count(),
        uniqueVisitors: sql<number>`count(distinct ${pageViews.visitorId})::int`,
      })
      .from(pageViews)
      .where(gte(pageViews.viewedAt, since));

    res.json({
      days,
      totals: totals ?? { totalViews: 0, uniqueVisitors: 0 },
      dailyViews,
      topPages,
      byRole,
    });
  });
}
