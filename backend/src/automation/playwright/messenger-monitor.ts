import { type Page } from "playwright";
import { prisma } from "../../prisma";
import { getContext } from "./session-manager";
import { sleep, randomDelay, applyStealthToPage } from "./stealth";

const processedFingerprints = new Set<string>();

/**
 * Monitor Facebook Marketplace messages and capture new buyer inquiries.
 * Also sends any pending replies from the auto-reply engine.
 */
export async function monitorMessenger(userId: string): Promise<void> {
  const context = await getContext(userId);
  if (!context) return;

  let page: Page | null = null;

  try {
    page = await context.newPage();
    await applyStealthToPage(page);

    // Navigate to Marketplace messages
    await page.goto("https://www.facebook.com/marketplace/you/selling", {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await sleep(randomDelay(3000, 5000));

    // Find conversation threads
    const threadLinks = await page.locator('a[href*="/marketplace/t/"], a[href*="/messages/t/"]').all();

    for (const link of threadLinks.slice(0, 10)) {
      try {
        const href = await link.getAttribute("href");
        if (!href) continue;

        // Extract buyer name from thread
        const nameEl = link.locator("span").first();
        const buyerName = (await nameEl.textContent().catch(() => null)) || "Unknown Buyer";

        await link.click();
        await sleep(randomDelay(2000, 3000));

        // Extract messages from the conversation
        await captureMessages(page, userId, buyerName, href);

        // Send any pending replies
        await sendPendingReplies(page, userId, href);

        // Go back to thread list
        await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => {});
        await sleep(randomDelay(1000, 2000));
      } catch (e) {
        console.error("[Messenger] Error processing thread:", e);
      }
    }

    await page.close();
  } catch (e) {
    console.error("[Messenger] Monitor error:", e);
    if (page) await page.close().catch(() => {});
  }
}

async function captureMessages(
  page: Page,
  userId: string,
  buyerName: string,
  threadUrl: string
): Promise<void> {
  // Extract listing context
  const listingTitle = await page
    .locator('a[href*="/marketplace/item/"] span')
    .first()
    .textContent()
    .catch(() => null);

  const listingPrice = await page
    .locator('[aria-label*="$"]')
    .first()
    .textContent()
    .catch(() => null);

  // Find message elements
  const messageRows = await page
    .locator('[data-scope="messages_table"] [role="row"], [role="row"][aria-label]')
    .all()
    .catch(() => []);

  if (messageRows.length === 0) return;

  // Ensure conversation exists
  const existingConv = await prisma.conversation.findFirst({
    where: { userId, listingUrl: threadUrl },
  });

  let convId: string;
  if (existingConv) {
    convId = existingConv.id;
  } else {
    const conv = await prisma.conversation.create({
      data: {
        userId,
        buyerName: buyerName.slice(0, 100),
        vehicle: listingTitle || "Unknown Vehicle",
        vehiclePrice: listingPrice,
        listingUrl: threadUrl,
      },
    });
    convId = conv.id;

    // Auto-create lead
    prisma.lead
      .create({
        data: {
          userId,
          name: buyerName.slice(0, 100),
          vehicle: listingTitle || null,
          tag: "new",
          notes: `[conv:${convId}]`,
        },
      })
      .catch(() => {});
  }

  for (const row of messageRows) {
    try {
      const text = await row.locator('[dir="auto"]').first().textContent().catch(() => null);
      if (!text || text.length < 2) continue;

      // Determine direction based on position (FB right-aligns outgoing)
      const box = await row.boundingBox();
      const parentBox = await row.locator("..").boundingBox().catch(() => null);
      let direction: "incoming" | "outgoing" = "incoming";
      if (box && parentBox) {
        const centerX = box.x + box.width / 2;
        const parentCenterX = parentBox.x + parentBox.width / 2;
        direction = centerX > parentCenterX ? "outgoing" : "incoming";
      }

      const fingerprint = `${direction}:${text.slice(0, 80)}`;
      if (processedFingerprints.has(fingerprint)) continue;
      processedFingerprints.add(fingerprint);

      // Only save if not already in DB
      const existingMsg = await prisma.message.findFirst({
        where: {
          conversationId: convId,
          body: text.slice(0, 500),
          direction,
        },
      });

      if (!existingMsg) {
        await prisma.message.create({
          data: {
            conversationId: convId,
            direction,
            body: text.slice(0, 2000),
            source: "fb_marketplace",
          },
        });

        await prisma.conversation.update({
          where: { id: convId },
          data: { lastMessageAt: new Date() },
        });
      }
    } catch {
      // Skip individual message errors
    }
  }
}

async function sendPendingReplies(page: Page, userId: string, threadUrl: string): Promise<void> {
  const conv = await prisma.conversation.findFirst({
    where: { userId, listingUrl: threadUrl, pendingReply: { not: null } },
  });

  if (!conv || !conv.pendingReply) return;

  const replyText = conv.pendingReply;

  // Find message input
  const inputSelectors = [
    '[aria-label*="message" i][contenteditable="true"]',
    '[aria-label*="Message" i][contenteditable="true"]',
    '[role="textbox"][aria-label]',
    'div[contenteditable="true"]',
  ];

  let sent = false;
  for (const sel of inputSelectors) {
    const input = page.locator(sel).first();
    if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
      await input.click();
      await sleep(300);
      await input.fill(replyText);
      await sleep(500);

      // Press Enter to send
      await page.keyboard.press("Enter");
      await sleep(1000);

      // Also try clicking send button
      const sendBtn = page.locator('[aria-label*="send" i][role="button"]').first();
      if (await sendBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await sendBtn.click();
      }

      sent = true;
      break;
    }
  }

  if (sent) {
    await prisma.conversation.update({
      where: { id: conv.id },
      data: { pendingReply: null },
    });
    console.log(`[Messenger] Sent reply to ${conv.buyerName}: ${replyText.slice(0, 50)}`);
  }
}

/** Clean up old fingerprints to prevent memory leak */
export function clearFingerprints(): void {
  if (processedFingerprints.size > 10000) {
    processedFingerprints.clear();
  }
}
