import type { RequestHandler } from "express";

const attempts = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(options: {
  name: string;
  limit: number;
  windowMs: number;
  key?: (req: Parameters<RequestHandler>[0]) => string;
}): RequestHandler {
  return (req, res, next) => {
    if (process.env.VITEST) return next();
    const now = Date.now();
    const identity = options.key?.(req) || req.ip || "unknown";
    const mapKey = `${options.name}:${identity}`;
    const current = attempts.get(mapKey);
    const entry = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + options.windowMs }
      : current;
    entry.count += 1;
    attempts.set(mapKey, entry);
    if (entry.count > options.limit) {
      res.set("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ message: "Too many requests. Please wait and try again." });
    }
    next();
  };
}
