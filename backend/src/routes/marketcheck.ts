import { Hono } from "hono";
import { env } from "../env";

const MC_BASE = "https://api.marketcheck.com/v2";

// ── Helper: check API key configured ────────────────────────────────────────
function getApiKey(): string {
  const key = env.MARKETCHECK_API_KEY;
  if (!key || key === "your_marketcheck_api_key_here") {
    throw new Error("MARKETCHECK_NOT_CONFIGURED");
  }
  return key;
}

// ── Helper: fetch from MarketCheck ──────────────────────────────────────────
async function mcFetch(path: string, params: Record<string, string | number | undefined>): Promise<unknown> {
  const apiKey = getApiKey();
  const url = new URL(`${MC_BASE}${path}`);
  url.searchParams.set("api_key", apiKey);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  console.log(`[MarketCheck] GET ${path}?${url.searchParams.toString().replace(apiKey, "***")}`);
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (res.status === 429) {
    throw new Error("MARKETCHECK_QUOTA_EXHAUSTED");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`MarketCheck API error ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

// ── Normalize listing from MC response ──────────────────────────────────────
// MC nests vehicle specs inside "build" and dealer info inside "dealer"/"mc_dealership"
function normalizeListing(l: Record<string, unknown>) {
  const build = (l.build ?? {}) as Record<string, unknown>;
  const dealer = (l.dealer ?? l.mc_dealership ?? {}) as Record<string, unknown>;
  const media = (l.media ?? {}) as Record<string, unknown>;

  // Log all price-related fields to identify the correct selling price field
  const priceFieldsDebug = [l.dealer_price, l.sale_price, l.internet_price, l.list_price, l.price, l.msrp];
  const hasAnyPrice = priceFieldsDebug.some(p => p !== undefined && p !== null && Number(p) > 0);
  if (!hasAnyPrice) {
    // Log full raw listing keys so we can find where the price actually lives
    console.log(`[MC price MISSING] id=${l.id} vin=${l.vin} ALL KEYS: ${JSON.stringify(Object.keys(l))} | build keys: ${JSON.stringify(Object.keys((l.build ?? {}) as object))}`);
    console.log(`[MC price MISSING values] ${JSON.stringify(Object.fromEntries(Object.entries(l).filter(([k]) => k.toLowerCase().includes('price') || k.toLowerCase().includes('msrp') || k.toLowerCase().includes('cost') || k.toLowerCase().includes('amount'))))}`);
    console.log(`[MC price MISSING full] ${JSON.stringify(l).slice(0, 1000)}`);
  } else {
    console.log(`[MC price debug] id=${l.id} price=${l.price} dealer_price=${l.dealer_price} sale_price=${l.sale_price} msrp=${l.msrp} list_price=${l.list_price} asking_price=${l.asking_price} internet_price=${l.internet_price}`);
  }

  // Use the first non-zero price found across all price fields (msrp as last resort)
  const priceFields = [l.dealer_price, l.sale_price, l.internet_price, l.list_price, l.price, l.msrp];
  const sellingPrice = Number(priceFields.find(p => p !== undefined && p !== null && Number(p) > 0) ?? 0);

  return {
    id: String(l.id ?? l.vin ?? Math.random()),
    vin: String(l.vin ?? ""),
    year: Number(build.year ?? l.year ?? 0),
    make: String(build.make ?? l.make ?? ""),
    model: String(build.model ?? l.model ?? ""),
    trim: String(build.trim ?? l.trim ?? ""),
    price: sellingPrice,
    msrp: Number(l.msrp ?? 0),
    miles: Number(l.miles ?? 0),
    exterior_color: String(l.exterior_color ?? ""),
    interior_color: String(l.interior_color ?? ""),
    body_type: String(build.body_type ?? l.body_type ?? ""),
    fuel_type: String(build.fuel_type ?? l.fuel_type ?? ""),
    transmission: String(build.transmission ?? l.transmission ?? ""),
    drivetrain: String(build.drivetrain ?? l.drivetrain ?? ""),
    engine: String(build.engine ?? l.engine ?? ""),
    inventory_type: String(l.inventory_type ?? "used"),
    dom_active: Number(l.dom_active ?? l.dom ?? 0),
    media: {
      photo_links: Array.isArray(media.photo_links) ? (media.photo_links as string[]) : [],
    },
    dealer: {
      id: String(dealer.id ?? dealer.mc_dealer_id ?? ""),
      name: String(dealer.name ?? ""),
      city: String(dealer.city ?? ""),
      state: String(dealer.state ?? ""),
    },
    heading: String(l.heading ?? `${build.year} ${build.make} ${build.model}`),
    seller_type: String(l.seller_type ?? "dealer"),
    is_certified: Boolean(l.is_certified),
    _dealer_full: {
      website: String(dealer.website ?? l.source ?? ""),
      phone: String(dealer.phone ?? ""),
      street: String(dealer.street ?? ""),
      zip: String(dealer.zip ?? ""),
      latitude: Number(dealer.latitude ?? 0),
      longitude: Number(dealer.longitude ?? 0),
      dealer_type: String(dealer.dealer_type ?? ""),
      franchise_dealer: dealer.dealer_type === "franchise",
    },
  };
}

export const marketcheckRouter = new Hono();

/**
 * GET /api/marketcheck/lookup
 * Look up a dealership by website domain (source).
 * Returns dealer info + inventory count.
 * Query: source (required) — e.g. "doralacura.com"
 *
 * NOTE: MarketCheck does NOT support search by dealer name.
 * The only supported identifiers are: source (website) or mc_dealer_id.
 */
marketcheckRouter.get("/lookup", async (c) => {
  const source = c.req.query("source") ?? "";

  if (!source.trim()) {
    return c.json({ error: { message: "source (dealer website domain) is required", code: "MISSING_SOURCE" } }, 400);
  }

  // Strip http(s):// and trailing slashes if user pastes full URL
  const cleanSource = source.trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();

  try {
    // Fetch just 1 listing to get dealer metadata + total count (used cars only)
    const data = await mcFetch("/dealerships/inventory", {
      source: cleanSource,
      car_type: "used",
      rows: 1,
      start: 0,
    }) as {
      num_found?: number;
      listings?: Record<string, unknown>[];
    };

    if (!data?.num_found || data.num_found === 0) {
      return c.json({ error: { message: `No dealership found for website "${cleanSource}". Try the exact domain (e.g. doralacura.com).`, code: "DEALER_NOT_FOUND" } }, 404);
    }

    const listing = data.listings?.[0];
    if (!listing) {
      return c.json({ error: { message: "Dealer found but no inventory data available.", code: "NO_INVENTORY" } }, 404);
    }

    const dealer = (listing.dealer ?? listing.mc_dealership ?? {}) as Record<string, unknown>;

    const dealerInfo = {
      dealer_id: String(dealer.id ?? dealer.mc_dealer_id ?? cleanSource),
      name: String(dealer.name ?? cleanSource),
      city: String(dealer.city ?? ""),
      state: String(dealer.state ?? ""),
      zip: String(dealer.zip ?? ""),
      street: String(dealer.street ?? ""),
      phone: String(dealer.phone ?? ""),
      website: cleanSource,
      latitude: Number(dealer.latitude ?? 0),
      longitude: Number(dealer.longitude ?? 0),
      inventory_count: data.num_found,
      dealer_type: String(dealer.dealer_type ?? "independent"),
      franchise_dealer: dealer.dealer_type === "franchise",
    };

    return c.json({ data: dealerInfo });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "MARKETCHECK_NOT_CONFIGURED") {
      return c.json({ error: { message: "MarketCheck API key not configured. Add MARKETCHECK_API_KEY in the ENV tab.", code: "MARKETCHECK_NOT_CONFIGURED" } }, 503);
    }
    console.error("[MarketCheck /lookup]", message);
    return c.json({ error: { message, code: "MARKETCHECK_ERROR" } }, 502);
  }
});

/**
 * GET /api/marketcheck/inventory
 * Get a dealer's full inventory by website domain.
 * Query: source (required), rows (default 200, max 200)
 */
marketcheckRouter.get("/inventory", async (c) => {
  const source = c.req.query("source") ?? "";

  if (!source.trim()) {
    return c.json({ error: { message: "source (dealer website) is required", code: "MISSING_SOURCE" } }, 400);
  }

  const cleanSource = source.trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();

  const totalWanted = Math.min(Number(c.req.query("rows") ?? "200"), 200);
  const pageSize = 50;

  try {
    // Fetch page 1 first to learn the actual num_found
    const page1 = await mcFetch("/dealerships/inventory", {
      source: cleanSource,
      rows: pageSize,
      start: 0,
    }) as { num_found?: number; listings?: Record<string, unknown>[] };

    const numFound = page1?.num_found ?? 0;
    const actualTotal = Math.min(totalWanted, numFound);
    const page1Listings = Array.isArray(page1?.listings) ? page1.listings : [];

    // Fetch remaining pages only up to actualTotal (avoids 422 from exceeding num_found)
    const remainingStarts: number[] = [];
    for (let start = pageSize; start < actualTotal; start += pageSize) {
      remainingStarts.push(start);
    }

    const extraPages = await Promise.all(
      remainingStarts.map(start =>
        mcFetch("/dealerships/inventory", {
          source: cleanSource,
          rows: Math.min(pageSize, actualTotal - start),
          start,
        }) as Promise<{ listings?: Record<string, unknown>[] }>
      )
    );

    const allListings = [
      ...page1Listings,
      ...extraPages.flatMap(p => Array.isArray(p?.listings) ? p.listings : []),
    ].slice(0, actualTotal);

    const listings = allListings
      .map(normalizeListing)
      .filter(v => v.inventory_type !== "new");

    return c.json({ data: { num_found: numFound, listings } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "MARKETCHECK_NOT_CONFIGURED") {
      return c.json({ error: { message: "MarketCheck API key not configured.", code: "MARKETCHECK_NOT_CONFIGURED" } }, 503);
    }
    console.error("[MarketCheck /inventory]", message);
    return c.json({ error: { message, code: "MARKETCHECK_ERROR" } }, 502);
  }
});

/**
 * GET /api/marketcheck/comps
 * Get market comparables (stats only, no listings) for a vehicle model.
 * Query: year, make, model, latitude (opt), longitude (opt), radius (default 100)
 *
 * NOTE: We fetch stats only (no listings rows) to conserve API quota.
 */
marketcheckRouter.get("/comps", async (c) => {
  const year = c.req.query("year");
  const make = c.req.query("make");
  const model = c.req.query("model");
  const latitude = c.req.query("latitude");
  const longitude = c.req.query("longitude");
  const radius = Number(c.req.query("radius") ?? "100");

  if (!year || !make || !model) {
    return c.json({ error: { message: "year, make, and model are required", code: "MISSING_PARAMS" } }, 400);
  }

  try {
    const params: Record<string, string | number | undefined> = {
      year,
      make,
      model,
      car_type: "used",
      rows: 3,       // Fetch 3 competitor listings + stats
      start: 0,
      stats: "price,miles",
      sort_by: "price",
      sort_order: "asc",
    };
    if (latitude && longitude) {
      params.latitude = latitude;
      params.longitude = longitude;
      params.radius = radius;
    }

    const data = await mcFetch("/search/car/active", params) as {
      num_found?: number;
      listings?: Record<string, unknown>[];
      stats?: {
        price?: { mean?: number; median?: number; min?: number; max?: number };
        miles?: { mean?: number };
      };
    };

    const numFound = data?.num_found ?? 0;
    const priceStats = data?.stats?.price ?? {};
    const milesStats = data?.stats?.miles ?? {};

    // Map competitor listings to { price, miles, dealer }
    const competitors = (Array.isArray(data?.listings) ? data.listings : []).map((l: Record<string, unknown>) => {
      const dealer = (l.dealer ?? l.mc_dealership ?? {}) as Record<string, unknown>;
      return {
        price: Number(l.price ?? 0),
        miles: Number(l.miles ?? 0),
        dealer: { name: String(dealer.name ?? "Unknown"), city: String(dealer.city ?? "") },
        dom_active: Number(l.dom_active ?? l.dom ?? 0),
      };
    });

    return c.json({
      data: {
        num_found: numFound,
        stats: {
          price: {
            mean: priceStats.mean ?? 0,
            median: priceStats.median ?? 0,
            min: priceStats.min ?? 0,
            max: priceStats.max ?? 0,
          },
          miles: {
            mean: milesStats.mean ?? 0,
          },
        },
        listings: competitors,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "MARKETCHECK_NOT_CONFIGURED") {
      return c.json({ error: { message: "MarketCheck API key not configured.", code: "MARKETCHECK_NOT_CONFIGURED" } }, 503);
    }
    if (message === "MARKETCHECK_QUOTA_EXHAUSTED") {
      return c.json({ data: null, quota_exhausted: true });
    }
    console.error("[MarketCheck /comps]", message);
    // Return null data on comp failure — scoring engine handles null gracefully
    return c.json({ data: null });
  }
});
