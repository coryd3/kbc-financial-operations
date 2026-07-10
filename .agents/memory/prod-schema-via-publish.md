---
name: Production schema changes go through Publish only
description: Task envs cannot run DDL on the production DB; how prod schema (incl. pg_trgm indexes) actually gets applied.
---

Rule: never attempt DDL against the production database from a task environment. `executeSql({environment: "production"})` is read-only, and task repls report "does not have a production Neon database" because prod is tied to the main repl. The only supported path is: dev DB is the source of truth → Replit's Publish flow diffs dev vs prod and applies the SQL.

**Why:** A task was assigned to create pg_trgm + trigram GIN indexes directly in prod; that is impossible from a task env by design. The database skill's migrations reference explicitly forbids custom prod migration scripts, deploy-hook DDL, and startup-time DDL.

**How to apply:**
- Put schema (incl. index definitions) in `app/shared/schema.ts`; `drizzle-kit push --force` DOES create expression GIN indexes — but only if `pg_trgm` already exists, so `scripts/post-merge.sh` runs `CREATE EXTENSION IF NOT EXISTS pg_trgm` via psql before `db:push`.
- Each task env's dev DB is an isolated copy: DDL run in a previous task's env does NOT carry over; only schema.ts + post-merge do.
- Prod picks up index changes at the next Publish. Unverified: whether the Publish diff issues CREATE EXTENSION — verify prod state read-only after publish.
