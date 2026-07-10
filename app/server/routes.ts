import type { Express, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { and, desc, eq, gte, ilike, or, sql, count, inArray, isNull } from "drizzle-orm";
import { db } from "./db.ts";
import {
  users,
  userRoles,
  mfaRecoveryCodes,
  passwordResetCodes,
  announcements,
  pageViews,
  registerSchema,
  loginSchema,
  changePasswordSchema,
  passwordResetSchema,
  announcementSchema,
  assignRoleSchema,
  assignRolesSchema,
  type AuthenticatedUser,
  type Role,
  type User,
} from "../shared/schema.ts";
import {
  getSessionUser,
  hasRole,
  requireAuth,
  requireAdmin,
  requiresMfa,
  toSafeUser,
} from "./auth.ts";
import { registerChecklistRoutes } from "./checklists.ts";
import { loginBlockedForSeconds, recordLoginFailure, recordLoginSuccess } from "./loginThrottle.ts";
import { notifyNewRegistration } from "./notifications.ts";
import { registerFinanceRoutes } from "./finance.ts";
import { registerContributionRoutes } from "./contributions.ts";
import { registerDocsRoutes } from "./docs.ts";
import { recordAuditEvent } from "./audit.ts";
import {
  decryptMfaSecret,
  encryptMfaSecret,
  generateMfaSecret,
  generateRecoveryCodes,
  hashRecoveryCodes,
  mfaQrDataUrl,
  verifyMfaToken,
} from "./mfa.ts";
import { rateLimit } from "./rateLimit.ts";

function getUser(req: Request): AuthenticatedUser {
  return (req as any).user as AuthenticatedUser;
}

const passwordActionLimit = rateLimit({ name: "password-action", limit: 10, windowMs: 15 * 60_000 });
const mfaActionLimit = rateLimit({ name: "mfa-action", limit: 10, windowMs: 15 * 60_000 });
const registrationLimit = rateLimit({ name: "registration", limit: 5, windowMs: 60 * 60_000 });

async function rolesForUser(user: User): Promise<Role[]> {
  const rows = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, user.id));
  return rows.length ? rows.map((row) => row.role) : [user.role];
}

function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => req.session.regenerate((error) => (error ? reject(error) : resolve())));
}

export function registerRoutes(app: Express) {
  registerChecklistRoutes(app);
  registerFinanceRoutes(app);
  registerContributionRoutes(app);
  registerDocsRoutes(app);

  // ---------- Auth ----------
  app.post("/api/auth/register", registrationLimit, async (req, res) => {
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
    await db.insert(userRoles).values({ userId: created.id, role: "member" });
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
    const roles = await rolesForUser(user);
    await regenerateSession(req);
    req.session.userId = user.id;
    req.session.sessionVersion = user.sessionVersion;
    req.session.mfaVerified = !requiresMfa({ roles });
    req.session.cookie.maxAge = roles.some((role) => ["super_admin", "admin", "treasurer", "bookkeeper"].includes(role))
      ? 12 * 60 * 60_000
      : 7 * 24 * 60 * 60_000;
    const lastLoginAt = new Date();
    await db.update(users).set({ lastLoginAt }).where(eq(users.id, user.id));
    await recordAuditEvent(req, "auth.login", { actorUserId: user.id, entityType: "user", entityId: user.id });
    res.json({
      user: toSafeUser({ ...user, lastLoginAt }, roles),
      mfaRequired: requiresMfa({ roles }) && user.mfaEnabled,
      mfaSetupRequired: requiresMfa({ roles }) && !user.mfaEnabled,
    });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ message: "Not logged in" });
    res.json({
      user: toSafeUser(user),
      mfaRequired: requiresMfa(user),
      mfaVerified: Boolean(req.session.mfaVerified),
    });
  });

  app.post("/api/auth/change-password", passwordActionLimit, async (req, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid input" });
    }
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ message: "Not logged in" });
    const ok = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!ok) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }
    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
    const [updated] = await db
      .update(users)
      .set({
        passwordHash,
        mustChangePassword: false,
        sessionVersion: sql`${users.sessionVersion} + 1`,
      })
      .where(eq(users.id, user.id))
      .returning();
    req.session.sessionVersion = updated.sessionVersion;
    await recordAuditEvent(req, "auth.password_changed", { entityType: "user", entityId: user.id });
    res.json({ message: "Password updated" });
  });

  app.post("/api/auth/reset-password", passwordActionLimit, async (req, res) => {
    const parsed = passwordResetSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid reset request" });
    const [user] = await db
      .select()
      .from(users)
      .where(sql`lower(${users.username}) = lower(${parsed.data.username})`);
    if (!user) return res.status(400).json({ message: "Invalid or expired reset code" });
    const candidates = await db
      .select()
      .from(passwordResetCodes)
      .where(
        and(
          eq(passwordResetCodes.userId, user.id),
          isNull(passwordResetCodes.usedAt),
          gte(passwordResetCodes.expiresAt, new Date()),
        ),
      );
    let match: (typeof candidates)[number] | undefined;
    for (const candidate of candidates) {
      if (await bcrypt.compare(parsed.data.resetCode, candidate.codeHash)) {
        match = candidate;
        break;
      }
    }
    if (!match) return res.status(400).json({ message: "Invalid or expired reset code" });
    await db.transaction(async (tx) => {
      await tx.update(passwordResetCodes).set({ usedAt: new Date() }).where(eq(passwordResetCodes.id, match.id));
      await tx
        .update(users)
        .set({
          passwordHash: await bcrypt.hash(parsed.data.newPassword, 12),
          mustChangePassword: false,
          sessionVersion: sql`${users.sessionVersion} + 1`,
        })
        .where(eq(users.id, user.id));
    });
    await recordAuditEvent(req, "auth.password_reset_used", {
      actorUserId: user.id,
      entityType: "user",
      entityId: user.id,
    });
    await recordLoginSuccess(req.ip ?? "", user.username);
    res.json({ message: "Password reset. You can now sign in." });
  });

  app.get("/api/auth/mfa/setup", mfaActionLimit, async (req, res) => {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ message: "Not logged in" });
    if (user.mfaEnabled) return res.status(409).json({ message: "MFA is already enabled" });
    const secret = generateMfaSecret();
    await db.update(users).set({ mfaSecretEncrypted: encryptMfaSecret(secret) }).where(eq(users.id, user.id));
    res.json({ secret, qrDataUrl: await mfaQrDataUrl(user.username, secret) });
  });

  app.post("/api/auth/mfa/enable", mfaActionLimit, async (req, res) => {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ message: "Not logged in" });
    const token = String(req.body?.token ?? "");
    if (!user.mfaSecretEncrypted || !verifyMfaToken(decryptMfaSecret(user.mfaSecretEncrypted), token)) {
      return res.status(400).json({ message: "That verification code is not valid" });
    }
    const recoveryCodes = generateRecoveryCodes();
    const hashes = await hashRecoveryCodes(recoveryCodes);
    const [updated] = await db.transaction(async (tx) => {
      await tx.delete(mfaRecoveryCodes).where(eq(mfaRecoveryCodes.userId, user.id));
      await tx.insert(mfaRecoveryCodes).values(hashes.map((codeHash) => ({ userId: user.id, codeHash })));
      return tx
        .update(users)
        .set({ mfaEnabled: true, sessionVersion: sql`${users.sessionVersion} + 1` })
        .where(eq(users.id, user.id))
        .returning();
    });
    req.session.sessionVersion = updated.sessionVersion;
    req.session.mfaVerified = true;
    await recordAuditEvent(req, "auth.mfa_enabled", { entityType: "user", entityId: user.id });
    res.json({ message: "Multi-factor authentication enabled", recoveryCodes });
  });

  app.post("/api/auth/mfa/verify", mfaActionLimit, async (req, res) => {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ message: "Not logged in" });
    if (!user.mfaEnabled || !user.mfaSecretEncrypted) {
      return res.status(400).json({ message: "MFA has not been set up" });
    }
    const token = String(req.body?.token ?? "").trim();
    let verified = verifyMfaToken(decryptMfaSecret(user.mfaSecretEncrypted), token);
    if (!verified) {
      const recoveryRows = await db
        .select()
        .from(mfaRecoveryCodes)
        .where(and(eq(mfaRecoveryCodes.userId, user.id), isNull(mfaRecoveryCodes.usedAt)));
      for (const row of recoveryRows) {
        if (await bcrypt.compare(token.toUpperCase(), row.codeHash)) {
          await db.update(mfaRecoveryCodes).set({ usedAt: new Date() }).where(eq(mfaRecoveryCodes.id, row.id));
          verified = true;
          break;
        }
      }
    }
    if (!verified) return res.status(400).json({ message: "That verification code is not valid" });
    req.session.mfaVerified = true;
    res.json({ user: toSafeUser(user) });
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
  function canManage(actor: AuthenticatedUser, target: User, targetRoles: Role[]): boolean {
    if (actor.id === target.id) return false;
    if (hasRole(actor, "super_admin")) return true;
    if (hasRole(actor, "admin")) {
      return !targetRoles.some((role) => role === "super_admin" || role === "admin");
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
    const assigned = await db.select().from(userRoles);
    const rolesByUser = new Map<number, Role[]>();
    for (const row of assigned) {
      rolesByUser.set(row.userId, [...(rolesByUser.get(row.userId) ?? []), row.role]);
    }
    res.json({
      users: rows.map((u) => {
        const roles = rolesByUser.get(u.id) ?? [u.role];
        return { ...toSafeUser(u, roles), canManage: canManage(actor, u, roles) };
      }),
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
    const targetRoles = await rolesForUser(target);
    if (!canManage(actor, target, targetRoles)) {
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
      .set({ status: "active", approvedAt: new Date(), sessionVersion: sql`${users.sessionVersion} + 1` })
      .where(eq(users.id, target.id))
      .returning();
    await recordAuditEvent(req, "user.status_changed", {
      entityType: "user",
      entityId: updated.id,
      details: { status: "active" },
    });
    res.json({ user: toSafeUser(updated, await rolesForUser(updated)) });
  });

  app.post("/api/admin/users/:id/reject", requireAdmin, async (req, res) => {
    const target = await loadTarget(req, res);
    if (!target) return;
    if (target.status !== "pending") {
      return res.status(400).json({ message: "Only pending registrations can be rejected" });
    }
    const [updated] = await db
      .update(users)
      .set({ status: "rejected", sessionVersion: sql`${users.sessionVersion} + 1` })
      .where(eq(users.id, target.id))
      .returning();
    await recordAuditEvent(req, "user.status_changed", {
      entityType: "user",
      entityId: updated.id,
      details: { status: "rejected" },
    });
    res.json({ user: toSafeUser(updated, await rolesForUser(updated)) });
  });

  app.post("/api/admin/users/:id/deactivate", requireAdmin, async (req, res) => {
    const target = await loadTarget(req, res);
    if (!target) return;
    if (target.status !== "active") {
      return res.status(400).json({ message: "Only active accounts can be deactivated" });
    }
    const [updated] = await db
      .update(users)
      .set({ status: "deactivated", sessionVersion: sql`${users.sessionVersion} + 1` })
      .where(eq(users.id, target.id))
      .returning();
    await recordAuditEvent(req, "user.status_changed", {
      entityType: "user",
      entityId: updated.id,
      details: { status: "deactivated" },
    });
    res.json({ user: toSafeUser(updated, await rolesForUser(updated)) });
  });

  app.post("/api/admin/users/:id/reactivate", requireAdmin, async (req, res) => {
    const target = await loadTarget(req, res);
    if (!target) return;
    if (target.status !== "deactivated" && target.status !== "rejected") {
      return res.status(400).json({ message: "Only deactivated or rejected accounts can be reactivated" });
    }
    const [updated] = await db
      .update(users)
      .set({
        status: "active",
        approvedAt: target.approvedAt ?? new Date(),
        sessionVersion: sql`${users.sessionVersion} + 1`,
      })
      .where(eq(users.id, target.id))
      .returning();
    await recordAuditEvent(req, "user.status_changed", {
      entityType: "user",
      entityId: updated.id,
      details: { status: "active" },
    });
    res.json({ user: toSafeUser(updated, await rolesForUser(updated)) });
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
    if (!hasRole(actor, "super_admin") && (newRole === "super_admin" || newRole === "admin")) {
      return res.status(403).json({ message: "Only a Super Admin can assign Admin or Super Admin roles" });
    }
    const [updated] = await db.transaction(async (tx) => {
      await tx.delete(userRoles).where(eq(userRoles.userId, target.id));
      await tx.insert(userRoles).values({ userId: target.id, role: newRole, assignedBy: actor.id });
      return tx
        .update(users)
        .set({ role: newRole, sessionVersion: sql`${users.sessionVersion} + 1` })
        .where(eq(users.id, target.id))
        .returning();
    });
    await recordAuditEvent(req, "user.roles_changed", {
      entityType: "user",
      entityId: updated.id,
      details: { roles: [newRole] },
    });
    res.json({ user: toSafeUser(updated, [newRole]) });
  });

  app.patch("/api/admin/users/:id/roles", requireAdmin, async (req, res) => {
    const parsed = assignRolesSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid roles" });
    const target = await loadTarget(req, res);
    if (!target) return;
    const actor = getUser(req);
    const roles = [...new Set(parsed.data.roles)];
    if (!hasRole(actor, "super_admin") && roles.some((role) => role === "super_admin" || role === "admin")) {
      return res.status(403).json({ message: "Only a Super Admin can assign administrator roles" });
    }
    const [updated] = await db.transaction(async (tx) => {
      await tx.delete(userRoles).where(eq(userRoles.userId, target.id));
      await tx.insert(userRoles).values(roles.map((role) => ({ userId: target.id, role, assignedBy: actor.id })));
      return tx
        .update(users)
        .set({ role: roles[0], sessionVersion: sql`${users.sessionVersion} + 1` })
        .where(eq(users.id, target.id))
        .returning();
    });
    await recordAuditEvent(req, "user.roles_changed", {
      entityType: "user",
      entityId: updated.id,
      details: { roles },
    });
    res.json({ user: toSafeUser(updated, roles) });
  });

  app.post("/api/admin/users/:id/reset-code", requireAdmin, passwordActionLimit, async (req, res) => {
    const actor = getUser(req);
    if (!hasRole(actor, "super_admin")) {
      return res.status(403).json({ message: "Only a Super Admin can issue password reset codes" });
    }
    const target = await loadTarget(req, res);
    if (!target) return;
    const resetCode = nanoid(16);
    const expiresAt = new Date(Date.now() + 30 * 60_000);
    await db.insert(passwordResetCodes).values({
      userId: target.id,
      codeHash: await bcrypt.hash(resetCode, 12),
      expiresAt,
      createdBy: actor.id,
    });
    await recordAuditEvent(req, "auth.password_reset_created", {
      entityType: "user",
      entityId: target.id,
      details: { expiresAt: expiresAt.toISOString() },
    });
    res.json({ resetCode, expiresAt });
  });

  // ---------- Usage tracking ----------
  app.post("/api/track", async (req, res) => {
    const submittedPath = typeof req.body?.path === "string" ? req.body.path.slice(0, 500) : null;
    if (!submittedPath || !submittedPath.startsWith("/")) {
      return res.status(400).json({ message: "Invalid path" });
    }
    const path = submittedPath.replace(/\/\d+(?=\/|$)/g, "/:id").replace(/[?].*$/, "");
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
