import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { inArray } from "drizzle-orm";
import { db, pool } from "./db.ts";
import { users, members, households, LEADERSHIP_ROLES, ROLES } from "../shared/schema.ts";
import { registerMemberRoutes } from "./memberRoutes.ts";

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
  registerMemberRoutes(app);
  return app;
}

const app = buildTestApp();
const PREFIX = "privtest_";

let leaderId: number; // deacon (in LEADERSHIP_ROLES)
let selfUserId: number; // regular member linked to a member profile
let otherUserId: number; // unrelated regular member
let treasurerId: number; // elevated but non-leadership role
let pendingUserId: number; // registered but not yet approved
let householdId: number;
let privateMemberId: number; // profile linked to selfUserId, everything hidden
let publicMemberId: number; // profile with nothing hidden

const as = (userId: number) => ({ "x-test-user-id": String(userId) });

beforeAll(async () => {
  await cleanup();

  const inserted = await db
    .insert(users)
    .values([
      { username: `${PREFIX}leader`, passwordHash: "x", fullName: "Lead Deacon", role: "deacon", status: "active" },
      { username: `${PREFIX}self`, passwordHash: "x", fullName: "Self Member", role: "member", status: "active" },
      { username: `${PREFIX}other`, passwordHash: "x", fullName: "Other Member", role: "member", status: "active" },
      { username: `${PREFIX}treasurer`, passwordHash: "x", fullName: "Treasurer User", role: "treasurer", status: "active" },
      { username: `${PREFIX}pending`, passwordHash: "x", fullName: "Pending User", role: "member", status: "pending" },
    ])
    .returning({ id: users.id, username: users.username });
  const byName = Object.fromEntries(inserted.map((u) => [u.username, u.id]));
  leaderId = byName[`${PREFIX}leader`];
  selfUserId = byName[`${PREFIX}self`];
  otherUserId = byName[`${PREFIX}other`];
  treasurerId = byName[`${PREFIX}treasurer`];
  pendingUserId = byName[`${PREFIX}pending`];

  const [h] = await db
    .insert(households)
    .values({ name: `${PREFIX}household`, address: "1 Hidden Household Ln" })
    .returning({ id: households.id });
  householdId = h.id;

  const insertedMembers = await db
    .insert(members)
    .values([
      {
        firstName: PREFIX,
        lastName: "Private",
        email: "private@example.com",
        phone: "555-0101",
        address: "42 Secret St",
        householdId,
        notes: "LEADERSHIP-ONLY-NOTE",
        hideEmail: true,
        hidePhone: true,
        hideAddress: true,
        userId: selfUserId,
      },
      {
        firstName: PREFIX,
        lastName: "Public",
        email: "public@example.com",
        phone: "555-0202",
        address: "7 Open Ave",
        notes: "ANOTHER-PRIVATE-NOTE",
        hideEmail: false,
        hidePhone: false,
        hideAddress: false,
      },
    ])
    .returning({ id: members.id, lastName: members.lastName });
  privateMemberId = insertedMembers.find((m) => m.lastName === "Private")!.id;
  publicMemberId = insertedMembers.find((m) => m.lastName === "Public")!.id;
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

async function cleanup() {
  const testUsers = await db.select({ id: users.id }).from(users).where(inArray(users.username, [
    `${PREFIX}leader`,
    `${PREFIX}self`,
    `${PREFIX}other`,
    `${PREFIX}treasurer`,
    `${PREFIX}pending`,
  ]));
  const ids = testUsers.map((u) => u.id);
  if (ids.length) await db.delete(members).where(inArray(members.userId, ids));
  await db.delete(members).where(inArray(members.firstName, [PREFIX]));
  await db.delete(households).where(inArray(households.name, [`${PREFIX}household`]));
  if (ids.length) await db.delete(users).where(inArray(users.id, ids));
}

async function fetchDirectory(userId: number) {
  const res = await request(app).get("/api/members").set(as(userId)).query({ search: PREFIX });
  expect(res.status).toBe(200);
  return res.body.members as any[];
}

describe("unauthenticated access is rejected", () => {
  it("rejects directory, households, and self-profile without a session", async () => {
    for (const path of ["/api/members", "/api/households", "/api/members/me"]) {
      const res = await request(app).get(path);
      expect(res.status, path).toBe(401);
    }
    const patch = await request(app).patch("/api/members/me").send({ email: "x@example.com" });
    expect(patch.status).toBe(401);
  });

  it("rejects a pending (unapproved) user like an unauthenticated one", async () => {
    const res = await request(app).get("/api/members").set(as(pendingUserId));
    expect(res.status).toBe(401);
  });
});

describe("hidden contact info never leaks to unrelated regular members", () => {
  it("returns null for hidden email/phone/address and omits notes", async () => {
    const dir = await fetchDirectory(otherUserId);
    const priv = dir.find((m) => m.id === privateMemberId);
    expect(priv).toBeDefined();
    expect(priv.email).toBeNull();
    expect(priv.phone).toBeNull();
    expect(priv.address).toBeNull();
    expect("notes" in priv).toBe(false);
    // non-hidden fields on another member remain visible
    const pub = dir.find((m) => m.id === publicMemberId);
    expect(pub.email).toBe("public@example.com");
    expect(pub.phone).toBe("555-0202");
    expect(pub.address).toBe("7 Open Ave");
    expect("notes" in pub).toBe(false);
  });

  it("no serialized directory response for a regular member contains hidden values or notes", async () => {
    const res = await request(app).get("/api/members").set(as(otherUserId)).query({ search: PREFIX });
    const body = JSON.stringify(res.body);
    expect(body).not.toContain("private@example.com");
    expect(body).not.toContain("555-0101");
    expect(body).not.toContain("42 Secret St");
    expect(body).not.toContain("LEADERSHIP-ONLY-NOTE");
    expect(body).not.toContain("ANOTHER-PRIVATE-NOTE");
  });

  it("elevated non-leadership roles (treasurer) are treated like regular members", async () => {
    const dir = await fetchDirectory(treasurerId);
    const priv = dir.find((m) => m.id === privateMemberId);
    expect(priv.email).toBeNull();
    expect(priv.phone).toBeNull();
    expect(priv.address).toBeNull();
    expect("notes" in priv).toBe(false);
  });

  it("hides household addresses from non-leadership viewers", async () => {
    const res = await request(app).get("/api/households").set(as(otherUserId));
    expect(res.status).toBe(200);
    const h = res.body.households.find((x: any) => x.id === householdId);
    expect(h).toBeDefined();
    expect(h.address).toBeNull();
  });
});

describe("a member always sees their own full record", () => {
  it("in the directory, hidden fields are visible to the linked user (but not notes)", async () => {
    const dir = await fetchDirectory(selfUserId);
    const mine = dir.find((m) => m.id === privateMemberId);
    expect(mine.email).toBe("private@example.com");
    expect(mine.phone).toBe("555-0101");
    expect(mine.address).toBe("42 Secret St");
    expect("notes" in mine).toBe(false);
  });

  it("GET /api/members/me returns the full own record (but not notes)", async () => {
    const res = await request(app).get("/api/members/me").set(as(selfUserId));
    expect(res.status).toBe(200);
    expect(res.body.member.email).toBe("private@example.com");
    expect(res.body.member.phone).toBe("555-0101");
    expect(res.body.member.address).toBe("42 Secret St");
    expect("notes" in res.body.member).toBe(false);
  });

  it("self visibility does not extend to other members' hidden fields", async () => {
    // sanity: another private member's hidden data stays hidden from selfUser too
    const dir = await fetchDirectory(selfUserId);
    const pub = dir.find((m) => m.id === publicMemberId);
    expect("notes" in pub).toBe(false);
  });
});

describe("leadership sees everything, including notes", () => {
  it("directory shows hidden contact info and notes to a deacon", async () => {
    const dir = await fetchDirectory(leaderId);
    const priv = dir.find((m) => m.id === privateMemberId);
    expect(priv.email).toBe("private@example.com");
    expect(priv.phone).toBe("555-0101");
    expect(priv.address).toBe("42 Secret St");
    expect(priv.notes).toBe("LEADERSHIP-ONLY-NOTE");
  });

  it("households show addresses to leadership", async () => {
    const res = await request(app).get("/api/households").set(as(leaderId));
    const h = res.body.households.find((x: any) => x.id === householdId);
    expect(h.address).toBe("1 Hidden Household Ln");
  });
});

describe("admin member/household routes are leadership-only", () => {
  const adminCalls: Array<[string, string, object?]> = [
    ["post", "/api/admin/members", { firstName: "X", lastName: "Y" }],
    ["patch", "/api/admin/members/1", { firstName: "X" }],
    ["delete", "/api/admin/members/1"],
    ["post", "/api/admin/members/1/link", { userId: null }],
    ["get", "/api/admin/linkable-users"],
    ["post", "/api/admin/households", { name: "X" }],
    ["patch", "/api/admin/households/1", { name: "X" }],
    ["delete", "/api/admin/households/1"],
  ];

  it("returns 401 for unauthenticated requests", async () => {
    for (const [method, path, body] of adminCalls) {
      const res = await (request(app) as any)[method](path).send(body ?? {});
      expect(res.status, `${method.toUpperCase()} ${path}`).toBe(401);
    }
  });

  it("returns 403 for every non-leadership role", async () => {
    for (const [role, userId] of [
      ["member", otherUserId],
      ["treasurer", treasurerId],
    ] as const) {
      for (const [method, path, body] of adminCalls) {
        const res = await (request(app) as any)[method](path).set(as(userId)).send(body ?? {});
        expect(res.status, `${role}: ${method.toUpperCase()} ${path}`).toBe(403);
      }
    }
  });

  it("allows a leadership role through the guard (sanity check)", async () => {
    const res = await request(app).get("/api/admin/linkable-users").set(as(leaderId));
    expect(res.status).toBe(200);
  });
});

describe("member-link suggestions rank exact above close matches", () => {
  let fuzzyPendingId: number;
  const memberIds: number[] = [];

  beforeAll(async () => {
    const [u] = await db
      .insert(users)
      .values({
        username: `${PREFIX}fuzzy_pending`,
        passwordHash: "x",
        fullName: "Bob Smithson",
        email: "bob@smithsonhome.net",
        role: "member",
        status: "pending",
      })
      .returning({ id: users.id });
    fuzzyPendingId = u.id;

    const inserted = await db
      .insert(members)
      .values([
        { firstName: "Bob", lastName: "Smithson" }, // exact name
        { firstName: "Robert", lastName: "Smithson" }, // nickname
        { firstName: "Bob", lastName: "Smythson" }, // last-name typo
        { firstName: "Carol", lastName: "Smithson", email: "carol@smithsonhome.net" }, // last name + email domain
        { firstName: "Alice", lastName: "Jonesberg" }, // unrelated
      ])
      .returning({ id: members.id });
    memberIds.push(...inserted.map((m) => m.id));
  });

  afterAll(async () => {
    if (memberIds.length) await db.delete(members).where(inArray(members.id, memberIds));
    if (fuzzyPendingId) await db.delete(users).where(inArray(users.id, [fuzzyPendingId]));
  });

  it("returns exact matches first, then close matches; unrelated profiles excluded", async () => {
    const res = await request(app).get("/api/admin/member-link-suggestions").set(as(leaderId));
    expect(res.status).toBe(200);
    const list = res.body.suggestions[fuzzyPendingId] as Array<{
      firstName: string;
      lastName: string;
      matchType: string;
      matchedOn: string;
    }>;
    expect(list).toBeDefined();

    const exact = list.filter((s) => s.matchType === "exact");
    const close = list.filter((s) => s.matchType === "close");
    expect(exact.map((s) => `${s.firstName} ${s.lastName}`)).toEqual(["Bob Smithson"]);
    expect(close.length).toBeGreaterThanOrEqual(2);
    expect(close.map((s) => `${s.firstName} ${s.lastName}`)).toContain("Robert Smithson");
    expect(close.map((s) => `${s.firstName} ${s.lastName}`)).toContain("Bob Smythson");
    expect(list.map((s) => `${s.firstName} ${s.lastName}`)).not.toContain("Alice Jonesberg");

    // exact entries always precede close entries in the returned order
    const firstCloseIdx = list.findIndex((s) => s.matchType === "close");
    const lastExactIdx = list.map((s) => s.matchType).lastIndexOf("exact");
    if (firstCloseIdx !== -1 && lastExactIdx !== -1) {
      expect(lastExactIdx).toBeLessThan(firstCloseIdx);
    }

    const nickname = list.find((s) => `${s.firstName} ${s.lastName}` === "Robert Smithson");
    expect(nickname?.matchedOn).toBe("nickname");
  });

  it("close matches are capped at 3 per pending user", async () => {
    const res = await request(app).get("/api/admin/member-link-suggestions").set(as(leaderId));
    const list = res.body.suggestions[fuzzyPendingId] as Array<{ matchType: string }>;
    expect(list.filter((s) => s.matchType === "close").length).toBeLessThanOrEqual(3);
  });
});

describe("role configuration guardrails", () => {
  it("LEADERSHIP_ROLES stays limited to super_admin, admin, deacon", () => {
    expect([...LEADERSHIP_ROLES].sort()).toEqual(["admin", "deacon", "super_admin"].sort());
    for (const role of LEADERSHIP_ROLES) expect(ROLES).toContain(role);
  });
});
