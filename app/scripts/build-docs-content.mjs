import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(appRoot, "..");
const contentRoot = resolve(appRoot, "dist", "content");

rmSync(contentRoot, { recursive: true, force: true });
mkdirSync(resolve(contentRoot, "repo", "dist"), { recursive: true });
mkdirSync(resolve(contentRoot, "assets"), { recursive: true });

cpSync(resolve(repoRoot, "docs"), resolve(contentRoot, "docs"), { recursive: true });
cpSync(resolve(repoRoot, "mkdocs.yml"), resolve(contentRoot, "mkdocs.yml"));

const leadershipPacket = resolve(repoRoot, "dist", "leadership-review-packet.md");
if (existsSync(leadershipPacket)) {
  cpSync(leadershipPacket, resolve(contentRoot, "repo", "dist", "leadership-review-packet.md"));
}

const bylawsPdf = resolve(
  repoRoot,
  "source-materials",
  "bylaws",
  "Constitution, Bylaws, and Covenant 2018.pdf",
);
if (existsSync(bylawsPdf)) {
  cpSync(bylawsPdf, resolve(contentRoot, "assets", "constitution-bylaws-2018.pdf"));
}

console.log(`[build] Packaged documentation in ${contentRoot}`);
