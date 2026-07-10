export const TEST_DB_SUFFIX = "_test";

export function deriveTestDatabaseUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  const dbName = url.pathname.replace(/^\//, "");
  if (!dbName) {
    throw new Error("DATABASE_URL has no database name; cannot derive a test database");
  }
  if (dbName.endsWith(TEST_DB_SUFFIX)) return databaseUrl;
  url.pathname = `/${dbName}${TEST_DB_SUFFIX}`;
  return url.toString();
}

export function databaseNameOf(databaseUrl: string): string {
  return new URL(databaseUrl).pathname.replace(/^\//, "");
}
