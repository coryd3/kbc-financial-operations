import type { Express, Request } from "express";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "./db.ts";
import {
  users,
  notifications,
  checklistInstances,
  checklistInstanceSteps,
  notificationPrefsSchema,
  CHECKLIST_MANAGER_ROLES,
  type NotificationType,
  type Role,
  type User,
} from "../shared/schema.ts";
import { requireAuth, toSafeUser } from "./auth.ts";
import { sendEmail } from "./email.ts";
import { administrativeEmailRecipients } from "./accountEmails.ts";

const DUE_SOON_WINDOW_MS = 24 * 60 * 60 * 1000; // day before due

function getUser(req: Request): User {
  return (req as any).user as User;
}

function formatDue(due: Date): string {
  return due.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

// ---------- Reminder generation ----------

let lastReminderCheck = 0;
const REMINDER_CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Generate due-soon / overdue reminders for open checklists.
 * - "due_soon": within 24 hours of the due date (day-before reminder).
 * - "overdue": past the due date.
 * Recipients are active users whose role matches an incomplete step on the
 * checklist; incomplete steps with no assigned role notify checklist managers.
 * Duplicate sends are prevented by a unique (user, instance, type) index.
 * An email summary also goes to configured administrative recipients the first
 * time a checklist becomes due soon or overdue.
 */
export async function ensureReminders(force = false) {
  const now = Date.now();
  if (!force && now - lastReminderCheck < REMINDER_CHECK_INTERVAL_MS) return;
  lastReminderCheck = now;

  try {
    await generateReminders(new Date(now));
  } catch (err) {
    console.error("[notifications] Failed to generate reminders:", err);
  }
}

async function generateReminders(now: Date) {
  const openInstances = await db
    .select()
    .from(checklistInstances)
    .where(and(eq(checklistInstances.status, "open"), sql`${checklistInstances.dueDate} IS NOT NULL`));

  const dueSoonCutoff = new Date(now.getTime() + DUE_SOON_WINDOW_MS);
  const relevant = openInstances.filter((i) => i.dueDate && i.dueDate <= dueSoonCutoff);
  if (!relevant.length) return;

  // Incomplete steps for the relevant instances → which roles still have work.
  const steps = await db
    .select({
      instanceId: checklistInstanceSteps.instanceId,
      assignedRole: checklistInstanceSteps.assignedRole,
    })
    .from(checklistInstanceSteps)
    .where(
      and(
        inArray(checklistInstanceSteps.instanceId, relevant.map((i) => i.id)),
        isNull(checklistInstanceSteps.completedAt),
      ),
    );

  const activeUsers = await db.select().from(users).where(eq(users.status, "active"));

  const emailLines: { type: NotificationType; instanceId: number; line: string }[] = [];

  for (const instance of relevant) {
    if (!instance.dueDate) continue;
    const type: NotificationType = instance.dueDate < now ? "overdue" : "due_soon";

    const instanceSteps = steps.filter((s) => s.instanceId === instance.id);
    if (!instanceSteps.length) continue; // nothing left to do

    const rolesWithWork = new Set<Role>();
    let hasUnassigned = false;
    for (const s of instanceSteps) {
      if (s.assignedRole) rolesWithWork.add(s.assignedRole);
      else hasUnassigned = true;
    }

    const recipients = activeUsers.filter((u) => {
      const wants = type === "overdue" ? u.notifyOverdue : u.notifyDueSoon;
      if (!wants) return false;
      if (rolesWithWork.has(u.role)) return true;
      if (hasUnassigned && CHECKLIST_MANAGER_ROLES.includes(u.role)) return true;
      return false;
    });

    if (recipients.length) {
      const dueText = formatDue(instance.dueDate);
      const title =
        type === "overdue"
          ? `Overdue: ${instance.name}`
          : `Due soon: ${instance.name}`;
      const body =
        type === "overdue"
          ? `This checklist was due ${dueText} and still has open steps assigned to you.`
          : `This checklist is due ${dueText} and still has open steps assigned to you.`;

      await db
        .insert(notifications)
        .values(
          recipients.map((u) => ({
            userId: u.id,
            instanceId: instance.id,
            type,
            title,
            body,
          })),
        )
        .onConflictDoNothing({
          target: [notifications.userId, notifications.instanceId, notifications.type],
        });
    }

    // Administrative email digest - once per instance per type.
    const alreadyEmailed = type === "overdue" ? instance.overdueEmailAt : instance.dueSoonEmailAt;
    if (!alreadyEmailed) {
      emailLines.push({
        type,
        instanceId: instance.id,
        line: `• ${instance.name} — due ${formatDue(instance.dueDate)}${type === "overdue" ? " (OVERDUE)" : ""}`,
      });
    }
  }

  if (emailLines.length) {
    const overdueLines = emailLines.filter((l) => l.type === "overdue").map((l) => l.line);
    const dueSoonLines = emailLines.filter((l) => l.type === "due_soon").map((l) => l.line);
    const sections: string[] = [];
    if (overdueLines.length) sections.push(`Overdue checklists:\n${overdueLines.join("\n")}`);
    if (dueSoonLines.length) sections.push(`Due within 24 hours:\n${dueSoonLines.join("\n")}`);
    const subject = overdueLines.length
      ? `KBC Portal: ${overdueLines.length} overdue checklist${overdueLines.length > 1 ? "s" : ""}`
      : `KBC Portal: checklist${dueSoonLines.length > 1 ? "s" : ""} due soon`;
    try {
      const recipients = await administrativeEmailRecipients();
      if (!recipients.length) throw new Error("No administrative email recipients are configured");
      const delivered = await sendEmail({
        to: recipients,
        subject,
        text: `${sections.join("\n\n")}\n\nSign in to the KBC Operations Portal to review and complete these checklists.`,
      });
      if (!delivered) throw new Error("Email delivery is not configured");
      console.log(`[notifications] Sent reminder email (${emailLines.length} item(s)).`);
      // Only mark as emailed after a successful send, so transient failures
      // (e.g. rate limits) are retried on the next reminder pass.
      for (const l of emailLines) {
        await db
          .update(checklistInstances)
          .set(l.type === "overdue" ? { overdueEmailAt: now } : { dueSoonEmailAt: now })
          .where(eq(checklistInstances.id, l.instanceId));
      }
    } catch (err) {
      // Email is best-effort; in-app notifications were already created.
      console.error("[notifications] Failed to send reminder email:", err);
    }
  }
}

// ---------- Routes ----------

export function registerNotificationRoutes(app: Express) {
  app.get("/api/notifications", requireAuth, async (req, res) => {
    await ensureReminders();
    const user = getUser(req);
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
    const [unread] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
    res.json({ notifications: rows, unreadCount: unread?.value ?? 0 });
  });

  app.post("/api/notifications/:id/read", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid id" });
    const user = getUser(req);
    const [updated] = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)))
      .returning();
    if (!updated) return res.status(404).json({ message: "Notification not found" });
    res.json({ notification: updated });
  });

  app.post("/api/notifications/read-all", requireAuth, async (req, res) => {
    const user = getUser(req);
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
    res.json({ message: "All notifications marked as read" });
  });

  app.patch("/api/notifications/prefs", requireAuth, async (req, res) => {
    const parsed = notificationPrefsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid input" });
    }
    const user = getUser(req);
    const [updated] = await db
      .update(users)
      .set({
        notifyDueSoon: parsed.data.notifyDueSoon,
        notifyOverdue: parsed.data.notifyOverdue,
      })
      .where(eq(users.id, user.id))
      .returning();
    res.json({ user: toSafeUser(updated) });
  });
}
