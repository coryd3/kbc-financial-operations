---
name: Node app lives in app/ subdirectory
description: Package installs and build commands must target app/, not the repo root
---
The church operations app is a Node project in `app/`, coexisting with the MkDocs docs repo at the root.

**Why:** Platform package installers (including installs made by design subagents) write dependencies into a root `package.json`, splitting deps across two manifests and polluting the docs repo root.

**How to apply:** Install npm packages by running `npm install <pkg>` inside `app/` via bash, not the platform installer. After any subagent frontend work, check for a stray root `package.json`/`package-lock.json`/`node_modules` and, if found, move the deps into `app/package.json` and delete the strays. All build/run commands are `cd app && npm run ...`.
