import type { Request } from "express";
import { db } from "./db.ts";
import { auditEvents, type AuditEventType } from "../shared/schema.ts";

export async function recordAuditEvent(
  req: Request,
  eventType: AuditEventType,
  options: {
    actorUserId?: number | null;
    entityType?: string;
    entityId?: string | number;
    details?: Record<string, unknown>;
  } = {},
) {
  await db.insert(auditEvents).values({
    eventType,
    actorUserId: options.actorUserId ?? req.session.userId ?? null,
    entityType: options.entityType ?? null,
    entityId: options.entityId == null ? null : String(options.entityId),
    details: options.details ?? {},
    ipAddress: req.ip?.slice(0, 64) ?? null,
  });
}
