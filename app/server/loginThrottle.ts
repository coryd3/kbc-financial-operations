// In-memory throttle for failed login attempts. Counts failures per source IP
// and per username; once a limit is hit, further attempts are blocked until the
// lockout expires. Successful logins clear the counters for that username/IP.

const WINDOW_MS = 15 * 60 * 1000; // failures older than this are forgotten
const LOCKOUT_MS = 15 * 60 * 1000; // how long a lockout lasts once triggered
const MAX_USERNAME_FAILURES = 5; // per-username limit (any source)
const MAX_IP_FAILURES = 20; // per-IP limit (any username)

interface Entry {
  failures: number[]; // timestamps of recent failures
  lockedUntil: number; // 0 = not locked
}

const byUsername = new Map<string, Entry>();
const byIp = new Map<string, Entry>();

function getEntry(map: Map<string, Entry>, key: string): Entry {
  let entry = map.get(key);
  if (!entry) {
    entry = { failures: [], lockedUntil: 0 };
    map.set(key, entry);
  }
  return entry;
}

function prune(entry: Entry, now: number) {
  entry.failures = entry.failures.filter((t) => now - t < WINDOW_MS);
}

function lockedSecondsLeft(entry: Entry | undefined, now: number): number {
  if (!entry || entry.lockedUntil <= now) return 0;
  return Math.ceil((entry.lockedUntil - now) / 1000);
}

/**
 * Returns the number of seconds until the given ip/username pair may attempt
 * a login again, or 0 if the attempt is allowed.
 */
export function loginBlockedForSeconds(ip: string, username: string): number {
  const now = Date.now();
  const userSeconds = lockedSecondsLeft(byUsername.get(username.toLowerCase()), now);
  const ipSeconds = lockedSecondsLeft(byIp.get(ip), now);
  return Math.max(userSeconds, ipSeconds);
}

/** Record a failed password/username attempt; may trigger a lockout. */
export function recordLoginFailure(ip: string, username: string) {
  const now = Date.now();

  const userEntry = getEntry(byUsername, username.toLowerCase());
  prune(userEntry, now);
  userEntry.failures.push(now);
  if (userEntry.failures.length >= MAX_USERNAME_FAILURES) {
    userEntry.lockedUntil = now + LOCKOUT_MS;
  }

  const ipEntry = getEntry(byIp, ip);
  prune(ipEntry, now);
  ipEntry.failures.push(now);
  if (ipEntry.failures.length >= MAX_IP_FAILURES) {
    ipEntry.lockedUntil = now + LOCKOUT_MS;
  }
}

/** A correct password clears the counters for this username and IP. */
export function recordLoginSuccess(ip: string, username: string) {
  byUsername.delete(username.toLowerCase());
  byIp.delete(ip);
}

/** Test helper: forget all recorded attempts and lockouts. */
export function resetLoginThrottle() {
  byUsername.clear();
  byIp.clear();
}

// Periodically drop stale entries so the maps don't grow forever.
const sweep = setInterval(() => {
  const now = Date.now();
  for (const map of [byUsername, byIp]) {
    for (const [key, entry] of map) {
      prune(entry, now);
      if (entry.failures.length === 0 && entry.lockedUntil <= now) {
        map.delete(key);
      }
    }
  }
}, WINDOW_MS);
sweep.unref?.();
