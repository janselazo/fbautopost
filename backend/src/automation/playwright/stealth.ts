import type { Page } from "playwright";

/** Add random human-like delays between actions */
export function randomDelay(min = 500, max = 2000): number {
  return Math.floor(Math.random() * (max - min) + min);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Type text with human-like speed variations */
export async function humanType(page: Page, selector: string, text: string): Promise<void> {
  const el = page.locator(selector).first();
  await el.click();
  await sleep(randomDelay(200, 500));

  for (const char of text) {
    await page.keyboard.type(char, { delay: randomDelay(30, 100) });
  }
}

/** Click with a random offset within the element bounds */
export async function humanClick(page: Page, selector: string): Promise<void> {
  const el = page.locator(selector).first();
  await el.scrollIntoViewIfNeeded();
  await sleep(randomDelay(100, 400));

  const box = await el.boundingBox();
  if (box) {
    const x = box.x + box.width * (0.2 + Math.random() * 0.6);
    const y = box.y + box.height * (0.2 + Math.random() * 0.6);
    await page.mouse.click(x, y);
  } else {
    await el.click();
  }
}

/** Scroll the page randomly like a human would */
export async function humanScroll(page: Page, distance = 300): Promise<void> {
  const scrollAmount = distance + Math.floor(Math.random() * 200) - 100;
  await page.mouse.wheel(0, scrollAmount);
  await sleep(randomDelay(300, 800));
}

/** Apply anti-detection measures to a page */
export async function applyStealthToPage(page: Page): Promise<void> {
  await page.addInitScript(`
    Object.defineProperty(navigator, 'webdriver', { get: () => false });

    const origQuery = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = (parameters) => {
      if (parameters.name === 'notifications') {
        return Promise.resolve({ state: 'denied' });
      }
      return origQuery(parameters);
    };

    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });

    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
  `);
}
