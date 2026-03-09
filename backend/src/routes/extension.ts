import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";
import { getSupabaseUserId } from "../supabase-auth";

const extensionRouter = new Hono();

// POST /api/extension/pairing-code
// Generates a 6-digit pairing code for the browser extension
// Accepts any authenticated user OR falls back to "default" for single-user mode
extensionRouter.post("/pairing-code", async (c) => {
  const userId = getSupabaseUserId(c);
  // Use "default" as fallback for single-user deployments
  const effectiveUserId = userId || "default";

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes from now

  await prisma.extensionPairing.create({
    data: {
      id: crypto.randomUUID(),
      userId: effectiveUserId,
      code,
      paired: false,
      expiresAt,
    },
  });

  return c.json({ data: { code, expiresAt } });
});

// POST /api/extension/pair
// No auth required — extension calls this to pair itself using the code
extensionRouter.post(
  "/pair",
  zValidator("json", z.object({ code: z.string() })),
  async (c) => {
    const { code } = c.req.valid("json");
    const now = new Date();

    const pairing = await prisma.extensionPairing.findFirst({
      where: {
        code,
        paired: false,
        expiresAt: { gt: now },
      },
    });

    if (!pairing) {
      return c.json(
        { error: { message: "Invalid or expired pairing code" } },
        400
      );
    }

    await prisma.extensionPairing.update({
      where: { id: pairing.id },
      data: { paired: true },
    });

    return c.json({ data: { userId: pairing.userId, pairingId: pairing.id } });
  }
);

// POST /api/extension/posting-session
// Requires auth — creates a new posting session for the extension to pick up
extensionRouter.post(
  "/posting-session",
  zValidator(
    "json",
    z.object({
      vehicleId: z.number(),
      postText: z.string(),
      vehicleData: z.any(),
    })
  ),
  async (c) => {
    const userId = getSupabaseUserId(c);
    const effectiveUserId = userId || "default";

    const { vehicleId, postText, vehicleData } = c.req.valid("json");

    const session = await prisma.postingSession.create({
      data: {
        id: crypto.randomUUID(),
        userId: effectiveUserId,
        vehicleId,
        postText,
        vehicleData: JSON.stringify(vehicleData),
        status: "pending",
      },
    });

    return c.json({
      data: {
        sessionId: session.id,
        vehicleData: JSON.parse(session.vehicleData),
        postText: session.postText,
      },
    });
  }
);

// GET /api/extension/posting-session/latest
// No cookie auth — extension uses userId from query param (obtained via pairing)
extensionRouter.get("/posting-session/latest", async (c) => {
  const userId = c.req.query("userId");

  if (!userId) {
    return c.json({ error: { message: "userId query param is required" } }, 400);
  }

  const session = await prisma.postingSession.findFirst({
    where: {
      userId,
      status: "pending",
    },
    orderBy: { createdAt: "desc" },
  });

  if (!session) {
    return c.json({ data: null });
  }

  return c.json({
    data: {
      ...session,
      vehicleData: JSON.parse(session.vehicleData),
    },
  });
});

// POST /api/extension/posting-session/:id/complete
// No cookie auth — extension marks a posting session as posted
extensionRouter.post(
  "/posting-session/:id/complete",
  zValidator("json", z.object({ userId: z.string() })),
  async (c) => {
    const { userId } = c.req.valid("json");
    const sessionId = c.req.param("id");

    const session = await prisma.postingSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      return c.json({ error: { message: "Session not found" } }, 404);
    }

    await prisma.postingSession.update({
      where: { id: sessionId },
      data: { status: "posted" },
    });

    return c.json({ data: { success: true } });
  }
);

// POST /api/extension/transfer-session
// Extension sends Facebook cookies for server-side Playwright automation
extensionRouter.post(
  "/transfer-session",
  zValidator(
    "json",
    z.object({
      userId: z.string().min(1),
      cookies: z.array(z.object({
        name: z.string(),
        value: z.string(),
        domain: z.string(),
        path: z.string(),
        expires: z.number().optional(),
        httpOnly: z.boolean().optional(),
        secure: z.boolean().optional(),
        sameSite: z.enum(["Strict", "Lax", "None"]).optional(),
      })),
      userAgent: z.string().optional(),
    })
  ),
  async (c) => {
    const { userId, cookies, userAgent } = c.req.valid("json");

    if (!cookies.length) {
      return c.json({ error: { message: "No cookies provided" } }, 400);
    }

    // Check that we have essential FB cookies (c_user, xs)
    const essential = cookies.filter(
      (ck) => ck.name === "c_user" || ck.name === "xs" || ck.name === "datr"
    );
    if (essential.length < 2) {
      return c.json(
        { error: { message: "Missing essential Facebook cookies. Please log in to Facebook first." } },
        400
      );
    }

    await prisma.browserSession.upsert({
      where: { userId },
      create: {
        userId,
        cookies: JSON.stringify(cookies),
        userAgent: userAgent || null,
        valid: true,
        lastUsedAt: new Date(),
      },
      update: {
        cookies: JSON.stringify(cookies),
        userAgent: userAgent || undefined,
        valid: true,
        lastUsedAt: new Date(),
      },
    });

    return c.json({ data: { success: true, cookieCount: cookies.length } });
  }
);

export { extensionRouter };
