import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./db.ts";

const LOCK_ID = 4_259_326_411;

async function run() {
  const client = await pool.connect();
  try {
    await client.query("select pg_advisory_lock($1)", [LOCK_ID]);
    const here = path.dirname(fileURLToPath(import.meta.url));
    const migrationsFolder = path.resolve(here, "../migrations");
    await migrate(db, { migrationsFolder });
    console.log("Database migrations completed.");
  } finally {
    await client.query("select pg_advisory_unlock($1)", [LOCK_ID]).catch(() => undefined);
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error("Database migration failed:", error);
  process.exit(1);
});
