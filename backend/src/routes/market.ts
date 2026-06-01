import { Hono } from "hono";
import { z } from "zod";
import type { Vehicle, MarketResult } from "../types";
import { isMarketCheckConfigured, fetchMarketComps } from "./marketcheck";

const marketRouter = new Hono();

const MarketAnalyzeRequestSchema = z.object({
  vehicles: z.array(
    z.object({
      id: z.number(),
      year: z.number(),
      make: z.string(),
      model: z.string(),
      trim: z.string(),
      price: z.number(),
      mileage: z.number(),
      color: z.string(),
      vin: z.string(),
      condition: z.enum(["Excellent", "Good", "Fair"]),
      bodyType: z.enum(["Sedan", "SUV", "Truck", "Coupe", "Van", "Convertible"]),
      status: z.enum(["Available", "Sold", "Pending"]),
      description: z.string(),
    })
  ),
  radiusMiles: z.number().min(1).max(1000),
});

function buildPrompt(vehicles: Vehicle[], radiusMiles: number): string {
  const available = vehicles.filter((v) => v.status === "Available");

  return `You are an expert used car market analyst with deep knowledge of real dealership data, market pricing, and local competition. Today is ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.

Analyze these dealership vehicles for a dealer wanting to know which to post on Facebook Marketplace first. For each vehicle, use your real automotive market knowledge to provide:

1. **sellabilityScore** (1-100): Overall how urgently should they list this now?
2. **label**: "HOT DEAL" | "WORTH POSTING" | "SKIP / REPRICE"
3. **marketAvgPrice**: Your best estimate of what this exact year/make/model/trim sells for on average right now (realistic dollar figure)
4. **priceRange**: { low: number, high: number } — the typical range this sells for
5. **avgMarketMiles**: The average mileage for comparable vehicles for this year/make/model
6. **priceVsMarket**: How much BELOW (negative) or ABOVE (positive) market this vehicle is priced
7. **mileageVsMarket**: How many fewer (negative) or more (positive) miles vs market average
8. **estimatedCompetitors**: Realistic number of similar listings within ${radiusMiles} miles
9. **supplyLevel**: "LOW" | "MODERATE" | "HIGH"
10. **marketDaysOnLot**: Average days this type of vehicle sits on the market
11. **dealerDaysOnLot**: Estimated days a sharp dealer would move this in
12. **daysToSell**: "Fast" | "Average" | "Slow"
13. **pricingScore** (1-10): How competitively priced is this vehicle?
14. **marketDemand**: "High" | "Medium" | "Low"
15. **recommendedAction**: One of: "POST IMMEDIATELY" | "POST TODAY" | "REDUCE PRICE $X,XXX" | "REPRICE FIRST" — use specific dollar amounts for reductions
16. **insight**: 1 sentence honest market assessment specific to this vehicle
17. **nearestCompetitors**: Array of exactly 3 realistic NAMED competitor dealerships with realistic prices, mileage, and distances:
    [{ "name": "string", "price": number, "miles": number, "distance": number }]

Use REAL automotive market knowledge. Be honest and specific. Use real dealership name patterns (AutoNation, Hendrick, Rick Case, CarMax, etc.).

Return JSON: { "results": [ ...one object per available vehicle... ] }

Vehicles to analyze (${available.length} available):
${JSON.stringify(available, null, 2)}`;
}

marketRouter.post("/analyze", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { message: "Invalid JSON body" } }, 400);
  }

  const parseResult = MarketAnalyzeRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      { error: { message: parseResult.error.issues[0]?.message ?? "Validation error" } },
      400
    );
  }

  const { vehicles, radiusMiles } = parseResult.data;
  const availableVehicles = vehicles.filter((v) => v.status === "Available");

  if (availableVehicles.length === 0) {
    return c.json({
      data: {
        results: [] as MarketResult[],
        radiusMiles,
        analyzedAt: new Date().toISOString(),
      },
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return c.json({ error: { message: "OpenAI API key is not configured." } }, 500);
  }

  const prompt = buildPrompt(vehicles, radiusMiles);

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
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
    });
  } catch (fetchError) {
    const message = fetchError instanceof Error ? fetchError.message : "Network error calling OpenAI";
    return c.json({ error: { message } }, 502);
  }

  if (!openAIResponse.ok) {
    const errorBody = await openAIResponse.text();
    const isUnauthorized = openAIResponse.status === 401;
    const message = isUnauthorized
      ? "OpenAI API key is invalid or missing (401). Add a valid OPENAI_API_KEY in backend/.env, or use MarketCheck instead by adding MARKETCHECK_API_KEY — then market intelligence uses real market data and does not require OpenAI."
      : `OpenAI API error ${openAIResponse.status}: ${errorBody}`;
    return c.json({ error: { message } }, 502);
  }

  type OpenAICompletionResponse = {
    choices: Array<{ message: { content: string } }>;
  };

  const completion = (await openAIResponse.json()) as OpenAICompletionResponse;
  const content = completion.choices[0]?.message?.content;

  if (!content) {
    return c.json({ error: { message: "Empty response from OpenAI" } }, 502);
  }

  let parsed: { results: unknown };
  try {
    parsed = JSON.parse(content) as { results: unknown };
  } catch {
    return c.json({ error: { message: "Failed to parse OpenAI JSON response" } }, 502);
  }

  const rawResults = Array.isArray(parsed.results) ? parsed.results : [];

  function safeNum(val: unknown, fallback: number): number {
    return typeof val === "number" && isFinite(val) ? val : fallback;
  }
  function safeStr(val: unknown, fallback: string): string {
    return typeof val === "string" && val.length > 0 ? val : fallback;
  }

  const results: MarketResult[] = rawResults
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => {
      const rawCompetitors = Array.isArray(item.nearestCompetitors) ? item.nearestCompetitors : [];
      const nearestCompetitors = rawCompetitors
        .filter((comp): comp is Record<string, unknown> => typeof comp === "object" && comp !== null)
        .slice(0, 3)
        .map((comp) => ({
          name: safeStr(comp.name, "Local Dealer"),
          price: safeNum(comp.price, 0),
          miles: safeNum(comp.miles, 0),
          distance: safeNum(comp.distance, 0),
        }));

      const rawRange =
        typeof item.priceRange === "object" && item.priceRange !== null
          ? (item.priceRange as Record<string, unknown>)
          : {};

      return {
        id: safeNum(item.id, 0),
        label: (
          item.label === "HOT DEAL" ||
          item.label === "WORTH POSTING" ||
          item.label === "SKIP / REPRICE"
        )
          ? (item.label as "HOT DEAL" | "WORTH POSTING" | "SKIP / REPRICE")
          : ("WORTH POSTING" as const),
        sellabilityScore: Math.min(100, Math.max(1, safeNum(item.sellabilityScore, 50))),
        marketAvgPrice: safeNum(item.marketAvgPrice, 0),
        priceRange: {
          low: safeNum(rawRange.low, 0),
          high: safeNum(rawRange.high, 0),
        },
        avgMarketMiles: safeNum(item.avgMarketMiles, 0),
        priceVsMarket: safeNum(item.priceVsMarket, 0),
        mileageVsMarket: safeNum(item.mileageVsMarket, 0),
        estimatedCompetitors: safeNum(item.estimatedCompetitors, 0),
        supplyLevel: (
          item.supplyLevel === "LOW" ||
          item.supplyLevel === "MODERATE" ||
          item.supplyLevel === "HIGH"
        )
          ? (item.supplyLevel as "LOW" | "MODERATE" | "HIGH")
          : ("MODERATE" as const),
        marketDaysOnLot: safeNum(item.marketDaysOnLot, 30),
        dealerDaysOnLot: safeNum(item.dealerDaysOnLot, 30),
        marketDemand: (
          item.marketDemand === "High" ||
          item.marketDemand === "Medium" ||
          item.marketDemand === "Low"
        )
          ? (item.marketDemand as "High" | "Medium" | "Low")
          : ("Medium" as const),
        daysToSell: (
          item.daysToSell === "Fast" ||
          item.daysToSell === "Average" ||
          item.daysToSell === "Slow"
        )
          ? (item.daysToSell as "Fast" | "Average" | "Slow")
          : ("Average" as const),
        pricingScore: Math.min(10, Math.max(1, safeNum(item.pricingScore, 5))),
        recommendedAction: safeStr(item.recommendedAction, "POST TODAY"),
        insight: safeStr(item.insight, ""),
        nearestCompetitors,
      };
    });

  return c.json({
    data: {
      results,
      radiusMiles,
      analyzedAt: new Date().toISOString(),
    },
  });
});

const SingleAnalyzeRequestSchema = z.object({
  vehicle: z.object({
    id: z.number(),
    year: z.number(),
    make: z.string(),
    model: z.string(),
    trim: z.string(),
    price: z.number(),
    mileage: z.number(),
    color: z.string(),
    vin: z.string(),
    condition: z.enum(["Excellent", "Good", "Fair"]),
    bodyType: z.enum(["Sedan", "SUV", "Truck", "Coupe", "Van", "Convertible"]),
    status: z.enum(["Available", "Sold", "Pending"]),
    description: z.string(),
  }),
  radiusMiles: z.number().min(1).max(1000),
});

marketRouter.post("/analyze-one", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { message: "Invalid JSON body" } }, 400);
  }

  const parseResult = SingleAnalyzeRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      { error: { message: parseResult.error.issues[0]?.message ?? "Validation error" } },
      400
    );
  }

  const { vehicle, radiusMiles } = parseResult.data;
  const v = vehicle as Vehicle;

  // Vehicle Comparison uses MarketCheck API only (real market data)
  if (!isMarketCheckConfigured()) {
    return c.json(
      {
        error: {
          message:
            "Vehicle Comparison requires MarketCheck. Add MARKETCHECK_API_KEY to backend/.env and restart the backend.",
        },
      },
      503
    );
  }

  try {
    const comps = await fetchMarketComps({
      year: v.year,
      make: v.make,
      model: v.model,
      radius: radiusMiles,
    });
    if (!comps) {
      return c.json(
        {
          error: {
            message:
              "MarketCheck request failed. Check MARKETCHECK_API_KEY in backend/.env, restart the backend, and ensure the key is valid at marketcheck.com.",
          },
        },
        503
      );
    }

    const meanPrice = comps.stats.price.mean;
    const meanMiles = comps.stats.miles.mean;
    const priceVsMarket = v.price - meanPrice;
    const mileageVsMarket = v.mileage - meanMiles;
    const numFound = comps.num_found;
    const supplyLevel = numFound < 30 ? "LOW" as const : numFound < 100 ? "MODERATE" as const : "HIGH" as const;
    const priceScore = meanPrice > 0 ? Math.max(-25, Math.min(25, (25 * -priceVsMarket) / meanPrice)) : 0;
    const milesScore = meanMiles > 0 ? Math.max(-25, Math.min(25, (25 * -mileageVsMarket) / meanMiles)) : 0;
    const sellabilityScore = Math.min(100, Math.max(1, Math.round(50 + priceScore + milesScore)));
    const label =
      sellabilityScore >= 70 ? ("HOT DEAL" as const) :
      sellabilityScore >= 40 ? ("WORTH POSTING" as const) :
      ("SKIP / REPRICE" as const);
    const pricingScore = Math.min(10, Math.max(1, Math.round(1 + (9 * (sellabilityScore / 100)))));
    const recommendedAction =
      priceVsMarket <= -0.05 * meanPrice ? "POST IMMEDIATELY" :
      priceVsMarket <= 0 ? "POST TODAY" :
      `REDUCE PRICE $${Math.round(priceVsMarket).toLocaleString()}`;
    const nearestCompetitors = comps.listings.slice(0, 3).map((l, i) => ({
      name: l.dealer.name || "Competitor",
      price: l.price,
      miles: l.miles,
      distance: (i + 1) * 15,
    }));

    const result: MarketResult = {
      id: v.id,
      label,
      sellabilityScore,
      marketAvgPrice: meanPrice,
      priceRange: { low: comps.stats.price.min, high: comps.stats.price.max },
      avgMarketMiles: meanMiles,
      priceVsMarket,
      mileageVsMarket,
      estimatedCompetitors: numFound,
      supplyLevel,
      marketDaysOnLot: 30,
      dealerDaysOnLot: sellabilityScore >= 70 ? 14 : sellabilityScore >= 40 ? 21 : 45,
      marketDemand: supplyLevel === "LOW" ? "High" as const : supplyLevel === "HIGH" ? "Low" as const : "Medium" as const,
      daysToSell: sellabilityScore >= 70 ? "Fast" as const : sellabilityScore >= 40 ? "Average" as const : "Slow" as const,
      pricingScore,
      recommendedAction,
      insight: `Based on ${numFound} comparable listings: ${priceVsMarket < 0 ? "Priced below market." : "Above market — consider repricing."} Avg market miles: ${Math.round(meanMiles).toLocaleString()}.`,
      nearestCompetitors,
    };

    return c.json({
      data: {
        result,
        radiusMiles,
        analyzedAt: new Date().toISOString(),
      },
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "MARKETCHECK_QUOTA_EXHAUSTED") {
      return c.json(
        { error: { message: "MarketCheck API quota exhausted. Wait a few minutes and try again, or check your MarketCheck plan at marketcheck.com." } },
        503
      );
    }
    console.error("[market analyze-one MarketCheck]", err instanceof Error ? err.message : err);
    return c.json(
      {
        error: {
          message:
            "MarketCheck request failed. Check MARKETCHECK_API_KEY in backend/.env and restart the backend.",
        },
      },
      503
    );
  }
});

export { marketRouter };

