import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import bcrypt from "bcryptjs";
import { eq, like } from "drizzle-orm";
import { db, pool } from "./db.ts";
import { users, type User } from "../shared/schema.ts";
import { registerRoutes } from "./routes.ts";
import { resetLoginThrottle } from "./loginThrottle.ts";

// Build the real Express app with the real route handlers and auth middleware.
// Only the session layer is substituted: a request header selects which user id
// the session carries, exactly as express-session would populate req.session.
function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const raw = req.headers["x-test-user-id"];
    (req as any).session = {
      ...(raw ? { userId: Number(raw) } : {}),
      destroy: (cb: () => void) => cb(),
    };
    next();
  });
  registerRoutes(app);
  return app;
}

const app = buildTestApp();
const PREFIX = "authtest_";
const PASSWORD = "CorrectHorse9!";

let passwordHash: string;

let superAdminId: number;
let adminId: number;
let admin2Id: number; // second admin, target for canManage checks
let treasurerId: number; // elevated but non-admin role
let memberId: number; // plain active member
let pendingApproveId: number; // pending -> approved in tests
let pendingRejectId: number; // pending -> rejected in tests
let activeDeactivateId: number; // active -> deactivated -> reactivated
let rejectedId: number; // stays rejected
let deactivatedId: number; // stays deactivated
let mustChangeId: number; // active, mustChangePassword = true

const as = (userId: number) => ({ "x-test-user-id": String(userId) });

async function getDbUser(id: number): Promise<User> {
  const [u] = await db.select().from(users).where(eq(users.id, id));
  return u;
}

async function login(username: string, password: string = PASSWORD) {
  return request(app).post("/api/auth/login").send({ username, password });
}

beforeAll(async () => {
  await cleanup();
  passwordHash = await bcrypt.hash(PASSWORD, 4);

  const inserted = await db
    .insert(users)
    .values([
      { username: `${PREFIX}super`, passwordHash, fullName: "Super Admin", role: "super_admin", status: "active" },
      { username: `${PREFIX}admin`, passwordHash, fullName: "Admin One", role: "admin", status: "active" },
      { username: `${PREFIX}admin2`, passwordHash, fullName: "Admin Two", role: "admin", status: "active" },
      { username: `${PREFIX}treasurer`, passwordHash, fullName: "Treasurer", role: "treasurer", status: "active" },
      { username: `${PREFIX}member`, passwordHash, fullName: "Plain Member", role: "member", status: "active" },
      { username: `${PREFIX}pending_a`, passwordHash, fullName: "Pending Approve", role: "member", status: "pending" },
      { username: `${PREFIX}pending_r`, passwordHash, fullName: "Pending Reject", role: "member", status: "pending" },
      { username: `${PREFIX}active_d`, passwordHash, fullName: "Active Deact", role: "member", status: "active" },
      { username: `${PREFIX}rejected`, passwordHash, fullName: "Rejected User", role: "member", status: "rejected" },
      { username: `${PREFIX}deactivated`, passwordHash, fullName: "Deactivated User", role: "member", status: "deactivated" },
      { username: `${PREFIX}mustchange`, passwordHash, fullName: "Must Change", role: "member", status: "active", mustChangePassword: true },
      { username: `${PREFIX}throttle`, passwordHash, fullName: "Throttle Target", role: "member", status: "active" },
      { username: `${PREFIX}throttle2`, passwordHash, fullName: "Throttle Bystander", role: "member", status: "active" },
    ])
    .returning({ id: users.id, username: users.username });
  const byName = Object.fromEntries(inserted.map((u) => [u.username, u.id]));
  superAdminId = byName[`${PREFIX}super`];
  adminId = byName[`${PREFIX}admin`];
  admin2Id = byName[`${PREFIX}admin2`];
  treasurerId = byName[`${PREFIX}treasurer`];
  memberId = byName[`${PREFIX}member`];
  pendingApproveId = byName[`${PREFIX}pending_a`];
  pendingRejectId = byName[`${PREFIX}pending_r`];
  activeDeactivateId = byName[`${PREFIX}active_d`];
  rejectedId = byName[`${PREFIX}rejected`];
  deactivatedId = byName[`${PREFIX}deactivated`];
  mustChangeId = byName[`${PREFIX}mustchange`];
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

async function cleanup() {
  await db.delete(users).where(like(users.username, `${PREFIX}%`));
}

describe("registration always creates a pending member", () => {
  it("creates a pending user with role member and never echoes the password hash", async () => {
    const res = await request(app).post("/api/auth/register").send({
      username: `${PREFIX}newreg`,
      password: PASSWORD,
      fullName: "New Registrant",
      // attempt to smuggle in privileged fields — must be ignored
      role: "super_admin",
      status: "active",
      mustChangePassword: false,
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("member");
    expect(res.body.user.status).toBe("pending");
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");

    const dbUser = await getDbUser(res.body.user.id);
    expect(dbUser.role).toBe("member");
    expect(dbUser.status).toBe("pending");
  });

  it("a freshly registered (pending) user cannot log in", async () => {
    const res = await login(`${PREFIX}newreg`);
    expect(res.status).toBe(403);
  });

  it("rejects duplicate usernames case-insensitively", async () => {
    const res = await request(app).post("/api/auth/register").send({
      username: `${PREFIX.toUpperCase()}NEWREG`,
      password: PASSWORD,
      fullName: "Dup",
    });
    expect(res.status).toBe(409);
  });

  it("rejects weak passwords", async () => {
    const res = await request(app).post("/api/auth/register").send({
      username: `${PREFIX}weakpw`,
      password: "short",
      fullName: "Weak",
    });
    expect(res.status).toBe(400);
  });
});

describe("login is refused for every non-active status", () => {
  it("pending users cannot log in even with the correct password", async () => {
    const res = await login(`${PREFIX}pending_a`);
    expect(res.status).toBe(403);
  });

  it("rejected users cannot log in", async () => {
    const res = await login(`${PREFIX}rejected`);
    expect(res.status).toBe(403);
  });

  it("deactivated users cannot log in", async () => {
    const res = await login(`${PREFIX}deactivated`);
    expect(res.status).toBe(403);
  });

  it("wrong password and unknown username both return 401", async () => {
    const wrong = await login(`${PREFIX}member`, "not-the-password");
    expect(wrong.status).toBe(401);
    const unknown = await login(`${PREFIX}nosuchuser`);
    expect(unknown.status).toBe(401);
  });

  it("an active user logs in and the response never contains the password hash", async () => {
    const res = await login(`${PREFIX}member`);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(memberId);
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });

  it("a pending user's session is treated as unauthenticated on protected routes", async () => {
    const me = await request(app).get("/api/auth/me").set(as(pendingApproveId));
    expect(me.status).toBe(401);
    const rejected = await request(app).get("/api/auth/me").set(as(rejectedId));
    expect(rejected.status).toBe(401);
    const deactivated = await request(app).get("/api/auth/me").set(as(deactivatedId));
    expect(deactivated.status).toBe(401);
  });
});

describe("approve / reject / deactivate / reactivate change access", () => {
  it("approving a pending user lets them log in", async () => {
    const res = await request(app)
      .post(`/api/admin/users/${pendingApproveId}/approve`)
      .set(as(adminId));
    expect(res.status).toBe(200);
    expect(res.body.user.status).toBe("active");
    const loginRes = await login(`${PREFIX}pending_a`);
    expect(loginRes.status).toBe(200);
  });

  it("approve only applies to pending accounts", async () => {
    const res = await request(app)
      .post(`/api/admin/users/${memberId}/approve`)
      .set(as(adminId));
    expect(res.status).toBe(400);
  });

  it("rejecting a pending user keeps them locked out", async () => {
    const res = await request(app)
      .post(`/api/admin/users/${pendingRejectId}/reject`)
      .set(as(adminId));
    expect(res.status).toBe(200);
    expect(res.body.user.status).toBe("rejected");
    const loginRes = await login(`${PREFIX}pending_r`);
    expect(loginRes.status).toBe(403);
  });

  it("deactivating an active user cuts off login and existing sessions", async () => {
    const before = await request(app).get("/api/auth/me").set(as(activeDeactivateId));
    expect(before.status).toBe(200);

    const res = await request(app)
      .post(`/api/admin/users/${activeDeactivateId}/deactivate`)
      .set(as(adminId));
    expect(res.status).toBe(200);

    const loginRes = await login(`${PREFIX}active_d`);
    expect(loginRes.status).toBe(403);
    // an existing session for that user is now treated as logged out
    const after = await request(app).get("/api/auth/me").set(as(activeDeactivateId));
    expect(after.status).toBe(401);
  });

  it("reactivating restores login", async () => {
    const res = await request(app)
      .post(`/api/admin/users/${activeDeactivateId}/reactivate`)
      .set(as(adminId));
    expect(res.status).toBe(200);
    const loginRes = await login(`${PREFIX}active_d`);
    expect(loginRes.status).toBe(200);
  });
});

describe("admin user-management endpoints are admin-only", () => {
  const managementCalls = (targetId: number): Array<[string, string, object?]> => [
    ["get", "/api/admin/users"],
    ["get", "/api/admin/pending-count"],
    ["post", `/api/admin/users/${targetId}/approve`],
    ["post", `/api/admin/users/${targetId}/reject`],
    ["post", `/api/admin/users/${targetId}/deactivate`],
    ["post", `/api/admin/users/${targetId}/reactivate`],
    ["patch", `/api/admin/users/${targetId}/role`, { role: "deacon" }],
  ];

  it("returns 401 for unauthenticated requests", async () => {
    for (const [method, path, body] of managementCalls(memberId)) {
      const res = await (request(app) as any)[method](path).send(body ?? {});
      expect(res.status, `${method.toUpperCase()} ${path}`).toBe(401);
    }
  });

  it("returns 403 for every non-admin role, even elevated ones", async () => {
    for (const [label, userId] of [
      ["member", memberId],
      ["treasurer", treasurerId],
    ] as const) {
      for (const [method, path, body] of managementCalls(memberId)) {
        const res = await (request(app) as any)[method](path).set(as(userId)).send(body ?? {});
        expect(res.status, `${label}: ${method.toUpperCase()} ${path}`).toBe(403);
      }
    }
  });
});

describe("canManage hierarchy cannot be bypassed", () => {
  it("an admin cannot manage another admin", async () => {
    for (const action of ["approve", "reject", "deactivate", "reactivate"]) {
      const res = await request(app)
        .post(`/api/admin/users/${admin2Id}/${action}`)
        .set(as(adminId));
      expect(res.status, action).toBe(403);
    }
    const role = await request(app)
      .patch(`/api/admin/users/${admin2Id}/role`)
      .set(as(adminId))
      .send({ role: "member" });
    expect(role.status).toBe(403);
    expect((await getDbUser(admin2Id)).role).toBe("admin");
  });

  it("an admin cannot manage a super admin", async () => {
    const res = await request(app)
      .post(`/api/admin/users/${superAdminId}/deactivate`)
      .set(as(adminId));
    expect(res.status).toBe(403);
    const role = await request(app)
      .patch(`/api/admin/users/${superAdminId}/role`)
      .set(as(adminId))
      .send({ role: "member" });
    expect(role.status).toBe(403);
    expect((await getDbUser(superAdminId)).role).toBe("super_admin");
  });

  it("nobody can manage themselves", async () => {
    const admin = await request(app)
      .post(`/api/admin/users/${adminId}/deactivate`)
      .set(as(adminId));
    expect(admin.status).toBe(403);
    const superSelf = await request(app)
      .patch(`/api/admin/users/${superAdminId}/role`)
      .set(as(superAdminId))
      .send({ role: "member" });
    expect(superSelf.status).toBe(403);
  });

  it("an admin cannot assign admin or super_admin roles to anyone", async () => {
    for (const role of ["admin", "super_admin"]) {
      const res = await request(app)
        .patch(`/api/admin/users/${memberId}/role`)
        .set(as(adminId))
        .send({ role });
      expect(res.status, role).toBe(403);
    }
    expect((await getDbUser(memberId)).role).toBe("member");
  });

  it("an admin can assign non-admin roles to regular users", async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${memberId}/role`)
      .set(as(adminId))
      .send({ role: "deacon" });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("deacon");
    // restore
    await request(app)
      .patch(`/api/admin/users/${memberId}/role`)
      .set(as(superAdminId))
      .send({ role: "member" });
  });

  it("a super admin can manage admins, including demoting them", async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${admin2Id}/role`)
      .set(as(superAdminId))
      .send({ role: "member" });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("member");
    // restore, proving super admin can also promote to admin
    const restore = await request(app)
      .patch(`/api/admin/users/${admin2Id}/role`)
      .set(as(superAdminId))
      .send({ role: "admin" });
    expect(restore.status).toBe(200);
    expect(restore.body.user.role).toBe("admin");
  });

  it("invalid roles are rejected", async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${memberId}/role`)
      .set(as(superAdminId))
      .send({ role: "overlord" });
    expect(res.status).toBe(400);
  });

  it("GET /api/admin/users reports canManage flags matching the hierarchy", async () => {
    const res = await request(app).get("/api/admin/users").set(as(adminId)).query({ search: PREFIX });
    expect(res.status).toBe(200);
    const byId = Object.fromEntries(res.body.users.map((u: any) => [u.id, u]));
    expect(byId[superAdminId].canManage).toBe(false);
    expect(byId[admin2Id].canManage).toBe(false);
    expect(byId[adminId].canManage).toBe(false); // self
    expect(byId[memberId].canManage).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });
});

describe("must-change-password is enforced end to end", () => {
  it("login surfaces mustChangePassword so the client can force the change", async () => {
    const res = await login(`${PREFIX}mustchange`);
    expect(res.status).toBe(200);
    expect(res.body.user.mustChangePassword).toBe(true);
  });

  it("change-password requires a session", async () => {
    const res = await request(app)
      .post("/api/auth/change-password")
      .send({ currentPassword: PASSWORD, newPassword: "BrandNewPass1!" });
    expect(res.status).toBe(401);
  });

  it("rejects a wrong current password and weak new passwords", async () => {
    const wrong = await request(app)
      .post("/api/auth/change-password")
      .set(as(mustChangeId))
      .send({ currentPassword: "nope-wrong", newPassword: "BrandNewPass1!" });
    expect(wrong.status).toBe(400);

    const weak = await request(app)
      .post("/api/auth/change-password")
      .set(as(mustChangeId))
      .send({ currentPassword: PASSWORD, newPassword: "short" });
    expect(weak.status).toBe(400);

    // flag untouched by failed attempts
    expect((await getDbUser(mustChangeId)).mustChangePassword).toBe(true);
  });

  it("a successful change clears the flag and rotates the credential", async () => {
    const newPassword = "BrandNewPass1!";
    const res = await request(app)
      .post("/api/auth/change-password")
      .set(as(mustChangeId))
      .send({ currentPassword: PASSWORD, newPassword });
    expect(res.status).toBe(200);

    const dbUser = await getDbUser(mustChangeId);
    expect(dbUser.mustChangePassword).toBe(false);

    const oldLogin = await login(`${PREFIX}mustchange`, PASSWORD);
    expect(oldLogin.status).toBe(401);
    const newLogin = await login(`${PREFIX}mustchange`, newPassword);
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.user.mustChangePassword).toBe(false);
  });
});

describe("repeated failed logins are throttled", () => {
  beforeEach(async () => {
    await resetLoginThrottle();
  });

  afterAll(async () => {
    await resetLoginThrottle();
  });

  it("locks a username after 5 failed attempts, even if the 6th password is correct", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await login(`${PREFIX}throttle`, "wrong-password");
      expect(res.status, `attempt ${i + 1}`).toBe(401);
    }
    const blocked = await login(`${PREFIX}throttle`, PASSWORD);
    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toMatch(/too many failed login attempts/i);
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("the username lockout is case-insensitive", async () => {
    for (let i = 0; i < 5; i++) {
      await login(`${PREFIX}throttle`, "wrong-password");
    }
    const blocked = await login(`${PREFIX.toUpperCase()}THROTTLE`, PASSWORD);
    expect(blocked.status).toBe(429);
  });

  it("locking one username does not block other users", async () => {
    for (let i = 0; i < 5; i++) {
      await login(`${PREFIX}throttle`, "wrong-password");
    }
    const other = await login(`${PREFIX}throttle2`, PASSWORD);
    expect(other.status).toBe(200);
  });

  it("unknown usernames are throttled the same way", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await login(`${PREFIX}ghost`, "wrong-password");
      expect(res.status, `attempt ${i + 1}`).toBe(401);
    }
    const blocked = await login(`${PREFIX}ghost`, "wrong-password");
    expect(blocked.status).toBe(429);
  });

  it("a normal user with a few typos can still log in, and success clears the counter", async () => {
    for (let i = 0; i < 4; i++) {
      const res = await login(`${PREFIX}throttle`, "wrong-password");
      expect(res.status).toBe(401);
    }
    const ok = await login(`${PREFIX}throttle`, PASSWORD);
    expect(ok.status).toBe(200);

    // the successful login reset the failure count: 4 more typos still don't lock
    for (let i = 0; i < 4; i++) {
      await login(`${PREFIX}throttle`, "wrong-password");
    }
    const okAgain = await login(`${PREFIX}throttle`, PASSWORD);
    expect(okAgain.status).toBe(200);
  });

  it("spraying many usernames from one source trips the per-IP lockout", async () => {
    for (let i = 0; i < 20; i++) {
      await login(`${PREFIX}spray_${i}`, "wrong-password");
    }
    // a username never tried before is still blocked because the source is locked
    const blocked = await login(`${PREFIX}throttle2`, PASSWORD);
    expect(blocked.status).toBe(429);
  });
});
