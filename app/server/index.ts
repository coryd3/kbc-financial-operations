import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db.ts";
import { registerRoutes } from "./routes.ts";
import { registerMemberRoutes } from "./memberRoutes.ts";
import { registerGovernanceRoutes } from "./governance.ts";
import { registerNotificationRoutes } from "./notifications.ts";
import { csrfOriginGuard } from "./csrf.ts";

const app = express();
app.set("trust proxy", 1);
app.use(express.json());

const isProduction = process.env.NODE_ENV === "production";
if (isProduction && !process.env.SESSION_SECRET) {
  throw new Error(
    "SESSION_SECRET must be set in production. Add it as a deployment secret before publishing.",
  );
}
if (isProduction && !process.env.MFA_ENCRYPTION_KEY) {
  throw new Error("MFA_ENCRYPTION_KEY must be set in production.");
}

const PgStore = connectPgSimple(session);
app.use(
  session({
    store: new PgStore({ pool, createTableIfMissing: false }),
    secret: process.env.SESSION_SECRET || "kbc-dev-only-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  }),
);

app.use(csrfOriginGuard);

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("select 1");
    res.json({ status: "ok", financialMode: process.env.FINANCIAL_MODE || "hybrid" });
  } catch {
    res.status(503).json({ status: "unavailable" });
  }
});

registerRoutes(app);
registerMemberRoutes(app);
registerGovernanceRoutes(app);
registerNotificationRoutes(app);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  if (!res.headersSent) {
    res.status(500).json({ message: "Something went wrong on the server" });
  }
});

const port = Number(process.env.PORT) || 5000;

async function start() {
  const { createServer } = await import("http");
  const httpServer = createServer(app);

  if (process.env.NODE_ENV === "production") {
    const path = await import("path");
    const publicDir = path.resolve(import.meta.dirname, "public");
    app.use(express.static(publicDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(publicDir, "index.html"));
    });
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      configFile: new URL("../vite.config.ts", import.meta.url).pathname,
      server: { middlewareMode: true, allowedHosts: true, hmr: { server: httpServer } },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`KBC church app serving on port ${port}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
