import type { Request, Response, NextFunction } from "express";

// With the session cookie set to SameSite=None (required for the Replit
// preview iframe), browsers will attach it to cross-site requests. This guard
// restores CSRF protection: any state-changing request whose Origin header
// points at a foreign site is rejected. Browsers always send Origin on
// cross-site POST/PATCH/PUT/DELETE, so attacks are blocked, while non-browser
// clients (no Origin header) and same-origin requests pass through.

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function allowedOriginHosts(requestHost?: string): Set<string> {
  const hosts = new Set<string>();
  if (requestHost) hosts.add(requestHost.toLowerCase());
  if (process.env.REPLIT_DEV_DOMAIN) {
    hosts.add(process.env.REPLIT_DEV_DOMAIN.toLowerCase());
  }
  for (const domain of (process.env.REPLIT_DOMAINS ?? "").split(",")) {
    const trimmed = domain.trim().toLowerCase();
    if (trimmed) hosts.add(trimmed);
  }
  return hosts;
}

export function csrfOriginGuard(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.headers.origin;
  if (!origin || origin === "null") return next();

  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    res.status(403).json({ message: "Request blocked: invalid origin" });
    return;
  }

  if (allowedOriginHosts(req.headers.host).has(originHost)) return next();

  res.status(403).json({ message: "Request blocked: cross-site request not allowed" });
}
