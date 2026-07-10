import { execFileSync } from "node:child_process";
import pg from "pg";
import { deriveTestDatabaseUrl, databaseNameOf } from "./server/testDatabaseUrl.ts";

// Runs once before the test suite. Ensures a dedicated test database exists
// (separate from the database the running app uses) and that its schema is
// up to date, so tests never touch real data.
export default async function setup() {
  const realUrl = process.env.REAL_DATABASE_URL || process.env.DATABASE_URL;
  if (!realUrl) {
    throw new Error("DATABASE_URL must be set to run tests. Did you forget to provision a database?");
  }

  const testUrl = deriveTestDatabaseUrl(realUrl);
  const testDbName = databaseNameOf(testUrl);

  if (testUrl !== realUrl) {
    // Connect to the real database only to create the test database if missing.
    const admin = new pg.Client({ connectionString: realUrl });
    await admin.connect();
    try {
      const existing = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [testDbName]);
      if (existing.rowCount === 0) {
        await admin.query(`CREATE DATABASE "${testDbName}"`);
      }
    } finally {
      await admin.end();
    }
  }

  // Apply the same checked-in migrations used in production.
  execFileSync("npx", ["tsx", "server/migrate.ts"], {
    cwd: new URL(".", import.meta.url).pathname,
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: "inherit",
  });
}
