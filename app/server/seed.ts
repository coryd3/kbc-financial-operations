import bcrypt from "bcryptjs";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "./db.ts";
import { users, announcements } from "../shared/schema.ts";

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
}
