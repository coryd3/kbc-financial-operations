import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { csrfOriginGuard } from "./csrf.ts";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(csrfOriginGuard);
  app.get("/api/data", (_req, res) => res.json({ ok: true }));
  app.post("/api/action", (_req, res) => res.json({ ok: true }));
  app.post("/api/logout", (_req, res) => res.json({ ok: true }));
  app.delete("/api/thing/1", (_req, res) => res.json({ ok: true }));
  return app;
}

const app = buildApp();

describe("csrfOriginGuard", () => {
  it("blocks a bodyless POST from a foreign origin", async () => {
    const res = await request(app)
      .post("/api/logout")
      .set("Origin", "https://evil.example.com");
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/cross-site/i);
  });

  it("blocks a JSON mutation from a foreign origin", async () => {
    const res = await request(app)
      .post("/api/action")
      .set("Origin", "https://evil.example.com")
      .send({ a: 1 });
    expect(res.status).toBe(403);
  });

  it("blocks DELETE from a foreign origin", async () => {
    const res = await request(app)
      .delete("/api/thing/1")
      .set("Origin", "https://evil.example.com");
    expect(res.status).toBe(403);
  });

  it("allows a same-origin POST (Origin host matches Host header)", async () => {
    const res = await request(app)
      .post("/api/action")
      .set("Host", "myapp.example.com")
      .set("Origin", "https://myapp.example.com")
      .send({ a: 1 });
    expect(res.status).toBe(200);
  });

  it("allows POST with no Origin header (non-browser clients)", async () => {
    const res = await request(app).post("/api/action").send({ a: 1 });
    expect(res.status).toBe(200);
  });

  it("allows GET regardless of origin", async () => {
    const res = await request(app)
      .get("/api/data")
      .set("Origin", "https://evil.example.com");
    expect(res.status).toBe(200);
  });

  it("rejects a malformed Origin header on mutations", async () => {
    const res = await request(app)
      .post("/api/action")
      .set("Origin", "not a url")
      .send({ a: 1 });
    expect(res.status).toBe(403);
  });

  it("allows origins listed in REPLIT_DEV_DOMAIN / REPLIT_DOMAINS", async () => {
    const prevDev = process.env.REPLIT_DEV_DOMAIN;
    const prevDomains = process.env.REPLIT_DOMAINS;
    process.env.REPLIT_DEV_DOMAIN = "dev.repl.test";
    process.env.REPLIT_DOMAINS = "prod.repl.app,other.repl.app";
    try {
      for (const origin of [
        "https://dev.repl.test",
        "https://prod.repl.app",
        "https://other.repl.app",
      ]) {
        const res = await request(app)
          .post("/api/action")
          .set("Origin", origin)
          .send({ a: 1 });
        expect(res.status).toBe(200);
      }
    } finally {
      if (prevDev === undefined) delete process.env.REPLIT_DEV_DOMAIN;
      else process.env.REPLIT_DEV_DOMAIN = prevDev;
      if (prevDomains === undefined) delete process.env.REPLIT_DOMAINS;
      else process.env.REPLIT_DOMAINS = prevDomains;
    }
  });
});
