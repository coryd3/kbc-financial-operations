import crypto from "node:crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "./db.ts";
import { appBaseUrl, sendEmail } from "./email.ts";
import { emailVerificationTokens, userRoles, users, type User } from "../shared/schema.ts";

const VERIFICATION_LIFETIME_MS = 24 * 60 * 60 * 1000;

export function hashVerificationToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function sendVerificationEmail(user: User): Promise<boolean> {
  if (!user.email) return false;
  const token = nanoid(48);
  const expiresAt = new Date(Date.now() + VERIFICATION_LIFETIME_MS);
  await db
    .update(emailVerificationTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(emailVerificationTokens.userId, user.id), isNull(emailVerificationTokens.usedAt)));
  await db.insert(emailVerificationTokens).values({
    userId: user.id,
    email: user.email,
    tokenHash: hashVerificationToken(token),
    expiresAt,
  });

  const verifyUrl = `${appBaseUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  return sendEmail({
    to: user.email,
    subject: "Verify your email for the KBC Operations Portal",
    text:
      `Hello ${user.fullName},\n\n` +
      `Please verify your email address for the KBC Operations Portal:\n${verifyUrl}\n\n` +
      `This link expires in 24 hours. Verifying your email does not grant member permissions; ` +
      `a church administrator will still review your access request.\n\n` +
      `If you did not request this account, you can ignore this message.`,
    idempotencyKey: `verify-${user.id}-${hashVerificationToken(token).slice(0, 16)}`,
  });
}

export async function notifyAccessGranted(user: User): Promise<boolean> {
  if (!user.email) return false;
  const signInUrl = `${appBaseUrl()}/login`;
  const sent = await sendEmail({
    to: user.email,
    subject: "Your KBC Operations Portal access is approved",
    text:
      `Hello ${user.fullName},\n\n` +
      `A church administrator has approved your KBC Operations Portal account.\n\n` +
      `Sign in here:\n${signInUrl}\n\n` +
      `${user.emailVerifiedAt ? "Your email is already verified." : "You must also verify your email before member access becomes available."}\n\n` +
      `Your permissions will be based on the church roles assigned to your account.`,
    idempotencyKey: `access-approved-${user.id}-${user.sessionVersion}`,
  });
  if (sent) {
    await db.update(users).set({ accessNotificationSentAt: new Date() }).where(eq(users.id, user.id));
  }
  return sent;
}

export async function notifyRegistrationReviewers(newUser: User): Promise<number> {
  const recipients = await administrativeEmailRecipients();
  if (!recipients.length) return 0;

  const details = [
    `Name: ${newUser.fullName}`,
    `Username: ${newUser.username}`,
    newUser.email ? `Email: ${newUser.email}` : null,
    newUser.phone ? `Phone: ${newUser.phone}` : null,
  ].filter(Boolean).join("\n");
  const results = await Promise.allSettled(recipients.map((to) => sendEmail({
    to,
    subject: `KBC Portal: New registration from ${newUser.fullName}`,
    text:
      `A new account registration is waiting for review.\n\n${details}\n\n` +
      `Open the Admin page:\n${appBaseUrl()}/admin\n\n` +
      `The registrant can verify their email and view pending status, but cannot access member information until approved.`,
    idempotencyKey: `registration-${newUser.id}-${hashVerificationToken(to).slice(0, 12)}`,
  })));
  return results.filter((result) => result.status === "fulfilled" && result.value).length;
}

export async function administrativeEmailRecipients(): Promise<string[]> {
  const configured = process.env.OPERATIONS_ALERT_EMAILS
    ?.split(",")
    .map((email) => email.trim())
    .filter(Boolean) ?? [];
  const roleRows = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .where(inArray(userRoles.role, ["super_admin", "admin"]));
  const reviewerIds = [...new Set(roleRows.map((row) => row.userId))];
  const reviewers = reviewerIds.length ? await db
    .select()
    .from(users)
    .where(and(inArray(users.id, reviewerIds), eq(users.status, "active"))) : [];
  return [...new Set([...configured, ...reviewers.map((reviewer) => reviewer.email).filter(Boolean)])] as string[];
}
