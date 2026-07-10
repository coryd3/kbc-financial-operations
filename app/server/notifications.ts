import { sendEmail } from "./replitmail.ts";
import type { User } from "../shared/schema.ts";

function appUrl(): string {
  const devDomain = process.env.REPLIT_DEV_DOMAIN;
  if (process.env.NODE_ENV === "production") {
    const domains = process.env.REPLIT_DOMAINS?.split(",")[0];
    if (domains) return `https://${domains}`;
  }
  if (devDomain) return `https://${devDomain}`;
  return "";
}

export function notifyNewRegistration(newUser: User): void {
  if (process.env.NODE_ENV === "test" || process.env.VITEST) return;
  const url = appUrl();
  const adminLink = url ? `${url}/admin` : "the Admin page";
  const submitted = [
    `Name: ${newUser.fullName}`,
    `Username: ${newUser.username}`,
    newUser.email ? `Email: ${newUser.email}` : null,
    newUser.phone ? `Phone: ${newUser.phone}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  sendEmail({
    subject: `KBC Portal: New registration from ${newUser.fullName}`,
    text:
      `A new account registration is waiting for approval on the KBC Operations Portal.\n\n` +
      `${submitted}\n\n` +
      `To approve or reject this request, open the Admin page:\n${adminLink}\n\n` +
      `(This is an automated notification from the KBC Operations Portal.)`,
  }).catch((err) => {
    console.error("[notifications] Failed to send registration email:", err?.message ?? err);
  });
}
