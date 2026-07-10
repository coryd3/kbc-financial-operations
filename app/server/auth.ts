import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db } from "./db.ts";
import { users, type Role, type SafeUser, type User } from "../shared/schema.ts";

declare module "express-session" {
  interface SessionData {
    userId?: number;
    visitorId?: string;
  }
}

export function toSafeUser(user: User): SafeUser {
  const { passwordHash, ...safe } = user;
  return safe;
}

export async function getSessionUser(req: Request): Promise<User | null> {
  if (!req.session.userId) return null;
  const [user] = await db.select().from(users).where(eq(users.id, req.session.userId));
  if (!user || user.status !== "active") return null;
  return user;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  getSessionUser(req)
    .then((user) => {
      if (!user) {
        return res.status(401).json({ message: "Not logged in" });
      }
      (req as any).user = user;
      next();
    })
    .catch(next);
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    getSessionUser(req)
      .then((user) => {
        if (!user) {
          return res.status(401).json({ message: "Not logged in" });
        }
        if (!roles.includes(user.role)) {
          return res.status(403).json({ message: "You do not have permission to do that" });
        }
        (req as any).user = user;
        next();
      })
      .catch(next);
  };
}

export const requireAdmin = requireRole("super_admin", "admin");
