---
name: Drizzle push vs connect-pg-simple session table
description: db:push prompts to DROP the session table unless it's defined in the Drizzle schema
---

The rule: the `session` table (auto-created by connect-pg-simple with `createTableIfMissing: true`) must be defined in `app/shared/schema.ts`, otherwise `npm run db:push` interactively prompts to drop it — answering yes would log out all users and lose sessions.

**Why:** drizzle-kit push diffs the live DB against the schema file and treats unknown tables as removals. The prompt only appears after the server has started at least once (table gets created lazily), so an early push can succeed while a later one suddenly prompts.

**How to apply:** keep the `session` pgTable definition (sid varchar PK, sess json, expire timestamp(6), index IDX_session_expire) in the schema. If db:push ever prompts to remove a table, abort and check whether the table is runtime-created before forcing.
