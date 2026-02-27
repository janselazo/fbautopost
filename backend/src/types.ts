import { z } from "zod";

// ── MarketCheck API types ──────────────────────────────────────────────────

export const MCDealerSchema = z.object({
  dealer_id: z.string(),
  name: z.string(),
  city: z.string(),
  state: z.string(),
  zip: z.string(),
  street: z.string(),
  phone: z.string().optional().default(""),
  website: z.string().optional().default(""),
  latitude: z.number(),
  longitude: z.number(),
  inventory_count: z.number().optional().default(0),
  dealer_type: z.string().optional().default("independent"),
  franchise_dealer: z.boolean().optional().default(false),
});
export type MCDealer = z.infer<typeof MCDealerSchema>;

export const MCListingSchema = z.object({
  id: z.string(),
  vin: z.string(),
  year: z.number(),
  make: z.string(),
  model: z.string(),
  trim: z.string().optional().default(""),
  price: z.number(),
  miles: z.number().optional().default(0),
  exterior_color: z.string().optional().default(""),
  interior_color: z.string().optional().default(""),
  body_type: z.string().optional().default(""),
  fuel_type: z.string().optional().default(""),
  transmission: z.string().optional().default(""),
  drivetrain: z.string().optional().default(""),
  engine: z.string().optional().default(""),
  inventory_type: z.string().optional().default("used"),
  dom_active: z.number().optional().default(0),
  media: z.object({
    photo_links: z.array(z.string()).optional().default([]),
  }).optional().default({ photo_links: [] }),
  dealer: z.object({
    id: z.string().optional().default(""),
    name: z.string().optional().default(""),
    city: z.string().optional().default(""),
    state: z.string().optional().default(""),
  }).optional().default({}),
  heading: z.string().optional().default(""),
  seller_type: z.string().optional().default("dealer"),
  is_certified: z.boolean().optional().default(false),
});
export type MCListing = z.infer<typeof MCListingSchema>;

export const MCMarketCompsSchema = z.object({
  num_found: z.number(),
  stats: z.object({
    price: z.object({
      mean: z.number(),
      median: z.number().optional().default(0),
      min: z.number().optional().default(0),
      max: z.number().optional().default(0),
    }),
    miles: z.object({
      mean: z.number(),
    }),
  }),
  listings: z.array(z.object({
    price: z.number(),
    miles: z.number().optional().default(0),
    dealer: z.object({
      name: z.string().optional().default(""),
      city: z.string().optional().default(""),
    }).optional().default({}),
    dom_active: z.number().optional().default(0),
  })),
});
export type MCMarketComps = z.infer<typeof MCMarketCompsSchema>;

// Vehicle types
export const VehicleStatusSchema = z.enum(["Available", "Sold", "Pending"]);
export const VehicleConditionSchema = z.enum(["Excellent", "Good", "Fair"]);
export const VehicleBodyTypeSchema = z.enum(["Sedan", "SUV", "Truck", "Coupe", "Van", "Convertible"]);

export const VehicleSchema = z.object({
  id: z.number(),
  year: z.number(),
  make: z.string(),
  model: z.string(),
  trim: z.string(),
  price: z.number(),
  mileage: z.number(),
  color: z.string(),
  vin: z.string(),
  condition: VehicleConditionSchema,
  bodyType: VehicleBodyTypeSchema,
  status: VehicleStatusSchema,
  description: z.string(),
  photoUrl: z.string().optional().nullable(),
});

export type Vehicle = z.infer<typeof VehicleSchema>;

// Market analysis types
export const MarketDemandSchema = z.enum(["High", "Medium", "Low"]);
export const DaysToSellSchema = z.enum(["Fast", "Average", "Slow"]);
export const LabelSchema = z.enum(["HOT DEAL", "WORTH POSTING", "SKIP / REPRICE"]);
export const SupplyLevelSchema = z.enum(["LOW", "MODERATE", "HIGH"]);

export const CompetitorSchema = z.object({
  name: z.string(),
  price: z.number(),
  miles: z.number(),
  distance: z.number(),
});

export const MarketResultSchema = z.object({
  id: z.number(),
  label: LabelSchema,
  sellabilityScore: z.number().min(1).max(100),
  marketAvgPrice: z.number(),
  priceRange: z.object({ low: z.number(), high: z.number() }),
  avgMarketMiles: z.number(),
  priceVsMarket: z.number(),
  mileageVsMarket: z.number(),
  estimatedCompetitors: z.number(),
  supplyLevel: SupplyLevelSchema,
  marketDaysOnLot: z.number(),
  dealerDaysOnLot: z.number(),
  marketDemand: MarketDemandSchema,
  daysToSell: DaysToSellSchema,
  pricingScore: z.number().min(1).max(10),
  recommendedAction: z.string(),
  insight: z.string(),
  nearestCompetitors: z.array(CompetitorSchema),
});

export type MarketResult = z.infer<typeof MarketResultSchema>;
export type Competitor = z.infer<typeof CompetitorSchema>;

export const MarketAnalyzeRequestSchema = z.object({
  vehicles: z.array(VehicleSchema),
  radiusMiles: z.number().min(1).max(1000),
});

export type MarketAnalyzeRequest = z.infer<typeof MarketAnalyzeRequestSchema>;

export const MarketAnalyzeResponseSchema = z.object({
  results: z.array(MarketResultSchema),
  radiusMiles: z.number(),
  analyzedAt: z.string(),
});

export type MarketAnalyzeResponse = z.infer<typeof MarketAnalyzeResponseSchema>;
