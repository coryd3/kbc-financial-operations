---
name: Rebasing feature branches in this repo
description: Lessons for resolving rebase conflicts when task branches merge independent app modules
---

Modules in this app (directory, checklists, governance, finance, ...) are independent; rebase conflicts are almost always additive — keep BOTH sides' schema tables, type exports, zod schemas, nav items, routes, api methods, dashboard cards, and seed blocks.

**Why:** Two full rebases were resolved this way with zero semantic divergence; deletion of either side breaks a shipped module.

**How to apply:**
- Shared helpers (e.g. a `dateString` zod helper in `app/shared/schema.ts`) may be declared on both sides — keep one declaration and drop the duplicate.
- If a branch has multiple commits, resolve each commit with only the identifiers that existed at THAT commit; later commits (e.g. role-tightening renames) re-conflict and apply their own rename. Don't pre-apply later constants in earlier commits.
- Subagents resolving conflicts can drop needed imports (e.g. `Link` from wouter) or leave an extra closing brace — always run `cd app && npx tsc --noEmit` before `git add` / `git rebase --continue`.
- Scope conflict-marker greps to `app/client app/server app/shared` — bare `grep -r app/` hits node_modules.
