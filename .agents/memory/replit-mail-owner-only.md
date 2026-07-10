---
name: Replit Mail sends only to the app owner
description: Limitation of the replitmail blueprint and how reminder emails are gated in this app
---

**Rule:** The Replit Mail integration (blueprint `replitmail`) can only send email to the app owner's verified Replit email — there is no `to`/`cc` field. Per-user email delivery needs a real provider (Gmail/Outlook connector, Resend, SMTP, etc.).

**Why:** Discovered while building checklist reminders (July 2026). The mailer API accepts no recipient; per-user email prefs would be misleading, so users got in-app notifications and only the owner gets an email digest.

**How to apply:** If a task asks to "email users", check this first and either propose an email-provider integration or scope to owner-digest + in-app. Also: the mailer rate-limits (~10 RPS per repl) and fails transiently — mark anything as "emailed" only *after* a successful send so failures retry (see dedup timestamps on `checklist_instances`).
