# KBC Operations Portal + Financial Operations Documentation

## Overview
Two things live in this repo:
1. **Church operations web app** (`app/`) — the Kingsville Baptist Church Operations Portal: public site, member registration with admin approval, role-based logins, admin management, documentation hub, and usage analytics. This is the primary app served by the "Church App" workflow on port 5000.
2. **MkDocs Material documentation site** (`docs/`, `mkdocs.yml`, `scripts/`, `Makefile`) — unchanged; it continues to deploy to GitHub Pages (https://coryd3.github.io/kbc-financial-operations/) via GitHub Actions. The app's Documentation section links out to it by topic.

## Church app (`app/`)
- Stack: Express + Vite React (TypeScript) + Tailwind + wouter + react-query, Drizzle ORM on Replit PostgreSQL, session auth (express-session + connect-pg-simple, bcryptjs).
- Layout: `app/server/` (Express API, seed, auth middleware), `app/shared/schema.ts` (Drizzle tables + zod schemas + roles), `app/client/` (React SPA).
- Dev: workflow "Church App" runs `cd app && npm run dev` (tsx server with Vite middleware) on port 5000.
- Deployment (Replit publish): autoscale, build `cd app && npm run build`, run `cd app && npm start`. Publish happens from the main project after task merge. Set a `SESSION_SECRET` secret for production.
- Schema changes: edit `app/shared/schema.ts` then `cd app && npm run db:push`.
- Tests: `cd app && npm test` (vitest). Tests never touch the live database — vitest global setup auto-creates a sibling `<dbname>_test` database on the same Postgres server, syncs the Drizzle schema into it (`drizzle-kit push --force`), and rewrites `DATABASE_URL` for test workers. `app/server/db.ts` refuses to run under vitest against a non-`*_test` database.

### Roles (most → least privileged)
super_admin, admin, treasurer, bookkeeper, finance_committee, personnel_committee, deacon, counting_team, member (+ public = not logged in). Admins cannot manage Admins/Super Admins; only Super Admin can assign admin roles. Enforced server-side (`canManage` in `app/server/routes.ts`) and reflected in UI.

### Auth & registration
- Registration creates a `pending` user; admin must approve before login works. Statuses: pending / active / rejected / deactivated.
- Super Admin bootstrap: at server start, if no super_admin exists, one is seeded (username from `SUPER_ADMIN_USERNAME`, default `kbcadmin`) with a one-time temporary password taken from `SUPER_ADMIN_TEMP_PASSWORD` or randomly generated and printed once to the server console. Password change is forced on first login.
- Production requires a `SESSION_SECRET` secret — the server refuses to start without it when `NODE_ENV=production`.

### Membership directory
- Tables: `households`, `members` (profiles independent of `users`; optional one-to-one `user_id` link, unique). Member statuses: active / inactive / visitor. Privacy flags `hide_email` / `hide_phone` / `hide_address` control what other members see in the directory.
- Leadership roles for member management and full detail (incl. leadership-only notes): `LEADERSHIP_ROLES` in `app/shared/schema.ts` = super_admin, admin, deacon.
- Routes (`app/server/memberRoutes.ts`): `/api/members` + `/api/households` (any logged-in user, privacy-filtered), `/api/members/me` GET/PATCH (self-service contact info + privacy prefs), `/api/admin/members*` + `/api/admin/households*` + `/api/admin/linkable-users` (leadership only).
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

### Usage tracking
- In-app: POST `/api/track` records path/visitor/role in `page_views`; admin analytics at `/admin/analytics` (daily views, top pages, by role).
- GoatCounter snippet (kbc-financial-operations.goatcounter.com) is embedded in `app/client/index.html` and counts SPA navigations (skips localhost by design).

## User preferences
(none recorded yet)
