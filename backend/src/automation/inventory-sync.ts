import { prisma } from "../prisma";

const MC_BASE = "https://api.marketcheck.com/v2";

async function mcFetch(apiKey: string, path: string, params: Record<string, string | number>) {
  const url = new URL(`${MC_BASE}${path}`);
  url.searchParams.set("api_key", apiKey);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (res.status === 429) throw new Error("MARKETCHECK_QUOTA_EXHAUSTED");
  if (!res.ok) throw new Error(`MarketCheck ${res.status}`);
  return res.json();
}

type MCListing = Record<string, unknown>;
type MCBuild = Record<string, unknown>;
type MCDealer = Record<string, unknown>;
type MCMedia = { photo_links?: string[] };

function normalizePrice(l: MCListing): number {
  const fields = [l.dealer_price, l.sale_price, l.internet_price, l.list_price, l.price, l.msrp];
  return Number(fields.find((p) => p !== undefined && p !== null && Number(p) > 0) ?? 0);
}

export async function syncInventoryForUser(userId: string): Promise<{ added: number; removed: number; total: number }> {
  const config = await prisma.automationConfig.findUnique({ where: { userId } });
  if (!config?.dealerWebsite) {
    console.log(`[InventorySync] No dealer website configured for user ${userId}`);
    return { added: 0, removed: 0, total: 0 };
  }

  const apiKey = process.env.MARKETCHECK_API_KEY;
  if (!apiKey || apiKey === "your_marketcheck_api_key_here") {
    console.log("[InventorySync] MARKETCHECK_API_KEY not configured");
    return { added: 0, removed: 0, total: 0 };
  }

  const source = config.dealerWebsite
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();

  console.log(`[InventorySync] Syncing inventory for ${source} (user: ${userId})`);

  const pageSize = 50;
  const maxTotal = 200;
  let allListings: MCListing[] = [];

  const page1 = (await mcFetch(apiKey, "/dealerships/inventory", {
    source,
    rows: pageSize,
    start: 0,
  })) as { num_found?: number; listings?: MCListing[] };

  const numFound = page1?.num_found ?? 0;
  allListings = Array.isArray(page1?.listings) ? page1.listings : [];

  const actualTotal = Math.min(maxTotal, numFound);
  for (let start = pageSize; start < actualTotal; start += pageSize) {
    const page = (await mcFetch(apiKey, "/dealerships/inventory", {
      source,
      rows: Math.min(pageSize, actualTotal - start),
      start,
    })) as { listings?: MCListing[] };
    if (Array.isArray(page?.listings)) allListings.push(...page.listings);
  }

  const mcVins = new Set<string>();
  let added = 0;

  for (const l of allListings) {
    const build = (l.build ?? {}) as MCBuild;
    const dealer = (l.dealer ?? l.mc_dealership ?? {}) as MCDealer;
    const media = (l.media ?? {}) as MCMedia;

    const vin = String(l.vin ?? "").trim();
    if (!vin) continue;
    mcVins.add(vin);

    const year = Number(build.year ?? l.year ?? 0);
    const make = String(build.make ?? l.make ?? "").trim();
    const model = String(build.model ?? l.model ?? "").trim();
    const trim = String(build.trim ?? l.trim ?? "").trim() || "Base";
    const price = normalizePrice(l);
    const mileage = Number(l.miles ?? 0);
    const color = String(l.exterior_color ?? "").trim();
    const bodyType = String(build.body_type ?? l.body_type ?? "").trim();
    const condition = String(l.inventory_type ?? "used");
    const photoUrls = Array.isArray(media.photo_links) ? media.photo_links : [];

    if (!year || !make || !model) continue;

    const existing = await prisma.vehicle.findFirst({ where: { userId, vin } });
    if (existing) {
      await prisma.vehicle.update({
        where: { id: existing.id },
        data: {
          price: price || existing.price,
          mileage: mileage || existing.mileage,
          status: "Available",
          photoUrl: photoUrls[0] || existing.photoUrl,
          description: JSON.stringify(photoUrls),
        },
      });
    } else {
      await prisma.vehicle.create({
        data: {
          userId,
          year,
          make,
          model,
          trim,
          price,
          mileage,
          color,
          vin,
          condition,
          bodyType,
          status: "Available",
          photoUrl: photoUrls[0] || null,
          description: JSON.stringify(photoUrls),
        },
      });
      added++;
    }
  }

  // Mark vehicles not in latest inventory as Sold and deactivate their FB listings
  const currentVehicles = await prisma.vehicle.findMany({
    where: { userId, status: "Available" },
    select: { id: true, vin: true },
  });

  let removed = 0;
  const soldVehicleIds: number[] = [];
  for (const v of currentVehicles) {
    if (v.vin && !mcVins.has(v.vin)) {
      await prisma.vehicle.update({
        where: { id: v.id },
        data: { status: "Sold" },
      });
      soldVehicleIds.push(v.id);
      removed++;
    }
  }

  // Deactivate FB listings for sold vehicles (async, non-blocking)
  if (soldVehicleIds.length > 0) {
    import("./playwright/marketplace-poster").then(({ deactivateSoldListings }) => {
      deactivateSoldListings(userId, soldVehicleIds).catch((e) =>
        console.error(`[InventorySync] Failed to deactivate sold listings:`, e)
      );
    }).catch(() => {});
  }

  console.log(
    `[InventorySync] Done: ${added} added, ${removed} marked sold (${soldVehicleIds.length} to deactivate on FB), ${mcVins.size} total from MarketCheck`
  );
  return { added, removed, total: mcVins.size };
}
