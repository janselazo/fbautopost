// Load Vibecode proxy when available (e.g. in Vibecode deployment). Ignore when running locally.
void import("@vibecodeapp/proxy").catch(() => {});
// Load backend/.env so MARKETCHECK_API_KEY etc. are set even when started from project root
import "./load-env";
import { Hono } from "hono";
import { cors } from "hono/cors";
import "./env";
import { supabaseAuthMiddleware } from "./supabase-auth";
import { vehicleRouter } from "./routes/vehicles";
import { extensionRouter } from "./routes/extension";
import { conversationsRouter } from "./routes/conversations";
import { marketcheckRouter } from "./routes/marketcheck";
import { appointmentsRouter } from "./routes/appointments";
import { leadsRouter } from "./routes/leads";
import { automationRouter } from "./routes/automation";
import { logger } from "hono/logger";
import { startScheduler } from "./automation/scheduler";

const app = new Hono();

// CORS middleware - validates origin against allowlist
const allowed = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/[a-z0-9-]+\.dev\.vibecode\.run$/,
  /^https:\/\/[a-z0-9-]+\.vibecode\.run$/,
  /^https:\/\/[a-z0-9-]+\.vibecodeapp\.com$/,
  /^https:\/\/[a-z0-9-]+\.vibecode\.dev$/,
  /^https:\/\/vibecode\.dev$/,
];

// Extension-facing endpoints are called without credentials — allow any origin
app.use(
  "/api/extension/pair",
  cors({ origin: "*", credentials: false })
);
app.use(
  "/api/extension/posting-session/latest",
  cors({ origin: "*", credentials: false })
);
app.use(
  "/api/extension/posting-session/:id/complete",
  cors({ origin: "*", credentials: false })
);
app.use(
  "/api/extension/transfer-session",
  cors({ origin: "*", credentials: false })
);

// Extension-facing conversation endpoints — called without credentials
app.use("/api/conversations/:id/messages", cors({ origin: "*", credentials: false }));
app.use("/api/conversations", cors({ origin: "*", credentials: false }));

app.use(
  "*",
  cors({
    origin: (origin) => (origin && allowed.some((re) => re.test(origin)) ? origin : null),
    credentials: true,
  })
);

// Logging
app.use("*", logger());

// Supabase JWT auth middleware - extracts user ID from Bearer token
app.use("*", supabaseAuthMiddleware);

// Health check endpoint
app.get("/health", (c) => c.json({ status: "ok" }));

// Get current user
app.get("/api/me", (c) => {
  const userId = c.get("supabaseUserId" as never) as string | undefined;
  if (!userId || userId === "default") return c.body(null, 401);
  return c.json({ data: { id: userId } });
});

// Routes
app.route("/api/vehicles", vehicleRouter);
app.route("/api/extension", extensionRouter);
app.route("/api/conversations", conversationsRouter);
app.route("/api/marketcheck", marketcheckRouter);
app.route("/api/appointments", appointmentsRouter);
app.route("/api/leads", leadsRouter);
app.route("/api/automation", automationRouter);

const port = Number(process.env.PORT) || 3000;

// Start the automation scheduler after a short delay to let the server boot
setTimeout(() => startScheduler(), 3000);

export default {
  port,
  fetch: app.fetch,
};
