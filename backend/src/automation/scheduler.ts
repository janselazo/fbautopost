import { prisma } from "../prisma";
import { syncInventoryForUser } from "./inventory-sync";
import { processPostingQueue } from "./posting-queue";
import { processAutoReplies } from "./auto-reply";
import { runPostingTasks } from "./playwright/marketplace-poster";
import { monitorMessenger, clearFingerprints } from "./playwright/messenger-monitor";

let intervalIds: ReturnType<typeof setInterval>[] = [];

export function startScheduler() {
  console.log("[Scheduler] Starting automation scheduler");

  // Inventory sync — every 60 minutes, checks each user's config for custom interval
  const inventoryInterval = setInterval(async () => {
    try {
      const configs = await prisma.automationConfig.findMany({
        where: { enabled: true, dealerWebsite: { not: null } },
      });
      for (const config of configs) {
        const intervalMs = (config.inventorySyncMins ?? 240) * 60 * 1000;
        const lastSync = config.updatedAt.getTime();
        if (Date.now() - lastSync >= intervalMs) {
          await syncInventoryForUser(config.userId).catch((e) =>
            console.error(`[Scheduler] Inventory sync failed for ${config.userId}:`, e)
          );
        }
      }
    } catch (e) {
      console.error("[Scheduler] Inventory sync tick error:", e);
    }
  }, 60_000);

  // Posting queue — every 5 minutes
  const postingInterval = setInterval(async () => {
    try {
      const configs = await prisma.automationConfig.findMany({
        where: { enabled: true, postingEnabled: true },
      });
      for (const config of configs) {
        await processPostingQueue(config.userId).catch((e) =>
          console.error(`[Scheduler] Posting queue failed for ${config.userId}:`, e)
        );
      }
    } catch (e) {
      console.error("[Scheduler] Posting tick error:", e);
    }
  }, 5 * 60_000);

  // Auto-reply check — every 30 seconds
  const replyInterval = setInterval(async () => {
    try {
      const configs = await prisma.automationConfig.findMany({
        where: { enabled: true, replyEnabled: true },
      });
      for (const config of configs) {
        await processAutoReplies(config.userId, config.replyTone).catch((e) =>
          console.error(`[Scheduler] Auto-reply failed for ${config.userId}:`, e)
        );
      }
    } catch (e) {
      console.error("[Scheduler] Reply tick error:", e);
    }
  }, 30_000);

  // Playwright poster — every 2 minutes, runs queued posting tasks
  const playwrightPostInterval = setInterval(async () => {
    try {
      const configs = await prisma.automationConfig.findMany({
        where: { enabled: true, postingEnabled: true },
      });
      for (const config of configs) {
        const session = await prisma.browserSession.findUnique({ where: { userId: config.userId } });
        if (!session?.valid) continue;
        await runPostingTasks(config.userId).catch((e) =>
          console.error(`[Scheduler] Playwright poster failed for ${config.userId}:`, e)
        );
      }
    } catch (e) {
      console.error("[Scheduler] Playwright poster tick error:", e);
    }
  }, 2 * 60_000);

  // Playwright messenger — every 3 minutes, captures messages and sends replies
  const messengerInterval = setInterval(async () => {
    try {
      const configs = await prisma.automationConfig.findMany({
        where: { enabled: true, replyEnabled: true },
      });
      for (const config of configs) {
        const session = await prisma.browserSession.findUnique({ where: { userId: config.userId } });
        if (!session?.valid) continue;
        await monitorMessenger(config.userId).catch((e) =>
          console.error(`[Scheduler] Messenger monitor failed for ${config.userId}:`, e)
        );
      }
      clearFingerprints();
    } catch (e) {
      console.error("[Scheduler] Messenger tick error:", e);
    }
  }, 3 * 60_000);

  intervalIds = [inventoryInterval, postingInterval, replyInterval, playwrightPostInterval, messengerInterval];
  console.log("[Scheduler] All jobs registered (including Playwright automation)");
}

export function stopScheduler() {
  for (const id of intervalIds) clearInterval(id);
  intervalIds = [];
  console.log("[Scheduler] Stopped");
}
