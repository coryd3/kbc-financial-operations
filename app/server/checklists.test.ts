import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { and, eq, inArray, like } from "drizzle-orm";
import { db, pool } from "./db.ts";
import {
  users,
  checklistTemplates,
  checklistInstances,
  checklistInstanceSteps,
  CHECKLIST_MANAGER_ROLES,
  ROLES,
  type Role,
} from "../shared/schema.ts";
import { registerChecklistRoutes, ensureScheduledInstances } from "./checklists.ts";

// Build the real Express app with the real route handlers and auth middleware.
// Only the session layer is substituted: a request header selects which user id
// the session carries, exactly as express-session would populate req.session.
function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const raw = req.headers["x-test-user-id"];
    (req as any).session = raw ? { userId: Number(raw) } : {};
    next();
  });
  registerChecklistRoutes(app);
  return app;
}

const app = buildTestApp();
const PREFIX = "chktest_";

// One user per role so gating tests automatically cover roles added later.
const roleUserIds: Record<Role, number> = {} as Record<Role, number>;
let managerId: number; // treasurer (in CHECKLIST_MANAGER_ROLES)
let bookkeeperId: number; // non-manager with an assigned-step role
let countingId: number; // non-manager with a different assigned-step role
let memberId: number; // plain non-manager
let pendingUserId: number; // registered but not yet approved

const as = (userId: number) => ({ "x-test-user-id": String(userId) });

function templateBody(name: string, recurrence = "on_demand") {
  return {
    name,
    description: "",
    recurrence,
    isActive: true,
    steps: [
      { title: "Bookkeeper step", assignedRole: "bookkeeper" },
      { title: "Anyone step", assignedRole: null },
      { title: "Counting step", assignedRole: "counting_team" },
    ],
  };
}

beforeAll(async () => {
  await cleanup();

  const inserted = await db
    .insert(users)
    .values([
      ...ROLES.map((role) => ({
        username: `${PREFIX}${role}`,
        passwordHash: "x",
        fullName: `Test ${role}`,
        role,
        status: "active" as const,
      })),
      { username: `${PREFIX}pending`, passwordHash: "x", fullName: "Pending User", role: "member" as const, status: "pending" as const },
    ])
    .returning({ id: users.id, username: users.username });
  const byName = Object.fromEntries(inserted.map((u) => [u.username, u.id]));
  for (const role of ROLES) roleUserIds[role] = byName[`${PREFIX}${role}`];
  managerId = roleUserIds["treasurer"];
  bookkeeperId = roleUserIds["bookkeeper"];
  countingId = roleUserIds["counting_team"];
  memberId = roleUserIds["member"];
  pendingUserId = byName[`${PREFIX}pending`];
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

async function cleanup() {
  // Deleting templates cascades to instances and instance steps.
  await db.delete(checklistTemplates).where(like(checklistTemplates.name, `${PREFIX}%`));
  await db.delete(users).where(like(users.username, `${PREFIX}%`));
}

async function createTemplate(name: string, recurrence = "on_demand") {
  const res = await request(app)
    .post("/api/checklists/templates")
    .set(as(managerId))
    .send(templateBody(name, recurrence));
  expect(res.status).toBe(201);
  return res.body.template as { id: number };
}

async function startInstance(templateId: number) {
  const res = await request(app)
    .post(`/api/checklists/templates/${templateId}/start`)
    .set(as(managerId));
  expect(res.status).toBe(201);
  return res.body.instance as { id: number };
}

async function instanceSteps(instanceId: number) {
  return db
    .select()
    .from(checklistInstanceSteps)
    .where(eq(checklistInstanceSteps.instanceId, instanceId))
    .orderBy(checklistInstanceSteps.position);
}

describe("unauthenticated and unapproved access is rejected", () => {
  it("rejects checklist reads and writes without a session", async () => {
    for (const path of ["/api/checklists/templates", "/api/checklists/instances", "/api/checklists/my-tasks", "/api/checklists/summary"]) {
      const res = await request(app).get(path);
      expect(res.status, path).toBe(401);
    }
    const post = await request(app).post("/api/checklists/templates").send(templateBody(`${PREFIX}noauth`));
    expect(post.status).toBe(401);
    const step = await request(app).post("/api/checklists/steps/1/complete");
    expect(step.status).toBe(401);
  });

  it("rejects a pending (unapproved) user like an unauthenticated one", async () => {
    const res = await request(app).get("/api/checklists/templates").set(as(pendingUserId));
    expect(res.status).toBe(401);
    const post = await request(app)
      .post("/api/checklists/templates")
      .set(as(pendingUserId))
      .send(templateBody(`${PREFIX}pendingcreate`));
    expect(post.status).toBe(401);
  });
});

describe("template management is gated by CHECKLIST_MANAGER_ROLES for every role", () => {
  it("allows template creation exactly for manager roles (regression guard for new roles)", async () => {
    for (const role of ROLES) {
      const res = await request(app)
        .post("/api/checklists/templates")
        .set(as(roleUserIds[role]))
        .send(templateBody(`${PREFIX}gate_${role}`));
      const expected = CHECKLIST_MANAGER_ROLES.includes(role) ? 201 : 403;
      expect(res.status, `role=${role}`).toBe(expected);
    }
  });

  it("blocks non-managers from template update, delete, start, and instance delete", async () => {
    const template = await createTemplate(`${PREFIX}crud`);
    const instance = await startInstance(template.id);

    for (const userId of [bookkeeperId, memberId]) {
      const patch = await request(app)
        .patch(`/api/checklists/templates/${template.id}`)
        .set(as(userId))
        .send(templateBody(`${PREFIX}crud renamed`));
      expect(patch.status).toBe(403);

      const start = await request(app)
        .post(`/api/checklists/templates/${template.id}/start`)
        .set(as(userId));
      expect(start.status).toBe(403);

      const delInstance = await request(app)
        .delete(`/api/checklists/instances/${instance.id}`)
        .set(as(userId));
      expect(delInstance.status).toBe(403);

      const delTemplate = await request(app)
        .delete(`/api/checklists/templates/${template.id}`)
        .set(as(userId));
      expect(delTemplate.status).toBe(403);
    }

    // Template and instance are untouched after all the blocked attempts.
    const [stillThere] = await db
      .select()
      .from(checklistTemplates)
      .where(eq(checklistTemplates.id, template.id));
    expect(stillThere?.name).toBe(`${PREFIX}crud`);
    const [instStill] = await db
      .select()
      .from(checklistInstances)
      .where(eq(checklistInstances.id, instance.id));
    expect(instStill).toBeDefined();
  });

  it("any active logged-in user may read templates and instances", async () => {
    const list = await request(app).get("/api/checklists/templates").set(as(memberId));
    expect(list.status).toBe(200);
    const instances = await request(app).get("/api/checklists/instances").set(as(memberId));
    expect(instances.status).toBe(200);
  });
});

describe("step check-off permissions", () => {
  it("non-manager can check own-role and unassigned steps but not other-role steps", async () => {
    const template = await createTemplate(`${PREFIX}steps`);
    const instance = await startInstance(template.id);
    const steps = await instanceSteps(instance.id);
    const bookkeeperStep = steps.find((s) => s.assignedRole === "bookkeeper")!;
    const anyoneStep = steps.find((s) => s.assignedRole === null)!;
    const countingStep = steps.find((s) => s.assignedRole === "counting_team")!;

    // Blocked from another role's step.
    const blocked = await request(app)
      .post(`/api/checklists/steps/${countingStep.id}/complete`)
      .set(as(bookkeeperId));
    expect(blocked.status).toBe(403);

    // Allowed on own-role and unassigned steps.
    const own = await request(app)
      .post(`/api/checklists/steps/${bookkeeperStep.id}/complete`)
      .set(as(bookkeeperId));
    expect(own.status).toBe(200);
    const anyone = await request(app)
      .post(`/api/checklists/steps/${anyoneStep.id}/complete`)
      .set(as(bookkeeperId));
    expect(anyone.status).toBe(200);

    // The blocked step is still incomplete in the database.
    const after = await instanceSteps(instance.id);
    expect(after.find((s) => s.id === countingStep.id)!.completedAt).toBeNull();
    expect(after.find((s) => s.id === bookkeeperStep.id)!.completedBy).toBe(bookkeeperId);
  });

  it("manager can check a step assigned to any role", async () => {
    const template = await createTemplate(`${PREFIX}mgr_override`);
    const instance = await startInstance(template.id);
    const steps = await instanceSteps(instance.id);
    const countingStep = steps.find((s) => s.assignedRole === "counting_team")!;

    const res = await request(app)
      .post(`/api/checklists/steps/${countingStep.id}/complete`)
      .set(as(managerId));
    expect(res.status).toBe(200);
    const after = await instanceSteps(instance.id);
    expect(after.find((s) => s.id === countingStep.id)!.completedBy).toBe(managerId);
  });

  it("a completed step cannot be completed again", async () => {
    const template = await createTemplate(`${PREFIX}double`);
    const instance = await startInstance(template.id);
    const steps = await instanceSteps(instance.id);
    const anyoneStep = steps.find((s) => s.assignedRole === null)!;

    const first = await request(app)
      .post(`/api/checklists/steps/${anyoneStep.id}/complete`)
      .set(as(memberId));
    expect(first.status).toBe(200);
    const second = await request(app)
      .post(`/api/checklists/steps/${anyoneStep.id}/complete`)
      .set(as(managerId));
    expect(second.status).toBe(400);
  });

  it("only the completer or a manager can undo a completed step", async () => {
    const template = await createTemplate(`${PREFIX}undo`);
    const instance = await startInstance(template.id);
    const steps = await instanceSteps(instance.id);
    const anyoneStep = steps.find((s) => s.assignedRole === null)!;

    await request(app).post(`/api/checklists/steps/${anyoneStep.id}/complete`).set(as(bookkeeperId));

    // A different non-manager cannot undo it.
    const denied = await request(app)
      .post(`/api/checklists/steps/${anyoneStep.id}/uncomplete`)
      .set(as(memberId));
    expect(denied.status).toBe(403);

    // The completer can.
    const undone = await request(app)
      .post(`/api/checklists/steps/${anyoneStep.id}/uncomplete`)
      .set(as(bookkeeperId));
    expect(undone.status).toBe(200);

    // Re-complete, then a manager can also undo it.
    await request(app).post(`/api/checklists/steps/${anyoneStep.id}/complete`).set(as(bookkeeperId));
    const mgrUndo = await request(app)
      .post(`/api/checklists/steps/${anyoneStep.id}/uncomplete`)
      .set(as(managerId));
    expect(mgrUndo.status).toBe(200);
  });
});

describe("instance auto-complete and reopen", () => {
  it("completing the last step completes the instance; unchecking reopens it", async () => {
    const template = await createTemplate(`${PREFIX}autocomplete`);
    const instance = await startInstance(template.id);
    const steps = await instanceSteps(instance.id);

    for (const step of steps) {
      const res = await request(app)
        .post(`/api/checklists/steps/${step.id}/complete`)
        .set(as(managerId));
      expect(res.status).toBe(200);
    }

    let [inst] = await db.select().from(checklistInstances).where(eq(checklistInstances.id, instance.id));
    expect(inst.status).toBe("completed");
    expect(inst.completedAt).not.toBeNull();

    // Unchecking any step reopens the checklist.
    const reopen = await request(app)
      .post(`/api/checklists/steps/${steps[0].id}/uncomplete`)
      .set(as(managerId));
    expect(reopen.status).toBe(200);
    [inst] = await db.select().from(checklistInstances).where(eq(checklistInstances.id, instance.id));
    expect(inst.status).toBe("open");
    expect(inst.completedAt).toBeNull();
  });
});

describe("recurring spawn duplicate prevention", () => {
  it("ensureScheduledInstances never creates two instances for the same period", async () => {
    const template = await createTemplate(`${PREFIX}weekly`, "weekly");

    await ensureScheduledInstances(true);
    // Run again serially and also concurrently to exercise the unique-index guard.
    await Promise.all([ensureScheduledInstances(true), ensureScheduledInstances(true)]);
    await ensureScheduledInstances(true);

    const rows = await db
      .select()
      .from(checklistInstances)
      .where(eq(checklistInstances.templateId, template.id));
    expect(rows.length).toBe(1);
    expect(rows[0].periodKey).not.toBeNull();
    expect(rows[0].dueDate).not.toBeNull();

    // The spawned instance snapshots the template's steps.
    const steps = await instanceSteps(rows[0].id);
    expect(steps.length).toBe(3);
  });

  it("my-tasks only surfaces steps for the user's role or unassigned (non-manager)", async () => {
    const res = await request(app).get("/api/checklists/my-tasks").set(as(countingId));
    expect(res.status).toBe(200);
    for (const task of res.body.tasks as any[]) {
      expect(task.assignedRole === null || task.assignedRole === "counting_team", JSON.stringify(task)).toBe(true);
    }
  });
});
