import { prisma } from "../prisma";

/**
 * Finds conversations with unanswered incoming messages and generates AI replies.
 * Called by the scheduler every 30 seconds.
 */
export async function processAutoReplies(userId: string, tone: string = "friendly"): Promise<void> {
  const config = await prisma.automationConfig.findUnique({ where: { userId } });
  if (!config?.enabled || !config.replyEnabled) return;

  if (config.replyHoursOnly) {
    const hour = new Date().getHours();
    if (hour < config.postingStartHour || hour >= config.postingEndHour) return;
  }

  // Find conversations that have a recent incoming message with no pending reply and no outgoing after it
  const conversations = await prisma.conversation.findMany({
    where: {
      userId,
      pendingReply: null,
      status: { not: "closed" },
    },
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const needsReply = conversations.filter((conv) => {
    const lastMsg = conv.messages[0];
    if (!lastMsg) return false;
    if (lastMsg.direction !== "incoming") return false;
    // Only auto-reply to messages received in the last 10 minutes
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    return new Date(lastMsg.createdAt).getTime() > tenMinutesAgo;
  });

  if (needsReply.length === 0) return;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log("[AutoReply] OPENAI_API_KEY not configured, skipping");
    return;
  }

  for (const conv of needsReply) {
    try {
      const messages = await prisma.message.findMany({
        where: { conversationId: conv.id },
        orderBy: { createdAt: "asc" },
        take: 20,
      });

      const history = messages
        .map((m) => `${m.direction === "incoming" ? "Buyer" : "You"}: ${m.body}`)
        .join("\n");

      const toneInstruction = {
        friendly: "Be warm, approachable, and conversational.",
        professional: "Be polished and business-like but not cold.",
        casual: "Be relaxed and use a casual conversational tone.",
      }[tone] || "Be warm and helpful.";

      const systemPrompt = `You are an AI car sales assistant auto-replying on Facebook Marketplace. Your #1 goal: schedule a test drive or appointment.

Vehicle: ${conv.vehicle}${conv.vehiclePrice ? ` — $${conv.vehiclePrice}` : ""}
Buyer: ${conv.buyerName}

Rules:
- ${toneInstruction}
- Keep replies under 3 sentences.
- Always nudge toward scheduling a visit or test drive.
- If asked about price: mention listed price, invite them in.
- If asked about availability: confirm it's available, suggest a test drive.
- If they mention a time/day: confirm and say you'll save the slot.
- Never promise discounts, rates, or guarantees.
- Do NOT include "You:" prefix.`;

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
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
              content: `Conversation:\n${history}\n\nWrite a reply to the buyer's latest message.`,
            },
          ],
          max_tokens: 200,
          temperature: 0.7,
        }),
      });

      if (!res.ok) {
        console.error(`[AutoReply] OpenAI error ${res.status} for conv ${conv.id}`);
        continue;
      }

      const data = (await res.json()) as { choices: { message: { content: string } }[] };
      const reply = data.choices[0]?.message?.content?.trim();
      if (!reply) continue;

      // Store the reply as pendingReply — Playwright messenger or extension will send it
      await prisma.conversation.update({
        where: { id: conv.id },
        data: { pendingReply: reply },
      });

      // Also store as outgoing message with source "ai_auto"
      await prisma.message.create({
        data: {
          conversationId: conv.id,
          direction: "outgoing",
          body: reply,
          source: "ai_auto",
        },
      });

      console.log(`[AutoReply] Generated reply for ${conv.buyerName} (conv: ${conv.id})`);
    } catch (e) {
      console.error(`[AutoReply] Error processing conv ${conv.id}:`, e);
    }
  }
}
