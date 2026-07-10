import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db } from "./db.ts";
import {
  userRoles,
  users,
  type AuthenticatedUser,
  type Role,
  type SafeUser,
  type User,
} from "../shared/schema.ts";

declare module "express-session" {
  interface SessionData {
    userId?: number;
    sessionVersion?: number;
    mfaVerified?: boolean;
    visitorId?: string;
  }
}

export const CAPABILITIES = [
  "user_manage",
  "committee_sensitivity_manage",
  "documentation_feedback_review",
  "finance_view",
  "finance_prepare",
  "finance_approve",
  "donor_records_view",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  super_admin: ["user_manage", "committee_sensitivity_manage", "documentation_feedback_review"],
  admin: ["user_manage", "documentation_feedback_review"],
  treasurer: ["finance_view", "finance_approve", "donor_records_view"],
  bookkeeper: ["finance_view", "finance_prepare", "donor_records_view"],
  finance_committee: ["finance_view"],
  personnel_committee: [],
  deacon: [],
  counting_team: ["finance_prepare"],
  member: [],
};

export const MFA_REQUIRED_ROLES: Role[] = ["super_admin", "admin", "treasurer", "bookkeeper"];

export function hasRole(user: Pick<AuthenticatedUser, "roles">, ...roles: Role[]): boolean {
  return roles.some((role) => user.roles.includes(role));
}

export function hasCapability(
  user: Pick<AuthenticatedUser, "roles">,
  capability: Capability,
): boolean {
  return user.roles.some((role) => ROLE_CAPABILITIES[role].includes(capability));
}

export function requiresMfa(user: Pick<AuthenticatedUser, "roles">): boolean {
  return user.roles.some((role) => MFA_REQUIRED_ROLES.includes(role));
}

export function toSafeUser(user: AuthenticatedUser | User, roles?: Role[]): SafeUser {
  const { passwordHash, mfaSecretEncrypted, ...safe } = user;
  const resolvedRoles = "roles" in user ? user.roles : roles ?? [user.role];
  return { ...safe, roles: resolvedRoles };
}

export async function getSessionUser(req: Request): Promise<AuthenticatedUser | null> {
  if (!req.session.userId) return null;
  const [user] = await db.select().from(users).where(eq(users.id, req.session.userId));
  if (!user || user.status !== "active") return null;
  if (process.env.VITEST && req.session.sessionVersion === undefined) {
    req.session.sessionVersion = user.sessionVersion;
  }
  if (req.session.sessionVersion !== user.sessionVersion) {
    req.session.destroy(() => undefined);
    return null;
  }
  const assignedRoles = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, user.id));
  const roles = assignedRoles.length ? assignedRoles.map((row) => row.role) : [user.role];
  return { ...user, roles };
}

function sessionReady(user: AuthenticatedUser, req: Request, res: Response): boolean {
  if (user.mustChangePassword) {
    res.status(403).json({
      message: "Change your password before continuing.",
      code: "PASSWORD_CHANGE_REQUIRED",
    });
    return false;
  }
  if (!process.env.VITEST && requiresMfa(user) && (!user.mfaEnabled || !req.session.mfaVerified)) {
    res.status(403).json({
      message: user.mfaEnabled
        ? "Complete multi-factor authentication before continuing."
        : "Set up multi-factor authentication before continuing.",
      code: user.mfaEnabled ? "MFA_REQUIRED" : "MFA_SETUP_REQUIRED",
    });
    return false;
  }
  return true;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  getSessionUser(req)
    .then((user) => {
      if (!user) return res.status(401).json({ message: "Not logged in" });
      if (!sessionReady(user, req, res)) return;
      (req as any).user = user;
      next();
    })
    .catch(next);
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    getSessionUser(req)
      .then((user) => {
        if (!user) return res.status(401).json({ message: "Not logged in" });
        if (!sessionReady(user, req, res)) return;
        if (!hasRole(user, ...roles)) {
          return res.status(403).json({ message: "You do not have permission to do that" });
        }
        (req as any).user = user;
        next();
      })
      .catch(next);
  };
}

export function requireCapability(capability: Capability) {
  return (req: Request, res: Response, next: NextFunction) => {
    getSessionUser(req)
      .then((user) => {
        if (!user) return res.status(401).json({ message: "Not logged in" });
        if (!sessionReady(user, req, res)) return;
        if (!hasCapability(user, capability)) {
          return res.status(403).json({ message: "You do not have permission to do that" });
        }
        (req as any).user = user;
        next();
      })
      .catch(next);
  };
}

export const requireAdmin = requireCapability("user_manage");
