import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db, pool } from "./db.ts";
import { userRoles, users } from "../shared/schema.ts";

async function main() {
  const username = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const fullName = process.env.BOOTSTRAP_ADMIN_FULL_NAME?.trim() || "System Administrator";
  if (!username || !password || password.length < 12) {
    throw new Error(
      "Set BOOTSTRAP_ADMIN_USERNAME, BOOTSTRAP_ADMIN_PASSWORD (12+ characters), and optionally BOOTSTRAP_ADMIN_FULL_NAME.",
    );
  }
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.username}) = lower(${username})`);
  if (existing) throw new Error("That bootstrap username already exists.");
  const [created] = await db
    .insert(users)
    .values({
      username,
      fullName,
      passwordHash: await bcrypt.hash(password, 12),
      role: "super_admin",
      status: "active",
      mustChangePassword: true,
      approvedAt: new Date(),
    })
    .returning({ id: users.id });
  await db.insert(userRoles).values({ userId: created.id, role: "super_admin", assignedBy: created.id });
  console.log(`Created bootstrap administrator '${username}'. Sign in, change the password, and enroll MFA.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
