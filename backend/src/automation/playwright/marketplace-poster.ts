import { type Page } from "playwright";
import { writeFile, unlink, mkdtemp } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { prisma } from "../../prisma";
import { getContext } from "./session-manager";
import { sleep, randomDelay, applyStealthToPage } from "./stealth";

interface VehicleData {
  year: number;
  make: string;
  model: string;
  trim: string;
  price: number;
  mileage: number;
  color: string;
  vin: string;
  bodyType?: string;
  fuelType?: string;
  transmission?: string;
  condition?: string;
  city?: string;
  state?: string;
}

/**
 * Post a single vehicle listing to Facebook Marketplace via Playwright.
 * Downloads photos, fills the form, uploads photos, and clicks Publish.
 */
export async function postToMarketplace(
  userId: string,
  taskId: string,
  vehicle: VehicleData,
  listingText: string,
  photoUrls: string[]
): Promise<{ success: boolean; fbUrl?: string; error?: string }> {
  const context = await getContext(userId);
  if (!context) return { success: false, error: "No valid Facebook session" };

  await prisma.postingTask.update({ where: { id: taskId }, data: { status: "posting", attempts: { increment: 1 } } });

  let page: Page | null = null;
  const tempPhotos: string[] = [];

  try {
    page = await context.newPage();
    await applyStealthToPage(page);

    // Download photos to temp files
    if (photoUrls.length > 0) {
      const tempDir = await mkdtemp(join(tmpdir(), "fb-photos-"));
      const maxPhotos = Math.min(photoUrls.length, 10);
      for (let i = 0; i < maxPhotos; i++) {
        try {
          const photoUrl = photoUrls[i]!;
          const res = await fetch(photoUrl);
          if (!res.ok) continue;
          const buffer = Buffer.from(await res.arrayBuffer());
          const ext = photoUrl.match(/\.(jpe?g|png|webp)/i)?.[1] || "jpg";
          const path = join(tempDir, `photo_${i}.${ext}`);
          await writeFile(path, buffer);
          tempPhotos.push(path);
        } catch {
          console.log(`[Poster] Failed to download photo ${i}`);
        }
      }
    }

    // Navigate to marketplace create page
    await page.goto("https://www.facebook.com/marketplace/create/vehicle", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await sleep(randomDelay(2000, 4000));

    // Select "Cars & trucks" vehicle type
    const carsOption = page.locator('text="Cars & trucks"').first();
    if (await carsOption.isVisible({ timeout: 5000 }).catch(() => false)) {
      await carsOption.click();
      await sleep(randomDelay(1000, 2000));
    }

    // Wait for form fields
    await page.waitForSelector('[aria-label*="Year" i], [aria-label*="Make" i]', { timeout: 10000 }).catch(() => {});
    await sleep(1000);

    // Upload photos first (FB has a file input)
    if (tempPhotos.length > 0) {
      const fileInput = page.locator('input[type="file"][accept*="image"]').first();
      if (await fileInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await fileInput.setInputFiles(tempPhotos);
        await sleep(randomDelay(2000, 4000));
        console.log(`[Poster] Uploaded ${tempPhotos.length} photos`);
      } else {
        // Try clicking "Add photos" button to reveal input
        const addPhotosBtn = page.locator('text="Add photos"').first();
        if (await addPhotosBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await addPhotosBtn.click();
          await sleep(1000);
          const input = page.locator('input[type="file"]').first();
          await input.setInputFiles(tempPhotos);
          await sleep(randomDelay(2000, 4000));
        }
      }
    }

    // Fill form fields
    await fillDropdown(page, "Year", String(vehicle.year));
    await fillDropdown(page, "Make", vehicle.make);
    await sleep(randomDelay(500, 1000));
    await fillDropdown(page, "Model", vehicle.model);
    if (vehicle.trim) await fillDropdown(page, "Trim", vehicle.trim);

    await fillInput(page, "Mileage", String(vehicle.mileage));
    await fillInput(page, "Price", String(vehicle.price));

    await fillDropdown(page, "Body style", normalizeBodyType(vehicle.bodyType));
    await fillDropdown(page, "Exterior color", normalizeColor(vehicle.color));
    await fillDropdown(page, "Condition", vehicle.condition || "Good");
    await fillDropdown(page, "Fuel type", normalizeFuel(vehicle.fuelType));
    await fillDropdown(page, "Transmission", normalizeTrans(vehicle.transmission));

    // Fill description
    const descEl = page.locator(
      'textarea[aria-label*="escription" i], div[contenteditable="true"][role="textbox"]'
    ).first();
    if (await descEl.isVisible({ timeout: 3000 }).catch(() => false)) {
      await descEl.click();
      await sleep(300);
      await descEl.fill(listingText);
      await sleep(500);
    }

    // Fill VIN
    if (vehicle.vin) {
      await fillInput(page, "VIN", vehicle.vin);
    }

    // Fill location
    const locationCity = vehicle.city || "Doral";
    const locationInput = page.locator(
      'input[aria-label*="ocation" i], input[aria-label*="eighborhood" i], input[aria-label*="ity" i]'
    ).first();
    if (await locationInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      const currentVal = await locationInput.inputValue().catch(() => "");
      if (!currentVal) {
        await locationInput.click();
        await sleep(300);
        await locationInput.fill(locationCity);
        await sleep(1500);
        // Click first suggestion
        const suggestion = page.locator('[role="option"], [role="listbox"] [role="option"]').first();
        if (await suggestion.isVisible({ timeout: 3000 }).catch(() => false)) {
          await suggestion.click();
          await sleep(500);
        }
      }
    }

    await sleep(randomDelay(1000, 2000));

    // Click Next/Publish
    const nextBtn = page.locator(
      'div[aria-label="Next"], div[aria-label="Publish"], [aria-label="Next"], [aria-label="Publish"]'
    ).first();
    if (await nextBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nextBtn.click();
      await sleep(randomDelay(2000, 4000));

      // If there's a second "Publish" step
      const publishBtn = page.locator('[aria-label="Publish"]').first();
      if (await publishBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await publishBtn.click();
        await sleep(randomDelay(3000, 5000));
      }
    }

    // Check for success
    const currentUrl = page.url();
    const success = !currentUrl.includes("/create/");

    await prisma.postingTask.update({
      where: { id: taskId },
      data: {
        status: success ? "posted" : "failed",
        fbListingUrl: success ? currentUrl : null,
        completedAt: success ? new Date() : null,
        error: success ? null : "Could not confirm publish",
      },
    });

    console.log(`[Poster] ${success ? "Posted" : "Failed"}: ${vehicle.year} ${vehicle.make} ${vehicle.model}`);

    await page.close();
    return { success, fbUrl: success ? currentUrl : undefined };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Unknown error";
    console.error(`[Poster] Error posting ${vehicle.make} ${vehicle.model}:`, error);

    await prisma.postingTask.update({
      where: { id: taskId },
      data: { status: "failed", error: error.slice(0, 500) },
    });

    if (page) await page.close().catch(() => {});
    return { success: false, error };
  } finally {
    // Cleanup temp photos
    for (const p of tempPhotos) {
      await unlink(p).catch(() => {});
    }
  }
}

/**
 * Delete a listing from Facebook Marketplace by navigating to the user's active listings
 * and finding/deleting the one matching the given FB listing URL.
 */
export async function deleteListingFromFacebook(
  userId: string,
  fbListingUrl: string,
  taskId: string
): Promise<boolean> {
  const context = await getContext(userId);
  if (!context) return false;

  let page: Page | null = null;
  try {
    page = await context.newPage();
    await applyStealthToPage(page);

    // Navigate directly to the listing
    await page.goto(fbListingUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    await sleep(randomDelay(2000, 3000));

    // Look for the "..." or "More" menu button on the listing
    const moreBtn = page.locator(
      '[aria-label="More"], [aria-label*="options" i], [aria-label*="Actions" i]'
    ).first();

    if (await moreBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await moreBtn.click();
      await sleep(randomDelay(500, 1000));

      // Click "Delete listing" or "Mark as sold" option
      const deleteOption = page.locator(
        'text="Delete listing", text="Delete Listing", [role="menuitem"]:has-text("Delete")'
      ).first();

      if (await deleteOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await deleteOption.click();
        await sleep(randomDelay(1000, 2000));

        // Confirm deletion dialog
        const confirmBtn = page.locator(
          '[aria-label="Delete"], [aria-label="Confirm"], text="Delete"'
        ).last();
        if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await confirmBtn.click();
          await sleep(randomDelay(2000, 3000));
        }

        await prisma.postingTask.update({
          where: { id: taskId },
          data: { status: "deleted", deletedAt: new Date() },
        });

        console.log(`[Poster] Deleted listing: ${fbListingUrl}`);
        await page.close();
        return true;
      }
    }

    // Fallback: try "Mark as sold" approach
    const markSoldBtn = page.locator(
      'text="Mark as Sold", text="Mark as sold", [role="menuitem"]:has-text("sold")'
    ).first();
    if (await markSoldBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await markSoldBtn.click();
      await sleep(randomDelay(1000, 2000));

      const confirmBtn = page.locator('[aria-label="Confirm"], text="Confirm", text="Done"').first();
      if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmBtn.click();
        await sleep(1000);
      }

      await prisma.postingTask.update({
        where: { id: taskId },
        data: { status: "deleted", deletedAt: new Date() },
      });

      console.log(`[Poster] Marked as sold: ${fbListingUrl}`);
      await page.close();
      return true;
    }

    console.log(`[Poster] Could not find delete/sold option for: ${fbListingUrl}`);
    await page.close();
    return false;
  } catch (e) {
    console.error(`[Poster] Error deleting listing:`, e);
    if (page) await page.close().catch(() => {});
    return false;
  }
}

/**
 * Refresh a listing: delete old one, then repost as new.
 * This puts the vehicle back at the top of Marketplace search.
 */
export async function refreshListing(
  userId: string,
  vehicleId: number
): Promise<{ success: boolean; newTaskId?: string }> {
  // Find the most recent posted task for this vehicle
  const existingTask = await prisma.postingTask.findFirst({
    where: { userId, vehicleId, status: "posted", fbListingUrl: { not: null } },
    orderBy: { completedAt: "desc" },
  });

  // Delete old listing if it exists
  if (existingTask?.fbListingUrl) {
    await deleteListingFromFacebook(userId, existingTask.fbListingUrl, existingTask.id);
    await sleep(randomDelay(5000, 10000));
  }

  // Create a new posting task for this vehicle (refresh type)
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle || vehicle.status !== "Available") {
    return { success: false };
  }

  const photoUrls = parsePhotoUrls(vehicle.description);
  const listingText = generateListingText(vehicle);

  const newTask = await prisma.postingTask.create({
    data: {
      userId,
      vehicleId,
      status: "queued",
      taskType: "refresh",
      listingText,
      photoUrls: JSON.stringify(photoUrls),
      scheduledFor: new Date(Date.now() + randomDelay(60_000, 300_000)),
    },
  });

  console.log(`[Poster] Refresh queued for ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
  return { success: true, newTaskId: newTask.id };
}

function parsePhotoUrls(description: string | null): string[] {
  if (!description) return [];
  try {
    const parsed = JSON.parse(description);
    if (Array.isArray(parsed)) return parsed.filter((u: unknown) => typeof u === "string");
  } catch {
    // not JSON
  }
  return [];
}

function generateListingText(vehicle: {
  year: number;
  make: string;
  model: string;
  trim: string;
  price: number;
  mileage: number;
  color: string;
  vin: string;
}): string {
  const lines = [
    `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}`,
    "",
  ];
  if (vehicle.mileage > 0) lines.push(`Mileage: ${vehicle.mileage.toLocaleString()} miles`);
  if (vehicle.color) lines.push(`Exterior: ${vehicle.color}`);
  if (vehicle.price > 0) lines.push(`Price: $${vehicle.price.toLocaleString()}`);
  if (vehicle.vin) lines.push(`VIN: ${vehicle.vin}`);
  lines.push("", "Message us to schedule a test drive!");
  return lines.join("\n");
}

/**
 * Delete all active FB listings for sold vehicles.
 * Called by inventory sync when vehicles are marked as Sold.
 */
export async function deactivateSoldListings(userId: string, soldVehicleIds: number[]): Promise<number> {
  if (soldVehicleIds.length === 0) return 0;

  const activeTasks = await prisma.postingTask.findMany({
    where: {
      userId,
      vehicleId: { in: soldVehicleIds },
      status: "posted",
      fbListingUrl: { not: null },
    },
  });

  let deleted = 0;
  for (const task of activeTasks) {
    if (task.fbListingUrl) {
      const success = await deleteListingFromFacebook(userId, task.fbListingUrl, task.id);
      if (success) deleted++;
      await sleep(randomDelay(5000, 15000));
    }
  }

  console.log(`[Poster] Deactivated ${deleted}/${activeTasks.length} listings for sold vehicles`);
  return deleted;
}

// Runs the posting queue — called by scheduler
export async function runPostingTasks(userId: string): Promise<void> {
  const tasks = await prisma.postingTask.findMany({
    where: {
      userId,
      status: "queued",
      scheduledFor: { lte: new Date() },
    },
    orderBy: { scheduledFor: "asc" },
    take: 1,
  });

  for (const task of tasks) {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: task.vehicleId } });
    if (!vehicle || vehicle.status !== "Available") {
      await prisma.postingTask.update({ where: { id: task.id }, data: { status: "skipped" } });
      continue;
    }

    const photoUrls: string[] = task.photoUrls ? JSON.parse(task.photoUrls) : [];

    await postToMarketplace(
      userId,
      task.id,
      {
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        trim: vehicle.trim,
        price: vehicle.price,
        mileage: vehicle.mileage,
        color: vehicle.color,
        vin: vehicle.vin,
        bodyType: vehicle.bodyType,
        condition: vehicle.condition,
      },
      task.listingText || `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      photoUrls
    );

    // Wait between posts to appear human
    await sleep(randomDelay(30000, 60000));
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

async function fillDropdown(page: Page, label: string, value: string | undefined): Promise<void> {
  if (!value) return;

  const trigger = page.locator(`[aria-label*="${label}" i]`).first();
  if (!(await trigger.isVisible({ timeout: 2000 }).catch(() => false))) return;

  await trigger.click();
  await sleep(randomDelay(300, 600));

  // Type to filter
  const input = trigger.locator("input").first();
  if (await input.isVisible({ timeout: 500 }).catch(() => false)) {
    await input.fill(value);
    await sleep(randomDelay(500, 800));
  }

  // Click matching option
  const option = page.locator(`[role="option"]:has-text("${value}")`).first();
  if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
    await option.click();
    await sleep(randomDelay(300, 500));
  } else {
    // Press Escape to close dropdown
    await page.keyboard.press("Escape");
    await sleep(200);
  }
}

async function fillInput(page: Page, label: string, value: string): Promise<void> {
  if (!value) return;

  const input = page.locator(
    `input[aria-label*="${label}" i], input[placeholder*="${label}" i]`
  ).first();
  if (!(await input.isVisible({ timeout: 2000 }).catch(() => false))) return;

  await input.click();
  await sleep(200);
  await input.fill(value);
  await sleep(randomDelay(200, 400));
}

function normalizeBodyType(raw?: string): string {
  if (!raw) return "SUV";
  const l = raw.toLowerCase();
  if (l.includes("sedan")) return "Sedan";
  if (l.includes("suv") || l.includes("crossover")) return "SUV";
  if (l.includes("truck") || l.includes("pickup")) return "Truck";
  if (l.includes("coupe")) return "Coupe";
  if (l.includes("hatch")) return "Hatchback";
  if (l.includes("convert")) return "Convertible";
  if (l.includes("van")) return "Minivan";
  if (l.includes("wagon")) return "Wagon";
  return "SUV";
}

function normalizeColor(raw?: string): string {
  if (!raw) return "";
  const l = raw.toLowerCase();
  const map: Record<string, string> = {
    black: "Black", white: "White", silver: "Silver", gray: "Gray", grey: "Gray",
    blue: "Blue", red: "Red", green: "Green", brown: "Brown", gold: "Gold",
    orange: "Orange", yellow: "Yellow", purple: "Purple", beige: "Beige", tan: "Tan",
  };
  for (const [k, v] of Object.entries(map)) {
    if (l.includes(k)) return v;
  }
  return raw;
}

function normalizeFuel(raw?: string): string {
  if (!raw) return "Gasoline";
  const l = raw.toLowerCase();
  if (l.includes("electric") && !l.includes("hybrid")) return "Electric";
  if (l.includes("hybrid")) return "Hybrid";
  if (l.includes("diesel")) return "Diesel";
  return "Gasoline";
}

function normalizeTrans(raw?: string): string {
  if (!raw) return "Automatic";
  return raw.toLowerCase().includes("manual") ? "Manual" : "Automatic";
}
