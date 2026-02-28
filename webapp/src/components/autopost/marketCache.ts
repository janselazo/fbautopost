// Shared market analysis cache and fetch utility
// Used by both VehicleDetailDrawer and the pre-warm hook in InventoryTable

import { getBackendUrl } from "@/lib/backend-url";

export interface MarketResult {
  id: number;
  label: 'HOT DEAL' | 'WORTH POSTING' | 'SKIP / REPRICE';
  sellabilityScore: number;
  marketAvgPrice: number;
  priceRange: { low: number; high: number };
  avgMarketMiles: number;
  priceVsMarket: number;
  mileageVsMarket: number;
  estimatedCompetitors: number;
  supplyLevel: 'LOW' | 'MODERATE' | 'HIGH';
  marketDaysOnLot: number;
  dealerDaysOnLot: number;
  marketDemand: 'High' | 'Medium' | 'Low';
  daysToSell: 'Fast' | 'Average' | 'Slow';
  pricingScore: number;
  recommendedAction: string;
  insight: string;
  nearestCompetitors: { name: string; price: number; miles: number; distance: number }[];
}

// Singleton cache shared across the entire app session
export const analysisCache = new Map<string, MarketResult>();

export function cacheKey(vehicleId: number, radiusMiles: number): string {
  return `${vehicleId}-${radiusMiles}`;
}

type SingleApiResponse = {
  data?: { result: MarketResult; radiusMiles: number; analyzedAt: string };
  error?: { message: string };
};

export async function fetchVehicleAnalysis(
  vehicle: { id: number; year: number; make: string; model: string; trim: string; price: number; mileage: number; color: string; vin: string; condition: string; bodyType: string; status: string; description: string },
  radiusMiles: number
): Promise<MarketResult | null> {
  const key = cacheKey(vehicle.id, radiusMiles);
  const cached = analysisCache.get(key);
  if (cached) return cached;

  try {
    const res = await fetch(`${getBackendUrl()}/api/market/analyze-one`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vehicle, radiusMiles }),
    });
    const json = (await res.json()) as SingleApiResponse;
    if (res.ok && json.data?.result) {
      analysisCache.set(key, json.data.result);
      return json.data.result;
    }
  } catch {
    // silently fail for background fetches
  }
  return null;
}
