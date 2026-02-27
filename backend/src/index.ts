import "@vibecodeapp/proxy"; // DO NOT REMOVE OTHERWISE VIBECODE PROXY WILL NOT WORK
import { Hono } from "hono";
import { cors } from "hono/cors";
import "./env";
import { supabaseAuthMiddleware } from "./supabase-auth";
import { sampleRouter } from "./routes/sample";
import { marketRouter } from "./routes/market";
import { vehicleRouter } from "./routes/vehicles";
import { extensionRouter } from "./routes/extension";
import { conversationsRouter } from "./routes/conversations";
import { billingRouter } from "./routes/billing";
import { marketcheckRouter } from "./routes/marketcheck";
import { appointmentsRouter } from "./routes/appointments";
import { leadsRouter } from "./routes/leads";
import { logger } from "hono/logger";

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

// Extension-facing conversation endpoints — called without credentials
app.use("/api/conversations/:id/messages", cors({ origin: "*", credentials: false }));
app.use("/api/conversations", cors({ origin: "*", credentials: false }));

// Stripe webhook — called by Stripe servers, no credentials
app.use("/api/billing/webhook", cors({ origin: "*", credentials: false }));

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
app.route("/api/sample", sampleRouter);
app.route("/api/market", marketRouter);
app.route("/api/vehicles", vehicleRouter);
app.route("/api/extension", extensionRouter);
app.route("/api/conversations", conversationsRouter);
app.route("/api/billing", billingRouter);
app.route("/api/marketcheck", marketcheckRouter);
app.route("/api/appointments", appointmentsRouter);
app.route("/api/leads", leadsRouter);

const port = Number(process.env.PORT) || 3000;

export default {
  port,
  fetch: app.fetch,
};
