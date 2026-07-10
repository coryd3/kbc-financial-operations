import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { eq, like, inArray } from "drizzle-orm";
import { db, pool } from "./db.ts";
import { users, members, type User } from "../shared/schema.ts";
import { registerRoutes } from "./routes.ts";
import { registerMemberRoutes } from "./memberRoutes.ts";

// The one-click "Approve & Link" button on /admin/users fires two sequential
// API calls: POST /api/admin/users/:id/approve, then
// POST /api/admin/members/:id/link. These tests run both real route handlers
// in one app (as in production) and prove the partial-failure path is safe:
// a failed link never rolls back or blocks the approval, the 409 carries a
// clear message for the UI banner, and the admin can still link manually.
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
  registerMemberRoutes(app);
  return app;
}

const app = buildTestApp();
const PREFIX = "apprlink_";

let adminId: number;
let pendingHappyId: number; // approve + link succeeds
let pendingConflictId: number; // approve succeeds, link 409s
let pendingPlainId: number; // approved without linking
let occupyingUserId: number; // active user already linked to takenMemberId

let freeMemberId: number; // unlinked profile, target of the happy path
let takenMemberId: number; // profile already linked to occupyingUserId
let spareMemberId: number; // unlinked profile, used for the manual recovery

const as = (userId: number) => ({ "x-test-user-id": String(userId) });

async function getDbUser(id: number): Promise<User> {
  const [u] = await db.select().from(users).where(eq(users.id, id));
  return u;
}

async function getMemberLink(memberId: number): Promise<number | null> {
  const [m] = await db
    .select({ userId: members.userId })
    .from(members)
    .where(eq(members.id, memberId));
  return m.userId;
}

// Mirror of the client mutation in AdminUsers.tsx (approveAndLinkMut):
// approve first, then link; stop and surface the error if either call fails.
async function approveAndLink(actorId: number, userId: number, memberId: number) {
  const approveRes = await request(app)
    .post(`/api/admin/users/${userId}/approve`)
    .set(as(actorId));
  if (approveRes.status !== 200) return { failedStep: "approve" as const, approveRes, linkRes: null };
  const linkRes = await request(app)
    .post(`/api/admin/members/${memberId}/link`)
    .set(as(actorId))
    .send({ userId });
  return { failedStep: linkRes.status === 200 ? null : ("link" as const), approveRes, linkRes };
}

beforeAll(async () => {
  await cleanup();

  const inserted = await db
    .insert(users)
    .values([
      { username: `${PREFIX}admin`, passwordHash: "x", fullName: "Approving Admin", role: "admin", status: "active" },
      { username: `${PREFIX}happy`, passwordHash: "x", fullName: "Happy Path", role: "member", status: "pending" },
      { username: `${PREFIX}conflict`, passwordHash: "x", fullName: "Conflict Path", role: "member", status: "pending" },
      { username: `${PREFIX}plain`, passwordHash: "x", fullName: "Plain Approve", role: "member", status: "pending" },
      { username: `${PREFIX}occupier`, passwordHash: "x", fullName: "Occupying User", role: "member", status: "active" },
    ])
    .returning({ id: users.id, username: users.username });
  const byName = Object.fromEntries(inserted.map((u) => [u.username, u.id]));
  adminId = byName[`${PREFIX}admin`];
  pendingHappyId = byName[`${PREFIX}happy`];
  pendingConflictId = byName[`${PREFIX}conflict`];
  pendingPlainId = byName[`${PREFIX}plain`];
  occupyingUserId = byName[`${PREFIX}occupier`];

  const insertedMembers = await db
    .insert(members)
    .values([
      { firstName: PREFIX, lastName: "Free" },
      { firstName: PREFIX, lastName: "Taken", userId: occupyingUserId },
      { firstName: PREFIX, lastName: "Spare" },
    ])
    .returning({ id: members.id, lastName: members.lastName });
  freeMemberId = insertedMembers.find((m) => m.lastName === "Free")!.id;
  takenMemberId = insertedMembers.find((m) => m.lastName === "Taken")!.id;
  spareMemberId = insertedMembers.find((m) => m.lastName === "Spare")!.id;
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

async function cleanup() {
  await db.delete(members).where(inArray(members.firstName, [PREFIX]));
  await db.delete(users).where(like(users.username, `${PREFIX}%`));
}

describe("approve & link happy path", () => {
  it("approves the user and links the member profile in one flow", async () => {
    const { failedStep, approveRes, linkRes } = await approveAndLink(adminId, pendingHappyId, freeMemberId);
    expect(failedStep).toBeNull();
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.user.status).toBe("active");
    expect(linkRes!.status).toBe(200);
    expect(linkRes!.body.member.userId).toBe(pendingHappyId);

    const dbUser = await getDbUser(pendingHappyId);
    expect(dbUser.status).toBe("active");
    expect(dbUser.approvedAt).not.toBeNull();
    expect(await getMemberLink(freeMemberId)).toBe(pendingHappyId);
  });
});

describe("link conflict after approval (409)", () => {
  it("approval sticks even when the link step 409s, and the message is clear", async () => {
    // Simulates another admin having linked takenMemberId a moment earlier:
    // the profile the suggestion pointed at now belongs to occupyingUserId.
    const { failedStep, approveRes, linkRes } = await approveAndLink(adminId, pendingConflictId, takenMemberId);

    // The flow failed at the link step, not the approve step...
    expect(failedStep).toBe("link");
    expect(approveRes.status).toBe(200);
    expect(linkRes!.status).toBe(409);

    // ...with a clear message the UI banner will display (client surfaces body.message).
    expect(linkRes!.body.message).toBe(
      "That member profile is already linked to a different user account. Unlink it first, then link again."
    );

    // The approval was NOT rolled back or blocked: user is active and can be managed normally.
    const dbUser = await getDbUser(pendingConflictId);
    expect(dbUser.status).toBe("active");
    expect(dbUser.approvedAt).not.toBeNull();

    // The existing link on the contested profile is untouched — never silently stolen.
    expect(await getMemberLink(takenMemberId)).toBe(occupyingUserId);
  });

  it("409s when the user account is already linked to another profile", async () => {
    // The other race direction: occupyingUserId already holds takenMemberId,
    // so linking a second profile to the same account must be rejected.
    const res = await request(app)
      .post(`/api/admin/members/${spareMemberId}/link`)
      .set(as(adminId))
      .send({ userId: occupyingUserId });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe(
      "That user account is already linked to another member profile"
    );
    expect(await getMemberLink(spareMemberId)).toBeNull();
  });

  it("linking the contested profile to the SAME user it already holds is idempotent, not a 409", async () => {
    const res = await request(app)
      .post(`/api/admin/members/${takenMemberId}/link`)
      .set(as(adminId))
      .send({ userId: occupyingUserId });
    expect(res.status).toBe(200);
    expect(res.body.member.userId).toBe(occupyingUserId);
  });

  it("after the conflict, the admin can recover by manually linking a different profile", async () => {
    const res = await request(app)
      .post(`/api/admin/members/${spareMemberId}/link`)
      .set(as(adminId))
      .send({ userId: pendingConflictId });
    expect(res.status).toBe(200);
    expect(res.body.member.userId).toBe(pendingConflictId);
    expect(await getMemberLink(spareMemberId)).toBe(pendingConflictId);
  });

  it("re-clicking Approve & Link on the now-approved user fails cleanly at the approve step", async () => {
    // The pending card disappears after invalidation, but if a stale click lands,
    // approve returns 400 (only pending users can be approved) and nothing changes.
    const { failedStep, approveRes } = await approveAndLink(adminId, pendingConflictId, spareMemberId);
    expect(failedStep).toBe("approve");
    expect(approveRes.status).toBe(400);
    expect(approveRes.body.message).toBe("Only pending registrations can be approved");
    const dbUser = await getDbUser(pendingConflictId);
    expect(dbUser.status).toBe("active");
  });
});

describe("approve without linking", () => {
  it("plain approval activates the account and links nothing", async () => {
    const res = await request(app)
      .post(`/api/admin/users/${pendingPlainId}/approve`)
      .set(as(adminId));
    expect(res.status).toBe(200);
    expect(res.body.user.status).toBe("active");

    const dbUser = await getDbUser(pendingPlainId);
    expect(dbUser.status).toBe("active");
    // No member profile references this user.
    const linked = await db
      .select({ id: members.id })
      .from(members)
      .where(eq(members.userId, pendingPlainId));
    expect(linked).toHaveLength(0);
  });
});

describe("a failed link can never affect the user's account status", () => {
  it("link 404s (deleted profile) and 409s leave the approved user active", async () => {
    // 404: profile id that does not exist
    const missing = await request(app)
      .post(`/api/admin/members/999999999/link`)
      .set(as(adminId))
      .send({ userId: pendingPlainId });
    expect(missing.status).toBe(404);

    // 409: profile owned by someone else
    const conflict = await request(app)
      .post(`/api/admin/members/${takenMemberId}/link`)
      .set(as(adminId))
      .send({ userId: pendingPlainId });
    expect(conflict.status).toBe(409);

    const dbUser = await getDbUser(pendingPlainId);
    expect(dbUser.status).toBe("active");
  });
});
