// Database-backed throttle for failed login attempts. Counts failures per
// source IP and per username in the shared PostgreSQL database, so lockouts
// survive server restarts and apply across every instance of the app. Once a
// limit is hit, further attempts are blocked until the lockout expires.
// Successful logins clear the counters for that username/IP.

import { sql } from "drizzle-orm";
import { db } from "./db.ts";

const WINDOW_MS = 15 * 60 * 1000; // failures older than this are forgotten
const LOCKOUT_MS = 15 * 60 * 1000; // how long a lockout lasts once triggered
const MAX_USERNAME_FAILURES = 5; // per-username limit (any source)
const MAX_IP_FAILURES = 20; // per-IP limit (any username)

/**
 * Returns the number of seconds until the given ip/username pair may attempt
 * a login again, or 0 if the attempt is allowed.
 */
export async function loginBlockedForSeconds(ip: string, username: string): Promise<number> {
  const result = await db.execute(sql`
    SELECT CEIL(EXTRACT(EPOCH FROM MAX(locked_until) - now()))::int AS seconds_left
    FROM login_throttle
    WHERE locked_until > now()
      AND ((scope = 'username' AND key = ${username.toLowerCase()})
        OR (scope = 'ip' AND key = ${ip}))
  `);
  const secondsLeft = Number(result.rows[0]?.seconds_left ?? 0);
  return secondsLeft > 0 ? secondsLeft : 0;
}

/**
 * Atomically records one failure for a (scope, key) pair. If the previous
 * failures fall outside the window, the counter restarts at 1; once the count
 * reaches the limit, the row is locked for LOCKOUT_MS.
 */
async function recordFailure(scope: "username" | "ip", key: string, maxFailures: number) {
  await db.execute(sql`
    INSERT INTO login_throttle (scope, key, failure_count, first_failure_at, locked_until)
    VALUES (${scope}, ${key}, 1,
            now(),
            CASE WHEN 1 >= ${maxFailures} THEN now() + ${LOCKOUT_MS} * interval '1 millisecond' END)
    ON CONFLICT (scope, key) DO UPDATE SET
      failure_count = CASE
        WHEN login_throttle.first_failure_at <= now() - ${WINDOW_MS} * interval '1 millisecond'
        THEN 1
        ELSE login_throttle.failure_count + 1
      END,
      first_failure_at = CASE
        WHEN login_throttle.first_failure_at <= now() - ${WINDOW_MS} * interval '1 millisecond'
        THEN now()
        ELSE login_throttle.first_failure_at
      END,
      locked_until = CASE
        WHEN (CASE
                WHEN login_throttle.first_failure_at <= now() - ${WINDOW_MS} * interval '1 millisecond'
                THEN 1
                ELSE login_throttle.failure_count + 1
              END) >= ${maxFailures}
        THEN now() + ${LOCKOUT_MS} * interval '1 millisecond'
        ELSE login_throttle.locked_until
      END
  `);
}

/** Record a failed password/username attempt; may trigger a lockout. */
export async function recordLoginFailure(ip: string, username: string) {
  await recordFailure("username", username.toLowerCase(), MAX_USERNAME_FAILURES);
  await recordFailure("ip", ip, MAX_IP_FAILURES);
}

/** A correct password clears the counters for this username and IP. */
export async function recordLoginSuccess(ip: string, username: string) {
  await db.execute(sql`
    DELETE FROM login_throttle
    WHERE (scope = 'username' AND key = ${username.toLowerCase()})
       OR (scope = 'ip' AND key = ${ip})
  `);
}

/** Test helper: forget all recorded attempts and lockouts. */
export async function resetLoginThrottle() {
  await db.execute(sql`DELETE FROM login_throttle`);
}

/** Drop rows whose failures have aged out and whose lockout has expired. */
export async function sweepLoginThrottle() {
  await db.execute(sql`
    DELETE FROM login_throttle
    WHERE first_failure_at <= now() - ${WINDOW_MS} * interval '1 millisecond'
      AND (locked_until IS NULL OR locked_until <= now())
  `);
}

// Periodically drop stale rows so the table doesn't grow forever.
const sweep = setInterval(() => {
  sweepLoginThrottle().catch((err) => {
    console.error("login throttle sweep failed:", err);
  });
}, WINDOW_MS);
sweep.unref?.();
