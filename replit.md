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

### Roles (most → least privileged)
super_admin, admin, treasurer, bookkeeper, finance_committee, personnel_committee, deacon, counting_team, member (+ public = not logged in). Admins cannot manage Admins/Super Admins; only Super Admin can assign admin roles. Enforced server-side (`canManage` in `app/server/routes.ts`) and reflected in UI.

### Auth & registration
- Registration creates a `pending` user; admin must approve before login works. Statuses: pending / active / rejected / deactivated.
- Super Admin bootstrap: at server start, if no super_admin exists, one is seeded (username from `SUPER_ADMIN_USERNAME`, default `kbcadmin`) with a one-time temporary password taken from `SUPER_ADMIN_TEMP_PASSWORD` or randomly generated and printed once to the server console. Password change is forced on first login.
- Production requires a `SESSION_SECRET` secret — the server refuses to start without it when `NODE_ENV=production`.

### Usage tracking
- In-app: POST `/api/track` records path/visitor/role in `page_views`; admin analytics at `/admin/analytics` (daily views, top pages, by role).
- GoatCounter snippet (kbc-financial-operations.goatcounter.com) is embedded in `app/client/index.html` and counts SPA navigations (skips localhost by design).

## User preferences
(none recorded yet)
