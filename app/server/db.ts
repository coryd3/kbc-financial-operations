import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema.ts";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

// Safety net: under vitest, only ever connect to a dedicated test database
// (vitest.config.ts rewrites DATABASE_URL to point at one). This guarantees
// test rows can never land in the live database.
if (process.env.VITEST && !new URL(process.env.DATABASE_URL).pathname.endsWith("_test")) {
  throw new Error(
    "Refusing to run tests against a non-test database. DATABASE_URL must point at a '*_test' database when running under vitest.",
  );
}

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
