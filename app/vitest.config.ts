import { defineConfig } from "vitest/config";
import { deriveTestDatabaseUrl } from "./server/testDatabaseUrl.ts";

// Point every test worker at a dedicated test database so test rows never
// touch the data the church actually uses. The database itself is created
// and schema-synced by vitest.globalSetup.ts.
const testEnv: Record<string, string> = {};
if (process.env.DATABASE_URL) {
  testEnv.REAL_DATABASE_URL = process.env.DATABASE_URL;
  testEnv.DATABASE_URL = deriveTestDatabaseUrl(process.env.DATABASE_URL);
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["server/**/*.test.ts"],
    hookTimeout: 30000,
    testTimeout: 30000,
    globalSetup: ["./vitest.globalSetup.ts"],
    env: testEnv,
  },
});
