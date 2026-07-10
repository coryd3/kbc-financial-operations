---
name: drizzle-kit push is interactive
description: How to apply schema changes when db:push prompts about renamed/created tables
---
`cd app && npm run db:push` can hang on an interactive "create vs rename" prompt when new tables are introduced. Piping stdin (`printf '\n' | ...`) and `--force` do NOT answer the prompt (drizzle-kit reads a raw TTY), and `script -qec` hangs too.

**Why:** drizzle-kit uses raw-TTY arrow-key prompts; non-TTY input is ignored.

**How to apply:** In an agent shell, if db:push stalls on a prompt, create the new tables directly with SQL matching `app/shared/schema.ts` (drizzle then treats them as in sync). Column names are snake_case versions of the schema fields.
