import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";
import { getSupabaseUserId } from "../supabase-auth";

const conversationsRouter = new Hono();

// Use Supabase user id if available, otherwise fall back to "default" (single-user mode)
function getUserId(c: { get: (key: string) => unknown }): string {
  return getSupabaseUserId(c);
}

// GET /api/conversations - list all conversations for user
conversationsRouter.get("/", async (c) => {
  const userId = getUserId(c);

  const conversations = await prisma.conversation.findMany({
    where: { userId },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { lastMessageAt: "desc" },
  });

  return c.json({ data: conversations });
});

// GET /api/conversations/:id - get single conversation with all messages
conversationsRouter.get("/:id", async (c) => {
  const userId = getUserId(c);

  const conversation = await prisma.conversation.findFirst({
    where: { id: c.req.param("id"), userId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!conversation) return c.json({ error: { message: "Not found" } }, 404);
  return c.json({ data: conversation });
});

// POST /api/conversations - create a conversation (called by chrome extension)
conversationsRouter.post(
  "/",
  zValidator(
    "json",
    z.object({
      buyerName: z.string().min(1),
      buyerFbId: z.string().optional(),
      fbProfileUrl: z.string().optional(),
      vehicle: z.string().min(1),
      vehiclePrice: z.string().optional(),
      listingUrl: z.string().optional(),
      userId: z.string().min(1),
    })
  ),
  async (c) => {
    const data = c.req.valid("json");

    // Try to find existing conversation by listingUrl first (most reliable dedup)
    if (data.listingUrl) {
      const byUrl = await prisma.conversation.findFirst({
        where: { userId: data.userId, listingUrl: data.listingUrl },
      });
      if (byUrl) return c.json({ data: byUrl });
    }

    // Fallback: match by buyerName + vehicle
    const existing = await prisma.conversation.findFirst({
      where: {
        userId: data.userId,
        buyerName: data.buyerName,
        vehicle: data.vehicle,
      },
    });

    if (existing) return c.json({ data: existing });

    const conversation = await prisma.conversation.create({
      data: {
        userId: data.userId,
        buyerName: data.buyerName,
        buyerFbId: data.fbProfileUrl ?? data.buyerFbId,
        vehicle: data.vehicle,
        vehiclePrice: data.vehiclePrice,
        listingUrl: data.listingUrl,
      },
    });

    // Auto-create a lead for every new conversation (fire-and-forget, never blocks the response)
    prisma.lead.create({
      data: {
        userId: data.userId,
        name: data.buyerName,
        vehicle: data.vehicle || null,
        tag: "new",
        notes: `[conv:${conversation.id}]`,
      },
    }).catch(() => { /* non-critical */ });

    return c.json({ data: conversation }, 201);
  }
);

// POST /api/conversations/from-lead - create or link a conversation from a Lead (converts lead to opportunity)
conversationsRouter.post(
  "/from-lead",
  zValidator(
    "json",
    z.object({
      leadId: z.string().min(1),
      name: z.string().min(1),
      vehicle: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
      userId: z.string().optional(),
    })
  ),
  async (c) => {
    const data = c.req.valid("json");
    // Always prefer the session user; fall back to body userId for extension calls
    const userId = getUserId(c) || data.userId || "default";

    // 1. Look up the lead by leadId
    const lead = await prisma.lead.findFirst({
      where: { id: data.leadId, userId },
    });

    if (!lead) {
      return c.json({ error: { message: "Lead not found" } }, 404);
    }

    // 2. Extract linked conversation ID from notes field (format: [conv:{id}])
    const convMatch = lead.notes?.match(/\[conv:([^\]]+)\]/);
    const linkedConvId = convMatch ? convMatch[1] : null;

    let conversation;

    if (linkedConvId) {
      // Conversation already linked — update its crmStatus to 'new_lead'
      const existing = await prisma.conversation.findFirst({
        where: { id: linkedConvId, userId },
      });

      if (existing) {
        conversation = await prisma.conversation.update({
          where: { id: linkedConvId },
          data: { crmStatus: "new_lead" },
        });
      } else {
        // Linked conv ID in notes but record not found — create a fresh one
        conversation = await prisma.conversation.create({
          data: {
            userId,
            buyerName: data.name,
            vehicle: data.vehicle || "Unknown Vehicle",
            buyerPhone: data.phone ?? null,
            buyerEmail: data.email ?? null,
            crmStatus: "new_lead",
            status: "new",
          },
        });
      }
    } else {
      // 3. No linked conversation — create a new one
      conversation = await prisma.conversation.create({
        data: {
          userId,
          buyerName: data.name,
          vehicle: data.vehicle || "Unknown Vehicle",
          buyerPhone: data.phone ?? null,
          buyerEmail: data.email ?? null,
          crmStatus: "new_lead",
          status: "new",
        },
      });
    }

    // 4. Update the lead's tag to 'converted'
    await prisma.lead.update({
      where: { id: data.leadId },
      data: { tag: "converted" },
    });

    // 5. Return the conversation
    return c.json({ data: conversation });
  }
);

// PATCH /api/conversations/:id - update buyer phone/email
conversationsRouter.patch("/:id", async (c) => {
  const userId = getUserId(c);
  const body = await c.req.json();

  const conversation = await prisma.conversation.findFirst({
    where: { id: c.req.param("id"), userId },
  });
  if (!conversation) return c.json({ error: { message: "Not found" } }, 404);

  const updated = await prisma.conversation.update({
    where: { id: c.req.param("id") },
    data: {
      ...(body.buyerPhone !== undefined && { buyerPhone: body.buyerPhone }),
      ...(body.buyerEmail !== undefined && { buyerEmail: body.buyerEmail }),
    },
  });

  return c.json({ data: updated });
});

// PATCH /api/conversations/:id/status - update status
conversationsRouter.patch(
  "/:id/status",
  zValidator(
    "json",
    z.object({
      status: z.enum(["new", "contacted", "converted", "closed"]),
    })
  ),
  async (c) => {
    const userId = getUserId(c);

    const conversation = await prisma.conversation.findFirst({
      where: { id: c.req.param("id"), userId },
    });
    if (!conversation) return c.json({ error: { message: "Not found" } }, 404);

    const updated = await prisma.conversation.update({
      where: { id: c.req.param("id") },
      data: { status: c.req.valid("json").status },
    });

    return c.json({ data: updated });
  }
);

// PATCH /api/conversations/:id/crm-status - update CRM pipeline status
conversationsRouter.patch(
  "/:id/crm-status",
  zValidator(
    "json",
    z.object({
      crmStatus: z.enum([
        "new_lead",
        "contacted",
        "follow_up",
        "negotiation",
        "appointment_scheduled",
        "appointment_attended",
        "closed_won",
        "closed_lost",
      ]),
    })
  ),
  async (c) => {
    const userId = getUserId(c);

    const conversation = await prisma.conversation.findFirst({
      where: { id: c.req.param("id"), userId },
    });
    if (!conversation) return c.json({ error: { message: "Not found" } }, 404);

    const updated = await prisma.conversation.update({
      where: { id: c.req.param("id") },
      data: { crmStatus: c.req.valid("json").crmStatus },
    });

    return c.json({ data: updated });
  }
);

// POST /api/conversations/:id/messages - add a message to a conversation
conversationsRouter.post(
  "/:id/messages",
  zValidator(
    "json",
    z.object({
      direction: z.enum(["incoming", "outgoing"]),
      body: z.string().min(1),
      source: z
        .enum(["fb_marketplace", "manual", "ai_auto", "ai_suggested"])
        .default("manual"),
      intentScore: z.number().optional().default(0),
      userId: z.string().optional(),
    })
  ),
  async (c) => {
    const data = c.req.valid("json");
    const convId = c.req.param("id");
    const ownerId = getUserId(c) || data.userId || "default";

    const conversation = await prisma.conversation.findFirst({
      where: { id: convId, userId: ownerId },
    });
    if (!conversation) return c.json({ error: { message: "Not found" } }, 404);

    const message = await prisma.message.create({
      data: {
        conversationId: convId,
        direction: data.direction,
        body: data.body,
        source: data.source,
        intentScore: data.intentScore ?? 0,
      },
    });

    const newIntentScore = computeIntentScore(data.body, conversation.intentScore);
    await prisma.conversation.update({
      where: { id: convId },
      data: {
        lastMessageAt: new Date(),
        intentScore: newIntentScore,
        status: conversation.status === "new" ? "contacted" : conversation.status,
      },
    });

    return c.json({ data: message }, 201);
  }
);

// GET /api/conversations/:id/pending-reply?userId=... - get pending reply
conversationsRouter.get("/:id/pending-reply", async (c) => {
  const userId = c.req.query("userId") || getUserId(c);

  const conversation = await prisma.conversation.findFirst({
    where: { id: c.req.param("id"), userId },
    select: { pendingReply: true },
  });

  if (!conversation) return c.json({ error: { message: "Not found" } }, 404);

  return c.json({ data: { reply: conversation.pendingReply ?? null } });
});

// DELETE /api/conversations/:id/pending-reply - clear pending reply
conversationsRouter.delete(
  "/:id/pending-reply",
  zValidator(
    "json",
    z.object({
      userId: z.string().min(1),
    })
  ),
  async (c) => {
    const { userId } = c.req.valid("json");

    const conversation = await prisma.conversation.findFirst({
      where: { id: c.req.param("id"), userId },
    });
    if (!conversation) return c.json({ error: { message: "Not found" } }, 404);

    await prisma.conversation.update({
      where: { id: c.req.param("id") },
      data: { pendingReply: null },
    });

    return c.json({ data: { cleared: true } });
  }
);

// POST /api/conversations/:id/ai-reply - generate an AI suggested reply
conversationsRouter.post("/:id/ai-reply", async (c) => {
  const userId = getUserId(c);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return c.json({ error: { message: "OpenAI API key is not configured." } }, 500);

  const conversation = await prisma.conversation.findFirst({
    where: { id: c.req.param("id"), userId },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 20 } },
  });
  if (!conversation) return c.json({ error: { message: "Not found" } }, 404);

  const lastMessages = conversation.messages
    .map((m) => `${m.direction === "incoming" ? "Buyer" : "You"}: ${m.body}`)
    .join("\n");

  const systemPrompt = `You are a professional, friendly car sales assistant responding to a Facebook Marketplace buyer. Your main goal is to schedule a test drive or appointment.

Vehicle: ${conversation.vehicle}${conversation.vehiclePrice ? ` — Listed at ${conversation.vehiclePrice}` : ""}
Buyer name: ${conversation.buyerName}

Rules:
- Be warm and helpful, never pushy or robotic. Keep replies under 3 sentences.
- Always nudge toward scheduling: suggest a test drive, ask when they can come in, or offer a few time slots.
- If asked about price: mention the listed price and invite them to see it in person.
- If asked about availability: confirm it's available and suggest scheduling a test drive.
- If asked about financing: say you work with multiple lenders and suggest they come in to discuss.
- Never make promises about rates, discounts, or guarantees.
- If they mention a day or time, confirm it and say you'll save that slot (e.g. "I'll put you down for Saturday at 10am — see you then!").
- Do NOT include "You:" prefix in your reply — just write the reply text directly.`;

  type OpenAICompletionResponse = {
    choices: Array<{ message: { content: string } }>;
  };

  let openAIResponse: Response;
  try {
    openAIResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Conversation so far:\n${lastMessages}\n\nWrite a natural reply to the buyer's latest message.`,
          },
        ],
        max_tokens: 200,
        temperature: 0.7,
      }),
    });
  } catch (fetchError) {
    const message =
      fetchError instanceof Error ? fetchError.message : "Network error calling OpenAI";
    return c.json({ error: { message } }, 502);
  }

  if (!openAIResponse.ok) {
    const errorBody = await openAIResponse.text();
    return c.json(
      { error: { message: `OpenAI API error ${openAIResponse.status}: ${errorBody}` } },
      502
    );
  }

  const completion = (await openAIResponse.json()) as OpenAICompletionResponse;
  const reply = completion.choices[0]?.message?.content?.trim() || "";

  return c.json({ data: { reply } });
});

// POST /api/conversations/:id/schedule-appointment - create appointment from conversation and optional suggested reply
conversationsRouter.post(
  "/:id/schedule-appointment",
  zValidator(
    "json",
    z.object({
      scheduledAt: z.string().min(1),
      buyerPhone: z.string().optional(),
      notes: z.string().optional(),
      setPendingReply: z.boolean().optional().default(true),
    })
  ),
  async (c) => {
    const userId = getUserId(c);
    const convId = c.req.param("id");
    const data = c.req.valid("json");

    const conversation = await prisma.conversation.findFirst({
      where: { id: convId, userId },
    });
    if (!conversation) return c.json({ error: { message: "Not found" } }, 404);

    const scheduledAt = new Date(data.scheduledAt);
    const appt = await prisma.appointment.create({
      data: {
        userId,
        conversationId: convId,
        buyerName: conversation.buyerName,
        buyerPhone: data.buyerPhone ?? conversation.buyerPhone ?? null,
        vehicle: conversation.vehicle,
        scheduledAt,
        notes: data.notes ?? null,
        status: "scheduled",
      },
    });

    if (data.setPendingReply) {
      const formatted = scheduledAt.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
      const suggestedReply = `I've set a test drive for ${formatted}. See you then! Feel free to message if you need to reschedule.`;
      await prisma.conversation.update({
        where: { id: convId },
        data: { pendingReply: suggestedReply },
      });
    }

    return c.json({ data: { appointment: appt } }, 201);
  }
);

// Helper: compute intent score from message text
function computeIntentScore(messageText: string, currentScore: number): number {
  const text = messageText.toLowerCase();
  let delta = 0;

  if (text.includes("still available") || text.includes("is this available")) delta += 10;
  if (text.includes("test drive") || text.includes("come in") || text.includes("see it"))
    delta += 50;
  if (text.includes("financing") || text.includes("finance") || text.includes("loan"))
    delta += 40;
  if (
    text.includes("price") ||
    text.includes("negotiate") ||
    text.includes("best price") ||
    text.includes("lower")
  )
    delta += 30;
  if (text.includes("phone") || text.includes("call me") || text.includes("number")) delta += 60;
  if (text.includes("today") || text.includes("tomorrow") || text.includes("weekend")) delta += 35;
  if (text.match(/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/)) delta += 80;

  return Math.min(100, currentScore + delta);
}

export { conversationsRouter };
