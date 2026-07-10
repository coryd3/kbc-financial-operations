---
name: Test database isolation
description: How vitest is kept away from the live Replit Postgres data
---
Replit's built-in Postgres allows `CREATE DATABASE`, so the vitest suite provisions a sibling `<dbname>_test` database on the same server rather than a schema or mocks.

**Why:** tests exercise real routes against a real DB; interrupted runs previously left prefixed test rows visible in the live app.

**How to apply:** any new test file that imports the app's db module is automatically isolated (vitest config rewrites DATABASE_URL; db module hard-fails under vitest on non-`*_test` names). Schema sync uses `drizzle-kit push --force`, which is safe only because it targets the throwaway test DB — never use `--force` against the live DB (session-table drop risk).
