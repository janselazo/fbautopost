import { chromium, type Browser, type BrowserContext } from "playwright";
import { prisma } from "../../prisma";

let browser: Browser | null = null;
const contexts = new Map<string, BrowserContext>();

async function ensureBrowser(): Promise<Browser> {
  if (browser && browser.isConnected()) return browser;

  browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
    ],
  });

  console.log("[SessionManager] Browser launched");
  return browser;
}

export async function getContext(userId: string): Promise<BrowserContext | null> {
  const existing = contexts.get(userId);
  if (existing) {
    try {
      await existing.pages();
      return existing;
    } catch {
      contexts.delete(userId);
    }
  }

  const session = await prisma.browserSession.findUnique({ where: { userId } });
  if (!session || !session.valid) return null;

  let cookies: Parameters<BrowserContext["addCookies"]>[0];
  try {
    cookies = JSON.parse(session.cookies);
  } catch {
    console.error("[SessionManager] Invalid cookie data for user", userId);
    return null;
  }

  const b = await ensureBrowser();
  const context = await b.newContext({
    userAgent:
      session.userAgent ||
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    viewport: { width: 1366, height: 768 },
    locale: "en-US",
    timezoneId: "America/New_York",
  });

  await context.addCookies(cookies);

  // Anti-detection: override webdriver flag
  await context.addInitScript(`
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    delete window.__playwright;
  `);

  contexts.set(userId, context);

  await prisma.browserSession.update({
    where: { userId },
    data: { lastUsedAt: new Date() },
  });

  console.log("[SessionManager] Context created for user", userId);
  return context;
}

export async function validateSession(userId: string): Promise<boolean> {
  const context = await getContext(userId);
  if (!context) return false;

  try {
    const page = await context.newPage();
    await page.goto("https://www.facebook.com/", { waitUntil: "domcontentloaded", timeout: 15000 });

    // Check if we're logged in by looking for the navigation or profile elements
    const loggedIn = await page
      .locator('[aria-label="Your profile"], [aria-label="Account"], [data-pagelet="ProfileTail"]')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    await page.close();

    if (!loggedIn) {
      await prisma.browserSession.update({
        where: { userId },
        data: { valid: false },
      });
      console.log("[SessionManager] Session invalid for user", userId);
    }

    return loggedIn;
  } catch (e) {
    console.error("[SessionManager] Validation error:", e);
    return false;
  }
}

export async function saveCookies(userId: string, cookies: unknown[], userAgent?: string): Promise<void> {
  const cookieJson = JSON.stringify(cookies);

  await prisma.browserSession.upsert({
    where: { userId },
    create: {
      userId,
      cookies: cookieJson,
      userAgent: userAgent || null,
      valid: true,
      lastUsedAt: new Date(),
    },
    update: {
      cookies: cookieJson,
      userAgent: userAgent || undefined,
      valid: true,
      lastUsedAt: new Date(),
    },
  });

  // Invalidate cached context so next getContext loads fresh cookies
  const existing = contexts.get(userId);
  if (existing) {
    await existing.close().catch(() => {});
    contexts.delete(userId);
  }

  console.log("[SessionManager] Cookies saved for user", userId);
}

export async function refreshCookies(userId: string): Promise<boolean> {
  const context = await getContext(userId);
  if (!context) return false;

  try {
    const cookies = await context.cookies("https://www.facebook.com");
    if (cookies.length > 0) {
      await prisma.browserSession.update({
        where: { userId },
        data: {
          cookies: JSON.stringify(cookies),
          lastUsedAt: new Date(),
        },
      });
      return true;
    }
  } catch (e) {
    console.error("[SessionManager] Cookie refresh error:", e);
  }
  return false;
}

export async function destroyContext(userId: string): Promise<void> {
  const ctx = contexts.get(userId);
  if (ctx) {
    await ctx.close().catch(() => {});
    contexts.delete(userId);
  }
}

export async function shutdownBrowser(): Promise<void> {
  for (const [id, ctx] of contexts) {
    await ctx.close().catch(() => {});
    contexts.delete(id);
  }
  if (browser) {
    await browser.close().catch(() => {});
    browser = null;
  }
  console.log("[SessionManager] Browser shut down");
}
