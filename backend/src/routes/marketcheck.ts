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

export function isMarketCheckConfigured(): boolean {
  const key = env.MARKETCHECK_API_KEY;
  return Boolean(key && key !== "your_marketcheck_api_key_here");
}

export type MarketCompsListing = {
  price: number;
  miles: number;
  dealer: { name: string; city: string };
  dom_active: number;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  is_certified?: boolean;
};
export type MarketCompsData = {
  num_found: number;
  stats: { price: { mean: number; median: number; min: number; max: number }; miles: { mean: number } };
  listings: MarketCompsListing[];
};

/** Fetch market comps for a vehicle (used by /comps and by market analyze-one). Returns null if not configured or on error. */
export async function fetchMarketComps(params: {
  year: number;
  make: string;
  model: string;
  trim?: string;
  radius?: number;
  latitude?: number;
  longitude?: number;
  rows?: number;
}): Promise<MarketCompsData | null> {
  try {
    const apiParams: Record<string, string | number | undefined> = {
      year: String(params.year),
      make: params.make,
      model: params.model,
      car_type: "used",
      rows: params.rows ?? 3,
      start: 0,
      stats: "price,miles",
      sort_by: "dist",
      sort_order: "asc",
    };
    if (params.trim?.trim()) apiParams.trim = params.trim.trim();
    const radiusMiles = params.radius ?? 100;
    apiParams.radius = radiusMiles;
    // MarketCheck requires lat/long or zip for radius to apply; use US default so radius works
    const lat = params.latitude ?? 34.05;
    const lng = params.longitude ?? -118.25;
    apiParams.latitude = lat;
    apiParams.longitude = lng;

    const data = await mcFetch("/search/car/active", apiParams) as {
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
    const build = (l: Record<string, unknown>) => (l.build ?? {}) as Record<string, unknown>;
    let listings = (Array.isArray(data?.listings) ? data.listings : []).map((l: Record<string, unknown>) => {
      const dealer = (l.dealer ?? l.mc_dealership ?? {}) as Record<string, unknown>;
      const b = build(l);
      return {
        price: Number(l.price ?? l.dealer_price ?? l.sale_price ?? l.internet_price ?? l.list_price ?? 0),
        miles: Number(l.miles ?? 0),
        dealer: { name: String(dealer.name ?? "Unknown"), city: String(dealer.city ?? "") },
        dom_active: Number(l.dom_active ?? l.dom ?? 0),
        year: Number(b.year ?? l.year ?? 0) || undefined,
        make: String(b.make ?? l.make ?? "").trim() || undefined,
        model: String(b.model ?? l.model ?? "").trim() || undefined,
        trim: String(b.trim ?? l.trim ?? "").trim() || undefined,
        is_certified: Boolean(l.is_certified),
      };
    });

    // Restrict to same make and (when requested) same trim so we only show true comparables
    const makeLower = params.make.trim().toLowerCase();
    const trimFilter = params.trim?.trim().toLowerCase();
    listings = listings.filter((l) => {
      const sameMake = (l.make ?? "").toLowerCase() === makeLower;
      if (!sameMake) return false;
      if (trimFilter) {
        const listingTrim = (l.trim ?? "").toLowerCase();
        return listingTrim === trimFilter || listingTrim.includes(trimFilter) || trimFilter.includes(listingTrim);
      }
      return true;
    });

    const withPrice = listings.filter((l) => l.price > 0);
    const prices = withPrice.map((l) => l.price);
    const milesList = withPrice.map((l) => l.miles);
    const mean = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    const sortedPrices = [...prices].sort((a, b) => a - b);
    const mid = Math.floor(sortedPrices.length / 2);
    const medianPrice = sortedPrices.length
      ? sortedPrices.length % 2
        ? sortedPrices[mid]
        : (sortedPrices[mid - 1] + sortedPrices[mid]) / 2
      : 0;

    return {
      num_found: listings.length,
      stats: {
        price: {
          mean: mean(prices) || priceStats.mean ?? 0,
          median: medianPrice || priceStats.median ?? 0,
          min: prices.length ? Math.min(...prices) : priceStats.min ?? 0,
          max: prices.length ? Math.max(...prices) : priceStats.max ?? 0,
        },
        miles: { mean: mean(milesList) || milesStats.mean ?? 0 },
      },
      listings,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "MARKETCHECK_QUOTA_EXHAUSTED") throw err;
    return null;
  }
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

/** VIN decode via MarketCheck Basic VIN Decoder; returns { year, make, model, trim } or null. */
export async function decodeVin(vin: string): Promise<{ year: number; make: string; model: string; trim: string } | null> {
  const cleanVin = vin.trim().toUpperCase();
  if (cleanVin.length !== 17) return null;
  let apiKey: string;
  try {
    apiKey = getApiKey();
  } catch {
    throw new Error("MARKETCHECK_NOT_CONFIGURED");
  }
  const url = new URL(`${MC_BASE}/decode/car/${encodeURIComponent(cleanVin)}/specs`);
  url.searchParams.set("api_key", apiKey);
  let res: Response;
  try {
    res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  } catch (e) {
    console.error("[MarketCheck VIN decode] Network error", e);
    throw new Error("VIN decode request failed. Is the backend able to reach api.marketcheck.com?");
  }
  if (res.status === 429) throw new Error("MARKETCHECK_QUOTA_EXHAUSTED");
  if (res.status === 401) throw new Error("MARKETCHECK_DECODE_401");
  if (res.status === 403) throw new Error("MARKETCHECK_DECODE_403");
  const text = await res.text();
  if (!res.ok) {
    console.error("[MarketCheck VIN decode]", res.status, text.slice(0, 400));
    throw new Error(`MarketCheck decode ${res.status}: ${text.slice(0, 200)}`);
  }
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    console.error("[MarketCheck VIN decode] Invalid JSON", text.slice(0, 200));
    return null;
  }
  // Basic VIN Decoder returns flat: year, make, model, trim (docs.marketcheck.com)
  const year = Number(data.year ?? (data.build as Record<string, unknown>)?.year ?? 0);
  const make = String(data.make ?? (data.build as Record<string, unknown>)?.make ?? "").trim();
  const model = String(data.model ?? (data.build as Record<string, unknown>)?.model ?? "").trim();
  const trim = String(data.trim ?? (data.build as Record<string, unknown>)?.trim ?? "").trim();
  if (!year || !make || !model) {
    const valid = data.is_valid === false ? " (VIN invalid or not decodable)" : "";
    console.error("[MarketCheck VIN decode] Missing year/make/model", data);
    throw new Error(`Could not decode VIN${valid}. Check VIN format.`);
  }
  return { year, make, model, trim: trim || "Base" };
}

export const marketcheckRouter = new Hono();

/**
 * GET /api/marketcheck/vin-decode?vin=XXXXXXXXXXXXXXX
 * Decode 17-char VIN to year, make, model, trim (MarketCheck basic decode).
 */
marketcheckRouter.get("/vin-decode", async (c) => {
  const vin = c.req.query("vin") ?? "";
  if (!vin.trim()) {
    return c.json({ error: { message: "vin (17 characters) is required", code: "MISSING_VIN" } }, 400);
  }
  if (vin.trim().length !== 17) {
    return c.json({ error: { message: "VIN must be 17 characters", code: "INVALID_VIN" } }, 400);
  }
  try {
    const decoded = await decodeVin(vin);
    if (!decoded) {
      return c.json({ error: { message: "Could not decode VIN. Check format or try again.", code: "DECODE_FAILED" } }, 422);
    }
    return c.json({ data: decoded });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "MARKETCHECK_NOT_CONFIGURED") {
      return c.json({ error: { message: "MarketCheck API key not configured. Add MARKETCHECK_API_KEY=your_key to backend/.env and restart the backend.", code: "MARKETCHECK_NOT_CONFIGURED" } }, 503);
    }
    if (message === "MARKETCHECK_QUOTA_EXHAUSTED") {
      return c.json({ error: { message: "MarketCheck API quota exhausted.", code: "MARKETCHECK_QUOTA_EXHAUSTED" } }, 503);
    }
    if (message === "MARKETCHECK_DECODE_401") {
      return c.json({ error: { message: "MarketCheck API key invalid or missing (401). Check MARKETCHECK_API_KEY in backend/.env.", code: "MARKETCHECK_DECODE_401" } }, 503);
    }
    if (message === "MARKETCHECK_DECODE_403") {
      return c.json({ error: { message: "MarketCheck API key does not have access to VIN decode (403). Check your MarketCheck plan.", code: "MARKETCHECK_DECODE_403" } }, 503);
    }
    // Include message so user sees "Could not decode VIN. Check VIN format." or MarketCheck error
    const userMessage = message.startsWith("MarketCheck decode") || message.startsWith("Could not decode") || message.startsWith("VIN decode request failed")
      ? message
      : "VIN decode failed. Check backend logs.";
    console.error("[MarketCheck /vin-decode]", message);
    return c.json({ error: { message: userMessage, code: "DECODE_FAILED" } }, 422);
  }
});

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
      return c.json({ error: { message: "MarketCheck API key not configured. Add MARKETCHECK_API_KEY=your_key to backend/.env and restart the backend.", code: "MARKETCHECK_NOT_CONFIGURED" } }, 503);
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
      return c.json({ error: { message: "MarketCheck API key not configured. Add MARKETCHECK_API_KEY=your_key to backend/.env and restart the backend.", code: "MARKETCHECK_NOT_CONFIGURED" } }, 503);
    }
    console.error("[MarketCheck /inventory]", message);
    return c.json({ error: { message, code: "MARKETCHECK_ERROR" } }, 502);
  }
});

/**
 * GET /api/marketcheck/comps
 * Get market comparables for a vehicle model.
 * Query: year, make, model, trim (opt), latitude (opt), longitude (opt), radius (default 100), rows (default 50)
 */
marketcheckRouter.get("/comps", async (c) => {
  const year = c.req.query("year");
  const make = c.req.query("make");
  const model = c.req.query("model");
  const trim = c.req.query("trim");
  const latitude = c.req.query("latitude");
  const longitude = c.req.query("longitude");
  const radius = Number(c.req.query("radius") ?? "100");
  const rows = Math.min(100, Math.max(1, Number(c.req.query("rows") ?? "50")));

  if (!year || !make || !model) {
    return c.json({ error: { message: "year, make, and model are required", code: "MISSING_PARAMS" } }, 400);
  }

  try {
    const data = await fetchMarketComps({
      year: Number(year),
      make,
      model,
      trim: trim || undefined,
      radius,
      rows,
      latitude: latitude ? Number(latitude) : undefined,
      longitude: longitude ? Number(longitude) : undefined,
    });
    if (!data) {
      return c.json({ error: { message: "MarketCheck API key not configured. Add MARKETCHECK_API_KEY=your_key to backend/.env and restart the backend.", code: "MARKETCHECK_NOT_CONFIGURED" } }, 503);
    }
    return c.json({
      data: {
        num_found: data.num_found,
        stats: data.stats,
        listings: data.listings,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "MARKETCHECK_QUOTA_EXHAUSTED") {
      return c.json({ data: null, quota_exhausted: true });
    }
    console.error("[MarketCheck /comps]", message);
    return c.json({ data: null });
  }
});
