import type { Express, Request, Response } from "express";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "./db.ts";
import {
  users,
  checklistTemplates,
  checklistTemplateSteps,
  checklistInstances,
  checklistInstanceSteps,
  checklistTemplateSchema,
  CHECKLIST_MANAGER_ROLES,
  ROLE_LABELS,
  type ChecklistTemplate,
  type Recurrence,
  type User,
} from "../shared/schema.ts";
import { requireAuth, requireRole } from "./auth.ts";
import { toCsv, sendCsv } from "./csv.ts";

const requireChecklistManager = requireRole(...CHECKLIST_MANAGER_ROLES);

function getUser(req: Request): User {
  return (req as any).user as User;
}

function isManager(user: User): boolean {
  return CHECKLIST_MANAGER_ROLES.includes(user.role);
}

// ---------- Period helpers ----------

/** ISO week key, e.g. "2026-W28" */
function weeklyPeriodKey(now: Date): string {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/** Month key, e.g. "2026-07" */
function monthlyPeriodKey(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** End of the current ISO week (Sunday 23:59:59 local). */
function endOfWeek(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayNum = d.getDay() || 7; // Monday = 1 ... Sunday = 7
  d.setDate(d.getDate() + (7 - dayNum));
  d.setHours(23, 59, 59, 0);
  return d;
}

/** End of the current month (last day, 23:59:59 local). */
function endOfMonth(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 0);
  return d;
}

function periodInfo(recurrence: Recurrence, now: Date): { periodKey: string; dueDate: Date } | null {
  if (recurrence === "weekly") return { periodKey: weeklyPeriodKey(now), dueDate: endOfWeek(now) };
  if (recurrence === "monthly") return { periodKey: monthlyPeriodKey(now), dueDate: endOfMonth(now) };
  return null;
}

// ---------- Instance spawning ----------

async function spawnInstance(
  template: ChecklistTemplate,
  opts: { periodKey?: string | null; dueDate?: Date | null; createdBy?: number | null; nameSuffix?: string },
) {
  const steps = await db
    .select()
    .from(checklistTemplateSteps)
    .where(eq(checklistTemplateSteps.templateId, template.id))
    .orderBy(asc(checklistTemplateSteps.position));

  const [instance] = await db
    .insert(checklistInstances)
    .values({
      templateId: template.id,
      name: opts.nameSuffix ? `${template.name} — ${opts.nameSuffix}` : template.name,
      periodKey: opts.periodKey ?? null,
      status: "open",
      dueDate: opts.dueDate ?? null,
      createdBy: opts.createdBy ?? null,
    })
    .onConflictDoNothing({
      target: [checklistInstances.templateId, checklistInstances.periodKey],
    })
    .returning();

  // Another server instance already spawned this period's instance.
  if (!instance) return null;

  if (steps.length) {
    await db.insert(checklistInstanceSteps).values(
      steps.map((s) => ({
        instanceId: instance.id,
        position: s.position,
        title: s.title,
        assignedRole: s.assignedRole,
      })),
    );
  }
  return instance;
}

let lastScheduleCheck = 0;
const SCHEDULE_CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Lazily spawn instances for recurring templates that don't yet have one for
 * the current period. Called at server start and (throttled) on checklist reads.
 */
export async function ensureScheduledInstances(force = false) {
  const now = Date.now();
  if (!force && now - lastScheduleCheck < SCHEDULE_CHECK_INTERVAL_MS) return;
  lastScheduleCheck = now;

  const templates = await db
    .select()
    .from(checklistTemplates)
    .where(
      and(
        eq(checklistTemplates.isActive, true),
        isNull(checklistTemplates.archivedAt),
        inArray(checklistTemplates.recurrence, ["weekly", "monthly"]),
      ),
    );

  const today = new Date();
  for (const template of templates) {
    const info = periodInfo(template.recurrence, today);
    if (!info) continue;
    const [existing] = await db
      .select({ id: checklistInstances.id })
      .from(checklistInstances)
      .where(
        and(
          eq(checklistInstances.templateId, template.id),
          eq(checklistInstances.periodKey, info.periodKey),
        ),
      );
    if (!existing) {
      const spawned = await spawnInstance(template, {
        periodKey: info.periodKey,
        dueDate: info.dueDate,
        nameSuffix: friendlyPeriod(template.recurrence, today),
      });
      if (spawned) {
        console.log(`[checklists] Spawned "${template.name}" for period ${info.periodKey}`);
      }
    }
  }
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function friendlyPeriod(recurrence: Recurrence, now: Date): string {
  if (recurrence === "weekly") {
    return `Week of ${MONTH_NAMES[now.getMonth()]} ${now.getDate() - ((now.getDay() || 7) - 1)}, ${now.getFullYear()}`;
  }
  return `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
}

// ---------- Reads with joined data ----------

async function loadTemplatesWithSteps() {
  const templates = await db
    .select()
    .from(checklistTemplates)
    .orderBy(asc(checklistTemplates.name));
  const steps = templates.length
    ? await db
        .select()
        .from(checklistTemplateSteps)
        .where(inArray(checklistTemplateSteps.templateId, templates.map((t) => t.id)))
        .orderBy(asc(checklistTemplateSteps.position))
    : [];
  return templates.map((t) => ({
    ...t,
    steps: steps.filter((s) => s.templateId === t.id),
  }));
}

async function loadInstanceDetail(id: number) {
  const [instance] = await db.select().from(checklistInstances).where(eq(checklistInstances.id, id));
  if (!instance) return null;
  const steps = await db
    .select({
      id: checklistInstanceSteps.id,
      instanceId: checklistInstanceSteps.instanceId,
      position: checklistInstanceSteps.position,
      title: checklistInstanceSteps.title,
      assignedRole: checklistInstanceSteps.assignedRole,
      completedAt: checklistInstanceSteps.completedAt,
      completedBy: checklistInstanceSteps.completedBy,
      completedByName: users.fullName,
    })
    .from(checklistInstanceSteps)
    .leftJoin(users, eq(checklistInstanceSteps.completedBy, users.id))
    .where(eq(checklistInstanceSteps.instanceId, id))
    .orderBy(asc(checklistInstanceSteps.position));
  return { ...instance, steps };
}

async function instanceProgressMap(instanceIds: number[]) {
  if (!instanceIds.length) return new Map<number, { total: number; completed: number }>();
  const rows = await db
    .select({
      instanceId: checklistInstanceSteps.instanceId,
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(${checklistInstanceSteps.completedAt})::int`,
    })
    .from(checklistInstanceSteps)
    .where(inArray(checklistInstanceSteps.instanceId, instanceIds))
    .groupBy(checklistInstanceSteps.instanceId);
  return new Map(rows.map((r) => [r.instanceId, { total: r.total, completed: r.completed }]));
}

// ---------- Routes ----------

export function registerChecklistRoutes(app: Express) {
  // Templates
  app.get("/api/checklists/templates", requireAuth, async (_req, res) => {
    const templates = await loadTemplatesWithSteps();
    res.json({ templates });
  });

  app.post("/api/checklists/templates", requireChecklistManager, async (req, res) => {
    const parsed = checklistTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid input" });
    }
    const { name, description, recurrence, isActive, steps } = parsed.data;
    const [template] = await db
      .insert(checklistTemplates)
      .values({
        name,
        description: description || null,
        recurrence,
        isActive,
        createdBy: getUser(req).id,
      })
      .returning();
    await db.insert(checklistTemplateSteps).values(
      steps.map((s, i) => ({
        templateId: template.id,
        position: i + 1,
        title: s.title,
        assignedRole: s.assignedRole ?? null,
      })),
    );
    res.status(201).json({ template });
  });

  app.patch("/api/checklists/templates/:id", requireChecklistManager, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid id" });
    const parsed = checklistTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid input" });
    }
    const { name, description, recurrence, isActive, steps } = parsed.data;
    const [updated] = await db
      .update(checklistTemplates)
      .set({ name, description: description || null, recurrence, isActive, updatedAt: new Date() })
      .where(eq(checklistTemplates.id, id))
      .returning();
    if (!updated) return res.status(404).json({ message: "Template not found" });
    // Replace steps wholesale (instances keep their own step snapshots).
    await db.delete(checklistTemplateSteps).where(eq(checklistTemplateSteps.templateId, id));
    await db.insert(checklistTemplateSteps).values(
      steps.map((s, i) => ({
        templateId: id,
        position: i + 1,
        title: s.title,
        assignedRole: s.assignedRole ?? null,
      })),
    );
    res.json({ template: updated });
  });

  // Retire (archive) a template that has runs, so history is preserved.
  // Templates that have never been run are deleted outright.
  app.delete("/api/checklists/templates/:id", requireChecklistManager, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid id" });
    const [template] = await db.select().from(checklistTemplates).where(eq(checklistTemplates.id, id));
    if (!template) return res.status(404).json({ message: "Template not found" });

    const [runCount] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(checklistInstances)
      .where(eq(checklistInstances.templateId, id));

    if ((runCount?.value ?? 0) > 0) {
      // Runs exist — archive instead of deleting so past runs and their
      // step-level who/when records are preserved.
      const [archived] = await db
        .update(checklistTemplates)
        .set({ archivedAt: new Date(), isActive: false, updatedAt: new Date() })
        .where(eq(checklistTemplates.id, id))
        .returning();
      return res.json({ archived: true, template: archived, message: "Template retired; past runs kept" });
    }

    await db.delete(checklistTemplates).where(eq(checklistTemplates.id, id));
    res.json({ archived: false, message: "Deleted" });
  });

  // Restore a retired template.
  app.post("/api/checklists/templates/:id/restore", requireChecklistManager, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid id" });
    const [template] = await db.select().from(checklistTemplates).where(eq(checklistTemplates.id, id));
    if (!template) return res.status(404).json({ message: "Template not found" });
    if (!template.archivedAt) return res.status(400).json({ message: "Template is not retired" });
    const [restored] = await db
      .update(checklistTemplates)
      .set({ archivedAt: null, isActive: true, updatedAt: new Date() })
      .where(eq(checklistTemplates.id, id))
      .returning();
    res.json({ template: restored });
  });

  // Shared loader for the per-template run history (JSON + CSV endpoints).
  async function loadTemplateHistory(id: number) {
    const [template] = await db.select().from(checklistTemplates).where(eq(checklistTemplates.id, id));
    if (!template) return null;

    const instances = await db
      .select()
      .from(checklistInstances)
      .where(eq(checklistInstances.templateId, id))
      .orderBy(desc(checklistInstances.createdAt))
      .limit(200);

    const instanceIds = instances.map((i) => i.id);
    const steps = instanceIds.length
      ? await db
          .select({
            id: checklistInstanceSteps.id,
            instanceId: checklistInstanceSteps.instanceId,
            position: checklistInstanceSteps.position,
            title: checklistInstanceSteps.title,
            assignedRole: checklistInstanceSteps.assignedRole,
            completedAt: checklistInstanceSteps.completedAt,
            completedBy: checklistInstanceSteps.completedBy,
            completedByName: users.fullName,
          })
          .from(checklistInstanceSteps)
          .leftJoin(users, eq(checklistInstanceSteps.completedBy, users.id))
          .where(inArray(checklistInstanceSteps.instanceId, instanceIds))
          .orderBy(asc(checklistInstanceSteps.instanceId), asc(checklistInstanceSteps.position))
      : [];

    const now = new Date();
    return {
      template,
      instances: instances.map((i) => {
        const instanceSteps = steps.filter((s) => s.instanceId === i.id);
        const completedSteps = instanceSteps.filter((s) => s.completedAt).length;
        let timeliness: "on_time" | "late" | "overdue" | null = null;
        if (i.status === "completed" && i.completedAt && i.dueDate) {
          timeliness = i.completedAt <= i.dueDate ? "on_time" : "late";
        } else if (i.status === "open" && i.dueDate && i.dueDate < now) {
          timeliness = "overdue";
        }
        return {
          ...i,
          timeliness,
          progress: { total: instanceSteps.length, completed: completedSteps },
          steps: instanceSteps,
        };
      }),
    };
  }

  // Per-template run history with step-level who/when detail (managers only)
  app.get("/api/checklists/templates/:id/history", requireChecklistManager, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid id" });
    const history = await loadTemplateHistory(id);
    if (!history) return res.status(404).json({ message: "Template not found" });
    res.json(history);
  });

  // CSV export of the run history: one row per step (runs with no steps get a
  // single summary row). Managers only — same audience as the history page.
  app.get("/api/checklists/templates/:id/history.csv", requireChecklistManager, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid id" });
    const history = await loadTemplateHistory(id);
    if (!history) return res.status(404).json({ message: "Template not found" });

    const timelinessLabel = (t: string | null, status: string) => {
      if (t === "on_time") return "On time";
      if (t === "late") return "Completed late";
      if (t === "overdue") return "Overdue";
      return status === "completed" ? "Completed" : "In progress";
    };
    const fmt = (d: Date | null) => (d ? d.toISOString() : "");

    const rows: unknown[][] = [];
    for (const run of history.instances) {
      const runCells = [
        run.name,
        run.periodKey ?? "",
        fmt(run.createdAt),
        fmt(run.dueDate),
        fmt(run.completedAt),
        run.status === "completed" ? "Completed" : "Open",
        timelinessLabel(run.timeliness, run.status),
        `${run.progress.completed}/${run.progress.total}`,
      ];
      if (run.steps.length === 0) {
        rows.push([...runCells, "", "", "", "", ""]);
      } else {
        for (const step of run.steps) {
          rows.push([
            ...runCells,
            step.position,
            step.title,
            step.assignedRole ? ROLE_LABELS[step.assignedRole] : "",
            step.completedAt ? (step.completedByName ?? "Unknown") : "",
            fmt(step.completedAt),
          ]);
        }
      }
    }

    const safeName = history.template.name.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "checklist";
    sendCsv(
      res,
      `kbc-${safeName}-history.csv`,
      toCsv(
        [
          "Run",
          "Period",
          "Started",
          "Due Date",
          "Completed",
          "Status",
          "Timeliness",
          "Steps Done",
          "Step #",
          "Step Title",
          "Assigned Role",
          "Step Completed By",
          "Step Completed At",
        ],
        rows,
      ),
    );
  });

  app.post("/api/checklists/templates/:id/start", requireChecklistManager, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid id" });
    const [template] = await db.select().from(checklistTemplates).where(eq(checklistTemplates.id, id));
    if (!template) return res.status(404).json({ message: "Template not found" });
    if (template.archivedAt) {
      return res.status(400).json({ message: "This template is retired. Restore it before starting a new checklist." });
    }
    const now = new Date();
    const instance = await spawnInstance(template, {
      createdBy: getUser(req).id,
      nameSuffix: `${MONTH_NAMES[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`,
    });
    if (!instance) return res.status(409).json({ message: "Could not start checklist" });
    res.status(201).json({ instance });
  });

  // Instances
  app.get("/api/checklists/instances", requireAuth, async (req, res) => {
    await ensureScheduledInstances();
    const status = String(req.query.status ?? "").trim();
    const condition =
      status === "open" || status === "completed"
        ? eq(checklistInstances.status, status)
        : undefined;
    const rows = await db
      .select()
      .from(checklistInstances)
      .where(condition)
      .orderBy(desc(checklistInstances.createdAt))
      .limit(200);
    const progress = await instanceProgressMap(rows.map((r) => r.id));
    res.json({
      instances: rows.map((r) => ({
        ...r,
        progress: progress.get(r.id) ?? { total: 0, completed: 0 },
      })),
    });
  });

  app.get("/api/checklists/instances/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid id" });
    const detail = await loadInstanceDetail(id);
    if (!detail) return res.status(404).json({ message: "Checklist not found" });
    res.json({ instance: detail });
  });

  app.delete("/api/checklists/instances/:id", requireChecklistManager, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid id" });
    const [deleted] = await db
      .delete(checklistInstances)
      .where(eq(checklistInstances.id, id))
      .returning();
    if (!deleted) return res.status(404).json({ message: "Checklist not found" });
    res.json({ message: "Deleted" });
  });

  // Step completion
  app.post("/api/checklists/steps/:id/complete", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid id" });
    const user = getUser(req);
    const [step] = await db
      .select()
      .from(checklistInstanceSteps)
      .where(eq(checklistInstanceSteps.id, id));
    if (!step) return res.status(404).json({ message: "Step not found" });
    if (step.completedAt) return res.status(400).json({ message: "Step is already completed" });
    if (step.assignedRole && step.assignedRole !== user.role && !isManager(user)) {
      return res.status(403).json({ message: "This step is assigned to a different role" });
    }
    await db
      .update(checklistInstanceSteps)
      .set({ completedAt: new Date(), completedBy: user.id })
      .where(eq(checklistInstanceSteps.id, id));

    // If every step is now complete, mark the checklist completed.
    const [remaining] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(checklistInstanceSteps)
      .where(
        and(eq(checklistInstanceSteps.instanceId, step.instanceId), isNull(checklistInstanceSteps.completedAt)),
      );
    if ((remaining?.value ?? 0) === 0) {
      await db
        .update(checklistInstances)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(checklistInstances.id, step.instanceId));
    }
    const detail = await loadInstanceDetail(step.instanceId);
    res.json({ instance: detail });
  });

  app.post("/api/checklists/steps/:id/uncomplete", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid id" });
    const user = getUser(req);
    const [step] = await db
      .select()
      .from(checklistInstanceSteps)
      .where(eq(checklistInstanceSteps.id, id));
    if (!step) return res.status(404).json({ message: "Step not found" });
    if (!step.completedAt) return res.status(400).json({ message: "Step is not completed" });
    if (step.completedBy !== user.id && !isManager(user)) {
      return res.status(403).json({ message: "Only the person who completed this step (or a leader) can undo it" });
    }
    await db
      .update(checklistInstanceSteps)
      .set({ completedAt: null, completedBy: null })
      .where(eq(checklistInstanceSteps.id, id));
    // Re-open the checklist if it had been completed.
    await db
      .update(checklistInstances)
      .set({ status: "open", completedAt: null })
      .where(eq(checklistInstances.id, step.instanceId));
    const detail = await loadInstanceDetail(step.instanceId);
    res.json({ instance: detail });
  });

  // My tasks: open steps assigned to my role (or unassigned) on open checklists
  app.get("/api/checklists/my-tasks", requireAuth, async (req, res) => {
    await ensureScheduledInstances();
    const user = getUser(req);
    const rows = await db
      .select({
        stepId: checklistInstanceSteps.id,
        title: checklistInstanceSteps.title,
        position: checklistInstanceSteps.position,
        assignedRole: checklistInstanceSteps.assignedRole,
        instanceId: checklistInstances.id,
        instanceName: checklistInstances.name,
        dueDate: checklistInstances.dueDate,
      })
      .from(checklistInstanceSteps)
      .innerJoin(checklistInstances, eq(checklistInstanceSteps.instanceId, checklistInstances.id))
      .where(
        and(
          eq(checklistInstances.status, "open"),
          isNull(checklistInstanceSteps.completedAt),
          isManager(user)
            ? undefined
            : sql`(${checklistInstanceSteps.assignedRole} = ${user.role} OR ${checklistInstanceSteps.assignedRole} IS NULL)`,
        ),
      )
      .orderBy(asc(checklistInstances.dueDate), asc(checklistInstances.id), asc(checklistInstanceSteps.position));
    res.json({ tasks: rows });
  });

  // Dashboard summary: open/overdue/upcoming checklists + my open step count
  app.get("/api/checklists/summary", requireAuth, async (req, res) => {
    await ensureScheduledInstances();
    const user = getUser(req);
    const now = new Date();
    const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const openInstances = await db
      .select()
      .from(checklistInstances)
      .where(eq(checklistInstances.status, "open"))
      .orderBy(asc(checklistInstances.dueDate));

    const progress = await instanceProgressMap(openInstances.map((i) => i.id));

    const overdue = openInstances.filter((i) => i.dueDate && i.dueDate < now);
    const upcoming = openInstances.filter((i) => i.dueDate && i.dueDate >= now && i.dueDate <= soon);

    const [myStepCount] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(checklistInstanceSteps)
      .innerJoin(checklistInstances, eq(checklistInstanceSteps.instanceId, checklistInstances.id))
      .where(
        and(
          eq(checklistInstances.status, "open"),
          isNull(checklistInstanceSteps.completedAt),
          isManager(user)
            ? undefined
            : sql`(${checklistInstanceSteps.assignedRole} = ${user.role} OR ${checklistInstanceSteps.assignedRole} IS NULL)`,
        ),
      );

    const withProgress = (list: typeof openInstances) =>
      list.map((i) => ({ ...i, progress: progress.get(i.id) ?? { total: 0, completed: 0 } }));

    res.json({
      openCount: openInstances.length,
      myOpenSteps: myStepCount?.value ?? 0,
      overdue: withProgress(overdue).slice(0, 5),
      upcoming: withProgress(upcoming).slice(0, 5),
    });
  });
}
