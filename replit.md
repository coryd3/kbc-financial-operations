# KBC Operations Portal + Financial Operations Documentation

## Overview
Two things live in this repo:
1. **Church operations web app** (`app/`) — the Kingsville Baptist Church Operations Portal: public site, member registration with admin approval, role-based logins, admin management, documentation hub, and usage analytics. This is the primary app served by the "Church App" workflow on port 5000.
2. **MkDocs Material documentation site** (`docs/`, `mkdocs.yml`, `scripts/`, `Makefile`) — the public GitHub Pages reading layer. The portal packages the same approved public Markdown into its searchable Documentation Hub, so both readers use the repository as the source of truth.

## Church app (`app/`)
- Stack: Express + Vite React (TypeScript) + Tailwind + wouter + react-query, Drizzle ORM on PostgreSQL, session auth (express-session + connect-pg-simple, bcryptjs).
- Layout: `app/server/` (Express API, seed, auth middleware), `app/shared/schema.ts` (Drizzle tables + zod schemas + roles), `app/client/` (React SPA).
- Dev: run `cd app && npm run dev` (tsx server with Vite middleware) on port 5000. Replit may still be used as an optional editor.
- Deployment: Render builds and deploys `main` from the root `render.yaml` after GitHub checks pass. Production is not hosted by Replit.
- Schema changes: edit `app/shared/schema.ts`, generate and review a checked-in migration with `npm run db:generate`, and test it with `npm run db:migrate`. Do not use `db:push` against production.
- Tests: `cd app && npm test` (vitest). Tests never touch the live database — vitest global setup auto-creates a sibling `<dbname>_test` database on the same Postgres server, syncs the Drizzle schema into it (`drizzle-kit push --force`), and rewrites `DATABASE_URL` for test workers. `app/server/db.ts` refuses to run under vitest against a non-`*_test` database.

### Roles (most → least privileged)
super_admin, admin, treasurer, bookkeeper, finance_committee, personnel_committee, deacon, counting_team, member (+ public = not logged in). Admins cannot manage Admins/Super Admins; only Super Admin can assign admin roles. Enforced server-side (`canManage` in `app/server/routes.ts`) and reflected in UI.

### Auth & registration
- Registration creates a pending `member`. The person may sign in only to view account status until an administrator approves the account. Email verification is normally required; temporary approval-only onboarding uses `REQUIRE_EMAIL_VERIFICATION=false`.
- Super Admin bootstrap is an intentional one-time command: set temporary `BOOTSTRAP_ADMIN_*` environment values and run `npm run db:bootstrap-admin`. It does not seed an administrator automatically at startup.
- Production requires `SESSION_SECRET` and `MFA_ENCRYPTION_KEY` secrets. Privileged roles must complete MFA.

### Test accounts & password management
- Administrators create one-time password reset codes from `/admin`; they do not assign or learn a user's permanent password.
- A development database may use seeded `test_<role>` accounts for local testing. Never run the baseline seed against production or copy Replit test accounts into Render.

### Membership directory
- Tables: `households`, `members` (profiles independent of `users`; optional one-to-one `user_id` link, unique). Member statuses: active / inactive / visitor. Privacy flags `hide_email` / `hide_phone` / `hide_address` control what other members see in the directory.
- Leadership roles for member management and full detail (incl. leadership-only notes): `LEADERSHIP_ROLES` in `app/shared/schema.ts` = super_admin, admin, deacon.
- Routes (`app/server/memberRoutes.ts`): `/api/members` + `/api/households` (any logged-in user, privacy-filtered), `/api/members/me` GET/PATCH (self-service contact info + privacy prefs), `/api/admin/members*` + `/api/admin/households*` + `/api/admin/linkable-users` (leadership only).
- Scale: `GET /api/members` supports server-side pagination (`limit` up to 200, `offset`, always returns `total`) and `sort=household`; no `limit` returns all rows (used by print views). Directory and admin member pages use debounced search + paged queries (60/50 per page); Print fetches the full filtered list on demand.
- UI: `/directory` (all logged-in users; list + household views, search/status/household filters), `/admin/members` (leadership; add/edit/delete members, households, account linking, notes), "My Member Profile" card on `/account`.

### Tasks & checklists
- Reusable checklist templates (ordered steps, optional role per step) with recurrence weekly / monthly / on_demand. Managed by CHECKLIST_MANAGER_ROLES (super_admin, admin, treasurer, finance_committee, deacon) at `/checklists/templates`.
- Recurring instances are spawned lazily via `ensureScheduledInstances()` in `app/server/checklists.ts` (throttled, called on checklist reads + at seed). Duplicate spawns are prevented by a unique index on (template_id, period_key) + `onConflictDoNothing`.
- Instances snapshot template steps at spawn; step check-off records who/when; completing all steps auto-completes the instance (unchecking reopens it). Non-managers can only check steps matching their role or unassigned; managers can check any.
- UI: `/checklists` (My Tasks / Active / Completed tabs), `/checklists/:id` detail, Dashboard panel + nav overdue badge fed by `/api/checklists/summary`.
- Template deletion is history-safe: DELETE on a template with any runs retires it (sets `archived_at`, deactivates) instead of deleting, preserving all past runs and step who/when records; templates never run are hard-deleted. Retired templates don't auto-spawn and can't be started; `POST /api/checklists/templates/:id/restore` reactivates. UI shows a "Retired Templates" section with History/Restore.
- Run history: `/checklists/templates/:id/history` (managers only) shows all past runs of a template with on-time/late/overdue status, summary stats, and expandable step-level who/when detail; backed by `GET /api/checklists/templates/:id/history`. Linked via "History" buttons on `/checklists/templates` and instance detail pages.
- Seeded templates: Payroll Run (monthly), Weekly Bookkeeping (weekly), Monthly Close Prep (monthly), Business Meeting Prep (on-demand).

### Committees & governance
- Tables: `committees` (with `isSensitive` flag), `committee_members` (positions: chair/vice_chair/secretary/member, term dates), `meetings` (date, attendees, agenda, minutes), `decisions` (date, decision, owner, status, notes; optional links to committee and meeting — mirrors the docs' decision log columns).
- Routes in `app/server/governance.ts`. Access rules: sensitive committees (e.g. Personnel) visible only to their members + Super Admin; other committees visible to their members + leadership (super_admin, admin, deacon). Managing rosters/meetings/decisions: committee chair/secretary or admins (Super Admin only for sensitive ones). Congregation-level decisions (no committee) visible to all logged-in users; only admins can record them.
- Client pages: `/committees` (list + create for admins), `/committees/:id` (roster, meetings & minutes, decisions), `/decisions` (filterable decision log + link to historical log on the docs site). Dashboard shows "My Committees" and upcoming/recent meetings.
- Seed: Finance, Personnel (restricted), Deacons, Nominating committees plus three decision log entries carried over from `docs/02-decision-log.md`.

### Checklist reminders & notifications
- In-app reminders: `notifications` table (unique per user + instance + type). Generation in `app/server/notifications.ts` (`ensureReminders`, piggybacked on `ensureScheduledInstances`, throttled 10 min): "due_soon" within 24h of due date, "overdue" past due. Recipients = active users whose role matches an incomplete step; incomplete unassigned steps notify CHECKLIST_MANAGER_ROLES.
- Per-user prefs: `users.notify_due_soon` / `users.notify_overdue` (default on), editable on `/account` ("Checklist Reminders" card), API `PATCH /api/notifications/prefs`.
- UI: bell dropdown in header (`NotificationBell.tsx`), unread badge, click-through to checklist, mark read / mark all read. Routes: `GET /api/notifications`, `POST /api/notifications/:id/read`, `POST /api/notifications/read-all`.
- Email: Replit Mail integration (`app/server/replitmail.ts`) sends a digest to the **app owner's verified Replit email** only (platform limitation — not per-user email). Sent once per instance per type, gated by `due_soon_email_at` / `overdue_email_at` on `checklist_instances`, marked only after successful send so transient failures retry. Email failures never block in-app reminders.

### Finance & bookkeeping module
- Tables: `budget_categories`, `offering_counts`, `deposits`, `transactions`, `monthly_closes`, `monthly_close_items` (money stored as integer cents). Default categories seeded on first start.
- Weekly offering counts require two counter names and confirmation by a *different* portal user (dual-control) before they can be linked to a deposit. Verified counts are locked from editing.
- Deposits link verified counts; Bookkeeper/Treasurer mark them reconciled.
- Transaction ledger (income/expense) validates that the entry type matches the category type.
- Monthly close: per-month checklist (template from docs' monthly-close-checklist) — all items must be complete before Treasurer sign-off; closed months are locked (Treasurer/Super Admin can reopen).
- Role groups exported from `app/shared/schema.ts` (COUNT_ENTRY_ROLES, LEDGER_EDIT_ROLES, CLOSE_SIGNOFF_ROLES, FINANCE_NAV_ROLES, etc.) and enforced via `requireRole` in `app/server/finance.ts`; UI mirrors them. Least-privilege matrix: Counting Team sees counts only; Finance Committee sees reports only; Bookkeeper/Treasurer/Admins get deposits, ledger, and close; only Treasurer/Super Admin sign off closes; only Admins manage categories.
- Client pages under `app/client/src/pages/finance/` with shared sub-nav in `FinanceLayout.tsx`; routes `/finance/*` gated by `ProtectedRoute allowedRoles`.

### Contributions & giving records module
- Tables: `giving_funds` (default funds seeded: General Fund, Missions, Building Fund, Benevolence), `donors` (optional unique link to `members`), `contribution_batches` (optional unique link to an `offering_counts` row, open/closed status), `contributions` (cents; method cash/check/other, check # required for checks; cascade-deleted with their batch).
- Confidentiality: individual giving data (donors, batches, contributions, statements) is restricted to GIVING_ROLES = super_admin, treasurer, bookkeeper — admins are deliberately excluded. Fund-level aggregates (`/api/giving/reports/funds`) additionally allow finance_committee (FUND_REPORT_ROLES) with no donor detail. Enforced in `app/server/contributions.ts` and mirrored in nav/routes.
- Batch workflow: start a batch (optionally linked to an offering count), enter contributions (date defaults to batch date), then close. Closing with a linked count returns 409 with the variance if totals mismatch unless `allowMismatch` override is sent; closed batches lock all contribution edits until reopened. Empty batches can't be closed; only open, empty-or-draft batches can be deleted.
- Donors: searchable list with lifetime totals, edit, member linking (one donor per member), delete only when no contributions — otherwise deactivate or merge (`POST /api/giving/donors/:id/merge` moves contributions, transfers member link if target lacks one, deletes source).
- Statements: `GET /api/giving/donors/:id/statement?start&end` powers printable annual/custom-range statements (`printGivingStatement` in `printExport.ts`, church letterhead + tax wording) from `/finance/donors/:id`. Year-end bulk: `GET /api/giving/statements?start&end` (GIVING_ROLES) returns one statement per donor with giving in range; "Year-End Statements" card on `/finance/donors` prints them all in a single document, page-break separated (`printGivingStatementsBulk`).
- Client pages: `/finance/giving` (batches), `/finance/giving/:id` (entry + reconciliation), `/finance/donors`, `/finance/donors/:id` (history + statement), `/finance/funds` (aggregates + fund management for GIVING_ROLES). Tabs in `FinanceLayout.tsx`.
- Tests: `app/server/contributions.test.ts` (role gating incl. admin exclusion, reconciliation 409/override, closed-batch locking, merge, statement ranges, member-link uniqueness).

### Usage tracking
- In-app: POST `/api/track` records path/visitor/role in `page_views`; admin analytics at `/admin/analytics` (daily views, top pages, by role).
- GoatCounter snippet (kbc-financial-operations.goatcounter.com) is embedded in `app/client/index.html` and counts SPA navigations (skips localhost by design).

## User preferences
- Do not place personal or workplace email addresses in public repository guidance. Use church-controlled contact settings and deployment secrets for operational notifications.
- Replit Mail is optional development tooling only. Production notification delivery must not depend on a developer's personal account.
