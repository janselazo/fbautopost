import React, { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import JSZip from "jszip";
import { useQueryClient } from "@tanstack/react-query";
import { useDealership, type DealershipVehicle } from "./DealershipContext";
import type { ActiveView } from "./types";
import { api } from "@/lib/api";
import { getBackendUrl } from "@/lib/backend-url";

// ═══════════════════════════════════════════════════════════════
// CAR Posting — CONNECT INVENTORY MODULE
// MarketCheck API Integration + Competitive Intelligence
// ═══════════════════════════════════════════════════════════════

// ── TYPES ──
interface Dealer {
  dealer_id: string;
  name: string;
  city: string;
  state: string;
  zip: string;
  street: string;
  phone: string;
  website: string;
  latitude: number;
  longitude: number;
  inventory_count: number;
  dealer_type: string;
  franchise_dealer: boolean;
}

interface VehicleListing {
  id: string;
  vin: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  price: number;
  miles: number;
  exterior_color: string;
  interior_color: string;
  body_type: string;
  fuel_type: string;
  transmission: string;
  drivetrain: string;
  engine: string;
  inventory_type: string;
  dom_active: number;
  media: { photo_links: string[] };
  dealer: { id: string; name: string; city: string; state: string };
  heading: string;
  seller_type: string;
  is_certified: boolean;
}

interface MarketStats {
  price: { mean: number; median: number; min: number; max: number };
  miles: { mean: number };
}

interface MarketData {
  avg_price: number;
  median_price: number;
  min_price: number;
  max_price: number;
  avg_miles: number;
  total_listings: number;
  avg_dom: number;
  competitors: Array<{
    price: number;
    miles: number;
    dealer: { name: string; city: string };
    dom_active: number;
  }>;
}

interface ScoredVehicle extends VehicleListing {
  score: number;
  tier: "hot" | "decent" | "skip";
  rec: string;
  reason: string;
  price_diff: number;
  mile_diff: number;
  supply: string;
  price_estimated: boolean;
  market: {
    price: MarketStats["price"];
    miles: MarketStats["miles"];
    total: number;
    competitors: MarketData["competitors"];
  } | null;
}

interface ScanProgress {
  step: string;
  pct: number;
  detail: string;
}

// ── API SERVICE LAYER ──
// In production, these calls go through YOUR backend proxy
// so the API key is never exposed to the browser.
// This module simulates the full flow with realistic mock data
// while showing the exact API calls your backend would make.

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const API = {
  // Look up dealer by website domain — returns a single Dealer object
  lookupDealer: async (source: string): Promise<Dealer> => {
    const res = await fetch(`${getBackendUrl()}/api/marketcheck/lookup?source=${encodeURIComponent(source)}`);
    const json = await res.json();
    if (json.error?.code === "MARKETCHECK_NOT_CONFIGURED") throw new Error("marketcheck_not_configured");
    if (json.error?.code === "DEALER_NOT_FOUND") throw new Error(json.error.message);
    if (!res.ok) throw new Error(json.error?.message || "Lookup failed");
    return json.data;
  },

  getDealerInventory: async (source: string): Promise<{ num_found: number; listings: VehicleListing[] }> => {
    const res = await fetch(`${getBackendUrl()}/api/marketcheck/inventory?source=${encodeURIComponent(source)}&rows=200`);
    const json = await res.json();
    if (json.error?.code === "MARKETCHECK_NOT_CONFIGURED") throw new Error("marketcheck_not_configured");
    if (!res.ok) throw new Error(json.error?.message || "Inventory fetch failed");
    return json.data ?? { num_found: 0, listings: [] };
  },

  getMarketComps: async (vehicle: VehicleListing, lat: number, lng: number): Promise<{
    num_found: number;
    stats: MarketStats;
    listings: MarketData["competitors"];
  } | null> => {
    const params = new URLSearchParams({
      year: String(vehicle.year),
      make: vehicle.make,
      model: vehicle.model,
      latitude: String(lat),
      longitude: String(lng),
      radius: "100",
    });
    const res = await fetch(`${getBackendUrl()}/api/marketcheck/comps?${params}`);
    const json = await res.json().catch(() => ({}));
    if (json.quota_exhausted === true) {
      const err = new Error("quota_exhausted");
      (err as Error & { quota_exhausted: boolean }).quota_exhausted = true;
      throw err;
    }
    if (!res.ok) return null;
    if (!json.data) return null;
    return json.data;
  },
};

// ── COMPETITIVE SCORING ENGINE ──
function scoreVehicle(
  vehicle: VehicleListing,
  market: {
    num_found: number;
    stats: MarketStats;
    listings: MarketData["competitors"];
  } | null
): ScoredVehicle {
  // If price is missing but market data exists, use market avg as best estimate
  const effectivePrice = vehicle.price > 0
    ? vehicle.price
    : (market?.stats.price.mean ?? 0);
  const priceEstimated = vehicle.price === 0 && effectivePrice > 0;
  const vehicleWithPrice = priceEstimated
    ? { ...vehicle, price: effectivePrice }
    : vehicle;

  if (!market)
    return {
      ...vehicleWithPrice,
      score: 50,
      tier: "decent",
      rec: "No market data",
      reason: "Could not find comparable vehicles to analyze.",
      price_diff: 0,
      mile_diff: 0,
      supply: "unknown",
      price_estimated: priceEstimated,
      market: null,
    };

  const pd = market.stats.price.mean - effectivePrice;
  const md = market.stats.miles.mean - vehicle.miles;
  const supply =
    market.num_found <= 6 ? "low" : market.num_found <= 15 ? "moderate" : "high";

  let sc = 50;
  sc += Math.min(30, Math.max(-30, (pd / market.stats.price.mean) * 300));
  if (market.stats.miles.mean > 0)
    sc += Math.min(15, Math.max(-15, (md / market.stats.miles.mean) * 50));
  if (supply === "low") sc += 10;
  else if (supply === "moderate") sc += 3;
  if (vehicle.dom_active > 60) sc -= 5;
  else if (vehicle.dom_active < 20) sc += 5;
  sc = Math.max(0, Math.min(100, Math.round(sc)));

  let tier: "hot" | "decent" | "skip", rec: string, reason: string;
  if (sc >= 75) {
    tier = "hot";
    rec = "POST IMMEDIATELY";
    reason =
      pd > 2000 && supply === "low"
        ? `$${pd.toLocaleString()} below market avg with only ${market.num_found} competing units within 100mi. This will generate messages fast.`
        : pd > 1500
          ? `$${pd.toLocaleString()} under market with ${md > 0 ? "lower mileage than avg" : "competitive mileage"}. Strong value play.`
          : `Strong competitive position. ${vehicle.miles < market.stats.miles.mean ? "Mileage advantage adds appeal." : ""} Post with confidence.`;
  } else if (sc >= 55) {
    tier = "decent";
    rec = "WORTH POSTING";
    reason =
      pd > 0
        ? `$${pd.toLocaleString()} under avg. ${market.num_found > 15 ? "High competition — listing copy needs to stand out." : "Moderate competition."} ${vehicle.dom_active > 40 ? `On lot ${vehicle.dom_active} days — priority to move.` : ""}`
        : `Near market avg. ${vehicle.miles < market.stats.miles.mean ? `Mileage advantage (${md.toLocaleString()} fewer mi) is the hook.` : "Consider repricing."}`;
  } else {
    tier = "skip";
    rec = "SKIP OR REPRICE";
    reason =
      pd < -1000
        ? `$${Math.abs(pd).toLocaleString()} ABOVE market avg. Buyers have cheaper options. Don't post until repriced.`
        : `Not competitive enough. ${vehicle.miles > market.stats.miles.mean ? "Higher mileage than avg works against you." : ""} Focus on stronger deals.`;
  }

  return {
    ...vehicleWithPrice,
    score: sc,
    tier,
    rec,
    reason,
    price_diff: pd,
    mile_diff: md,
    supply,
    price_estimated: priceEstimated,
    market: {
      ...market.stats,
      total: market.num_found,
      competitors: market.listings,
    },
  };
}

// ── AI LISTING GENERATOR ──
function generateListing(v: ScoredVehicle): string {
  const pd = v.price_diff || 0;
  const md = v.mile_diff || 0;
  let desc = `${v.year} ${v.make} ${v.model} ${v.trim}\n`;
  desc += `${v.exterior_color} · ${v.miles.toLocaleString()} miles · ${v.transmission}\n\n`;

  if (pd > 2000)
    desc += `Priced $${pd.toLocaleString()} below market average — best deal in South Florida right now.\n\n`;
  else if (pd > 500)
    desc += `Below market value — great deal compared to similar listings nearby.\n\n`;

  if (md > 5000)
    desc += `Only ${v.miles.toLocaleString()} miles — ${md.toLocaleString()} fewer than the average ${v.year} ${v.model} on the market.\n\n`;

  if (
    v.drivetrain === "SH-AWD" ||
    v.drivetrain === "AWD" ||
    v.drivetrain === "4WD"
  )
    desc += `${v.drivetrain} for confident handling in any conditions.\n`;
  if (v.engine?.includes("Turbo")) desc += `Turbocharged performance.\n`;
  if (v.is_certified)
    desc += `Certified Pre-Owned with manufacturer warranty.\n`;
  if (v.fuel_type === "Hybrid")
    desc += `Hybrid efficiency — save on gas in Miami traffic.\n`;

  desc += `\nThoroughly inspected and ready to go.\n\n`;
  desc += `📍 Doral, FL 33172\n📱 Message for details\n💰 Financing available\n`;
  desc += `\n#${v.make} #${v.model} #Miami #Doral #305CarDeals #UsedCars`;

  return desc;
}

// ═══════════════════════════════════════════════════════════════
// UI COMPONENTS
// ═══════════════════════════════════════════════════════════════

const FBIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="11" fill="#1877F2" />
    <path
      d="M16.5 6H14.25C13.01 6 12 7.01 12 8.25V10.5H9.75V13.5H12V21H15V13.5H17.25L18 10.5H15V8.625C15 8.28 15.28 8 15.625 8H16.5V6Z"
      fill="white"
    />
  </svg>
);

function PostModal({
  vehicle,
  onClose,
}: {
  vehicle: ScoredVehicle;
  onClose: () => void;
}) {
  const [cp, setCp] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<number>>(
    new Set((vehicle.media.photo_links ?? []).map((_, i) => i))
  );
  const [imgErrors, setImgErrors] = useState<Set<number>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [extensionSent, setExtensionSent] = useState(false);
  const listing = generateListing(vehicle);

  const photoLinks: string[] = vehicle.media.photo_links ?? [];

  const copy = (t: string, f: string) => {
    navigator.clipboard.writeText(t).catch(() => {});
    setCp(f);
    setTimeout(() => setCp(null), 1800);
  };

  const togglePhoto = (i: number) => {
    setSelectedPhotos((prev) => {
      const next = new Set(prev);
      if (next.has(i)) {
        next.delete(i);
      } else {
        next.add(i);
      }
      return next;
    });
  };

  const selectAll = () =>
    setSelectedPhotos(new Set(photoLinks.map((_, i) => i)));
  const deselectAll = () => setSelectedPhotos(new Set());

  const downloadZip = async () => {
    if (selectedPhotos.size === 0) return;
    setDownloading(true);
    const zip = new JSZip();
    const folder = zip.folder(`${vehicle.year}_${vehicle.make}_${vehicle.model}`) ?? zip;
    let fetched = 0;

    await Promise.all(
      Array.from(selectedPhotos).map(async (i) => {
        const url = photoLinks[i];
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const blob = await res.blob();
          const ext = url.split(".").pop()?.split("?")[0] ?? "jpg";
          folder.file(`photo_${i + 1}.${ext}`, blob);
          fetched++;
        } catch {
          console.warn(`[ZIP] Skipped ${url} — could not fetch`);
        }
      })
    );

    if (fetched === 0) {
      console.warn("[ZIP] No photos could be fetched — downloading empty zip");
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${vehicle.year}_${vehicle.make}_${vehicle.model}_photos.zip`;
    a.click();
    URL.revokeObjectURL(url);
    setDownloading(false);
  };

  const fields: [string, string][] = [
    ["Year", String(vehicle.year)],
    ["Make", vehicle.make],
    ["Model", `${vehicle.model} ${vehicle.trim}`],
    ["Price", String(vehicle.price)],
    ["Mileage", String(vehicle.miles)],
    ["Body", vehicle.body_type],
    ["Fuel", vehicle.fuel_type],
    ["Trans", vehicle.transmission],
    ["Drive", vehicle.drivetrain],
    ["Color", vehicle.exterior_color],
    ["VIN", vehicle.vin],
    ["Location", "Doral, FL 33172"],
  ];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border rounded-2xl max-w-[600px] w-full max-h-[88vh] overflow-y-auto"
      >
        <div className="px-5 py-4 border-b border-border flex justify-between items-center sticky top-0 bg-card rounded-t-2xl z-10">
          <div className="flex items-center gap-2">
            <FBIcon />
            <span className="text-sm font-bold text-foreground font-dm">
              Post to Marketplace
            </span>
            <span className="text-xs text-muted-foreground/30">
              — {vehicle.year} {vehicle.make} {vehicle.model}
            </span>
          </div>
          <button
            onClick={onClose}
            className="bg-transparent border-none text-muted-foreground cursor-pointer text-lg"
          >
            ✕
          </button>
        </div>

        <div className="p-5">
          {/* Progress bar — 4 steps */}
          <div className="flex gap-1 mb-4">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`flex-1 h-0.5 rounded-sm transition-colors ${step >= s ? "bg-[#1877F2]" : "bg-muted"}`}
              />
            ))}
          </div>

          {/* ── STEP 1: Copy Vehicle Details ── */}
          {step === 1 && (
            <>
              <div className="text-[10px] font-semibold tracking-widest text-muted-foreground mb-3">
                STEP 1 — COPY VEHICLE DETAILS
              </div>
              <div className="grid grid-cols-2 gap-1.5 mb-3">
                {fields.map(([l, v], i) => (
                  <div
                    key={i}
                    onClick={() => copy(v, l)}
                    className={`rounded-md px-3 py-2 cursor-pointer transition-all border ${
                      cp === l
                        ? "bg-green-500/10 border-green-500/25"
                        : "bg-muted/40 border-border hover:border-muted-foreground/20"
                    }`}
                  >
                    <div className="text-[9px] text-muted-foreground font-semibold">
                      {l}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-foreground font-semibold font-mono">
                        {v}
                      </span>
                      <span
                        className={`text-[9px] ${cp === l ? "text-green-500" : "text-muted-foreground/30"}`}
                      >
                        {cp === l ? "✓" : "copy"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() =>
                  copy(fields.map(([l, v]) => `${l}: ${v}`).join("\n"), "all")
                }
                className={`w-full rounded-md py-2 text-xs font-semibold cursor-pointer mb-3 border transition-all ${
                  cp === "all"
                    ? "bg-green-500/10 border-green-500/20 text-green-500"
                    : "bg-muted/40 border-border text-muted-foreground hover:border-muted-foreground/20"
                }`}
              >
                {cp === "all" ? "✓ Copied!" : "Copy All Fields"}
              </button>
              <button
                onClick={() => setStep(2)}
                className="w-full bg-[#1877F2] border-none rounded-lg py-3 text-white text-xs font-bold cursor-pointer"
              >
                Next →
              </button>
            </>
          )}

          {/* ── STEP 2: AI Listing Description ── */}
          {step === 2 && (
            <>
              <div className="text-[10px] font-semibold tracking-widest text-muted-foreground mb-3">
                STEP 2 — AI LISTING DESCRIPTION
              </div>
              <div className="bg-black/40 border border-border rounded-lg p-3 text-xs text-muted-foreground leading-7 whitespace-pre-wrap max-h-[200px] overflow-y-auto mb-3">
                {listing}
              </div>
              <button
                onClick={() => copy(listing, "desc")}
                className={`w-full rounded-md py-2 text-xs font-semibold cursor-pointer mb-3 border transition-all ${
                  cp === "desc"
                    ? "bg-green-500/10 border-green-500/20 text-green-500"
                    : "bg-muted/40 border-border text-muted-foreground hover:border-muted-foreground/20"
                }`}
              >
                {cp === "desc" ? "✓ Copied!" : "Copy Description"}
              </button>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 bg-muted/40 border border-border rounded-md py-2 text-muted-foreground text-xs font-semibold cursor-pointer"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="flex-[2] bg-[#1877F2] border-none rounded-lg py-3 text-white text-xs font-bold cursor-pointer"
                >
                  Next →
                </button>
              </div>
            </>
          )}

          {/* ── STEP 3: Vehicle Photos ── */}
          {step === 3 && (
            <>
              <div className="text-[10px] font-semibold tracking-widest text-muted-foreground mb-3">
                STEP 3 — VEHICLE PHOTOS
              </div>

              {/* Select all / count row */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted-foreground">
                  {selectedPhotos.size} of {photoLinks.length} selected
                </span>
                <div className="flex gap-1.5">
                  <button
                    onClick={selectAll}
                    className="bg-muted/40 border border-border rounded px-2.5 py-1 text-[10px] font-semibold text-muted-foreground cursor-pointer hover:border-muted-foreground/30 transition-all"
                  >
                    Select All
                  </button>
                  <button
                    onClick={deselectAll}
                    className="bg-muted/40 border border-border rounded px-2.5 py-1 text-[10px] font-semibold text-muted-foreground cursor-pointer hover:border-muted-foreground/30 transition-all"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Photo grid */}
              {photoLinks.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground/50">
                  No photos available for this vehicle.
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {photoLinks.map((url, i) => {
                    const isSelected = selectedPhotos.has(i);
                    const hasError = imgErrors.has(i);
                    return (
                      <div
                        key={i}
                        onClick={() => togglePhoto(i)}
                        className={`relative rounded-lg overflow-hidden cursor-pointer border-2 transition-all aspect-[4/3] ${
                          isSelected
                            ? "border-[#1877F2] ring-1 ring-[#1877F2]/40"
                            : "border-border opacity-50 hover:opacity-70"
                        }`}
                      >
                        {/* Image or fallback */}
                        {hasError ? (
                          <div className="w-full h-full bg-muted/60 flex flex-col items-center justify-center gap-1">
                            <svg
                              width="24"
                              height="24"
                              viewBox="0 0 24 24"
                              fill="none"
                              className="text-muted-foreground/30"
                            >
                              <path
                                d="M3 7h2l2-3h10l2 3h2a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                fill="none"
                              />
                              <circle
                                cx="12"
                                cy="13"
                                r="3"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                fill="none"
                              />
                            </svg>
                            <span className="text-[8px] text-muted-foreground/30 px-1 text-center break-all leading-3">
                              {url.split("/").pop()}
                            </span>
                          </div>
                        ) : (
                          <img
                            src={url}
                            alt={`Vehicle photo ${i + 1}`}
                            className="w-full h-full object-cover"
                            onError={() =>
                              setImgErrors((prev) => new Set(prev).add(i))
                            }
                          />
                        )}

                        {/* Checkbox overlay */}
                        <div
                          className={`absolute top-1.5 right-1.5 w-4 h-4 rounded border flex items-center justify-center transition-all ${
                            isSelected
                              ? "bg-[#1877F2] border-[#1877F2]"
                              : "bg-black/50 border-white/30"
                          }`}
                        >
                          {isSelected && (
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 10 10"
                              fill="none"
                            >
                              <path
                                d="M2 5l2.5 2.5L8 3"
                                stroke="white"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </div>

                        {/* Photo number */}
                        <div className="absolute bottom-1 left-1.5 text-[9px] text-white/60 font-mono">
                          {i + 1}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Note about placeholder URLs */}
              <div className="bg-muted/20 border border-border/50 rounded-md px-3 py-2 mb-3">
                <p className="text-[10px] text-muted-foreground/60 leading-4">
                  Photos will download from your actual MarketCheck inventory.
                  Placeholder URLs are shown here for demo purposes.
                </p>
              </div>

              {/* Download ZIP button */}
              <button
                onClick={downloadZip}
                disabled={selectedPhotos.size === 0 || downloading}
                className={`w-full rounded-md py-2.5 text-xs font-semibold cursor-pointer mb-3 border transition-all flex items-center justify-center gap-2 ${
                  downloading
                    ? "bg-muted/40 border-border text-muted-foreground/50 cursor-not-allowed"
                    : selectedPhotos.size === 0
                      ? "bg-muted/20 border-border/50 text-muted-foreground/30 cursor-not-allowed"
                      : "bg-muted/40 border-border text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground"
                }`}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="shrink-0"
                >
                  <path
                    d="M12 3v13M7 11l5 5 5-5M5 21h14"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {downloading
                  ? "Downloading..."
                  : selectedPhotos.size === 0
                    ? "Select photos to download"
                    : `Download ${selectedPhotos.size} Photo${selectedPhotos.size !== 1 ? "s" : ""} as ZIP`}
              </button>

              <div className="flex gap-1.5">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 bg-muted/40 border border-border rounded-md py-2 text-muted-foreground text-xs font-semibold cursor-pointer"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setStep(4)}
                  className="flex-[2] bg-[#1877F2] border-none rounded-lg py-3 text-white text-xs font-bold cursor-pointer"
                >
                  Next →
                </button>
              </div>
            </>
          )}

          {/* ── STEP 4: Ready to Post ── */}
          {step === 4 && (
            <>
              <div className="text-center py-4">
                <div className="text-4xl mb-2">🚀</div>
                <div className="text-base font-bold text-foreground mb-1">
                  Ready to Post
                </div>
                <div className="text-xs text-muted-foreground max-w-[380px] mx-auto leading-5">
                  {extensionSent
                    ? "Sent to your Chrome extension! Click the extension icon and hit \"Open FB Marketplace & Auto-Fill\" — all fields will be filled automatically."
                    : "Click below to send this listing to your Chrome extension for auto-fill, or open FB Marketplace manually."}
                </div>
              </div>
              <button
                onClick={async () => {
                  try {
                    await fetch('/api/extension/posting-session', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        vehicleId: vehicle.id ? Number(String(vehicle.id).split('-')[0]) || 1 : 1,
                        postText: listing,
                        vehicleData: {
                          year: vehicle.year,
                          make: vehicle.make,
                          model: vehicle.model,
                          trim: vehicle.trim,
                          price: vehicle.price,
                          mileage: vehicle.miles,
                          miles: vehicle.miles,
                          color: vehicle.exterior_color,
                          exterior_color: vehicle.exterior_color,
                          interior_color: vehicle.interior_color,
                          city: 'Doral',
                          state: 'FL',
                          vin: vehicle.vin,
                          condition: 'Good',
                          body_type: vehicle.body_type,
                          fuel_type: vehicle.fuel_type,
                          transmission: vehicle.transmission,
                          drivetrain: vehicle.drivetrain,
                        },
                      }),
                    });
                    setExtensionSent(true);
                    toast.success('Sent to Chrome Extension! Click the extension icon to auto-fill.');
                  } catch {
                    toast.error('Could not send to extension. Try opening FB Marketplace manually.');
                  }
                }}
                disabled={extensionSent}
                className={`flex items-center justify-center gap-2 w-full border-none rounded-lg py-3 text-sm font-bold cursor-pointer no-underline mb-2 transition-all ${
                  extensionSent
                    ? "bg-green-600 text-white"
                    : "bg-[#1877F2] text-white hover:bg-[#166fe5]"
                }`}
              >
                {extensionSent ? (
                  <>✓ Sent to Extension</>
                ) : (
                  <><FBIcon /> Send to Extension & Auto-Fill</>
                )}
              </button>
              <a
                href="https://www.facebook.com/marketplace/create/vehicle"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-muted/40 border border-border rounded-lg py-2.5 text-muted-foreground text-xs font-semibold cursor-pointer no-underline mb-3 hover:text-foreground transition-colors"
              >
                Or open FB Marketplace manually
              </a>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 bg-muted/40 border border-border rounded-md py-2 text-muted-foreground text-xs font-semibold cursor-pointer"
                >
                  ← Back
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 bg-muted/40 border border-border rounded-md py-2 text-muted-foreground text-xs font-semibold cursor-pointer"
                >
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function VehicleCard({
  v,
  expanded,
  onToggle,
  onPost,
  isSold: initialSold,
}: {
  v: ScoredVehicle;
  expanded: boolean;
  onToggle: () => void;
  onPost: (v: ScoredVehicle) => void;
  isSold: boolean;
}) {
  const [sold, setSold] = useState(initialSold);
  const [soldLoading, setSoldLoading] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (initialSold) setSold(true);
  }, [initialSold]);

  async function handleMarkSold(e: React.MouseEvent) {
    e.stopPropagation();
    setSoldLoading(true);
    try {
      const bodyMap: Record<string, string> = {
        sedan: "Sedan", suv: "SUV", truck: "Truck", coupe: "Coupe",
        van: "Van", minivan: "Van", convertible: "Convertible", pickup: "Truck",
        wagon: "Sedan", hatchback: "Sedan", crossover: "SUV",
      };
      const rawBody = (v.body_type || "").toLowerCase();
      const bodyType = bodyMap[rawBody] ?? "SUV";

      await api.patch('/api/vehicles/mark-sold', {
        vin: v.vin || `VIN-${v.id}`,
        year: v.year || new Date().getFullYear(),
        make: v.make || "Unknown",
        model: v.model || "Unknown",
        trim: v.trim || "Base",
        price: v.price || 0,
        mileage: v.miles || 0,
        color: v.exterior_color || "Unknown",
        bodyType,
        photoUrl: v.media?.photo_links?.[0] || null,
      });
      setSold(true);
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success(`${v.year} ${v.make} ${v.model} marked as sold!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to mark as sold.");
    } finally {
      setSoldLoading(false);
    }
  }
  const tierColor =
    v.tier === "hot"
      ? "text-green-500"
      : v.tier === "decent"
        ? "text-amber-400"
        : "text-red-500";
  const tierBg =
    v.tier === "hot"
      ? "bg-green-500/20"
      : v.tier === "decent"
        ? "bg-amber-400/20"
        : "bg-red-500/20";
  const tierLabel =
    v.tier === "hot" ? "HOT DEAL" : v.tier === "decent" ? "DECENT" : "SKIP";
  const scoreColor =
    v.tier === "hot"
      ? "#00C853"
      : v.tier === "decent"
        ? "#FFB300"
        : "#E53935";

  return (
    <div
      onClick={onToggle}
      className={`rounded-xl p-4 cursor-pointer transition-all border ${
        expanded
          ? "bg-muted/50 border-border"
          : "bg-muted/20 border-transparent hover:border-border"
      }`}
    >
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-bold text-foreground font-dm">
              {v.year} {v.make} {v.model}
            </span>
            <span
              className={`${tierBg} ${tierColor} px-2 py-0.5 rounded text-[10px] font-bold tracking-wide`}
            >
              {tierLabel}
            </span>
            {v.is_certified && (
              <span className="bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded text-[9px] font-bold">
                CPO
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {v.trim} · {v.exterior_color}
          </div>
        </div>

        <div className="flex gap-5 items-center flex-wrap">
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground/50 mb-0.5">Asking Price</div>
            <div className="text-base font-bold text-foreground font-mono">
              {v.price > 0 ? `$${v.price.toLocaleString()}` : <span className="text-muted-foreground text-sm">Call for Price</span>}
            </div>
            {v.price_estimated && (
              <div className="text-[9px] text-amber-400/80 font-semibold">~mkt avg estimate</div>
            )}
            {v.price > 0 && !v.price_estimated && v.price_diff !== 0 && (
              <div
                className={`text-xs font-semibold font-mono ${
                  v.price_diff > 0
                    ? "text-green-500"
                    : v.price_diff < -500
                      ? "text-red-400"
                      : "text-amber-400"
                }`}
              >
                {v.price_diff > 0 ? "▼" : "▲"} $
                {Math.abs(v.price_diff).toLocaleString()} vs mkt
              </div>
            )}
          </div>
          <div className="text-center min-w-[60px]">
            <div className="text-[10px] text-muted-foreground/50">Miles</div>
            <div className="text-sm font-semibold text-foreground font-mono">
              {v.miles.toLocaleString()}
            </div>
          </div>
          <div className="text-center min-w-[50px]">
            <div className="text-[10px] text-muted-foreground/50">Score</div>
            <div className="flex items-center gap-1.5">
              <div className="w-[60px] h-1 rounded-sm bg-muted overflow-hidden">
                <div
                  className="h-full rounded-sm"
                  style={{ width: `${v.score}%`, background: scoreColor }}
                />
              </div>
              <span
                className="text-xs font-bold font-mono"
                style={{ color: scoreColor }}
              >
                {v.score}
              </span>
            </div>
          </div>
          <button
            onClick={handleMarkSold}
            disabled={sold || soldLoading}
            className={`shrink-0 px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-colors ${
              sold
                ? "bg-green-500/10 border-green-500/30 text-green-400 cursor-default"
                : "bg-transparent border-border text-muted-foreground hover:border-green-500/50 hover:text-green-400 hover:bg-green-500/5"
            }`}
          >
            {sold ? "✓ Sold" : soldLoading ? "..." : "Mark Sold"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-border">
          <div
            className="rounded-lg p-3 mb-3 border-l-[3px]"
            style={{
              background: "rgba(0,0,0,0.3)",
              borderLeftColor: scoreColor,
            }}
          >
            <div
              className="text-[10px] font-bold tracking-wide mb-1"
              style={{ color: scoreColor }}
            >
              {v.rec}
            </div>
            <div className="text-xs text-muted-foreground leading-5">
              {v.reason}
            </div>
          </div>

          {v.tier !== "skip" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPost(v);
              }}
              className="w-full bg-[#1877F2] border-none rounded-lg py-3 text-white text-xs font-bold cursor-pointer flex items-center justify-center gap-2 mb-3"
            >
              <FBIcon /> Post to Facebook Marketplace
            </button>
          )}

          {v.market && (
            <>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-2 mb-3">
                {(
                  [
                    ["Market Avg", `$${v.market.price.mean.toLocaleString()}`],
                    [
                      "Range",
                      `$${v.market.price.min.toLocaleString()}-${v.market.price.max.toLocaleString()}`,
                    ],
                    ["Avg Miles", v.market.miles.mean.toLocaleString()],
                    ["Supply", `${v.market.total} in 100mi`],
                    ["Your LOT", `${v.dom_active}d`],
                    [
                      "Mile Diff",
                      v.mile_diff > 0
                        ? `${v.mile_diff.toLocaleString()} fewer`
                        : `${Math.abs(v.mile_diff).toLocaleString()} more`,
                    ],
                  ] as const
                ).map(([l, val], i) => (
                  <div key={i} className="bg-muted/30 rounded-md px-3 py-2">
                    <div className="text-[9px] text-muted-foreground font-semibold">
                      {l}
                    </div>
                    <div className="text-xs text-foreground font-semibold font-mono">
                      {val}
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-[10px] font-bold tracking-wide text-muted-foreground mb-1.5">
                NEAREST COMPETITORS
              </div>
              {v.market.competitors.map((c, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center bg-muted/20 rounded-md px-3 py-1.5 text-xs mb-1 flex-wrap gap-1.5"
                >
                  <span className="text-muted-foreground flex-1 min-w-[140px]">
                    {c.dealer?.name || "Unknown"}
                  </span>
                  <span className="text-foreground font-semibold font-mono">
                    ${c.price.toLocaleString()}
                  </span>
                  <span className="text-muted-foreground/50 font-mono">
                    {c.miles.toLocaleString()} mi
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT — 3 STATES: CONNECT → SCANNING → DASHBOARD
// ═══════════════════════════════════════════════════════════════

interface ConnectInventoryProps {
  onConnected?: (view: ActiveView) => void;
  showDashboard?: boolean;
}

export function ConnectInventory({ onConnected, showDashboard = true }: ConnectInventoryProps) {
  const { connectDealer: saveToContext, isConnected, dealer: connectedDealer, inventory: savedInventory, disconnect } = useDealership();

  const [phase, setPhase] = useState<"connect" | "scanning" | "dashboard">(
    isConnected && showDashboard ? "dashboard" : "connect"
  );
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(
    connectedDealer ? {
      dealer_id: connectedDealer.dealer_id,
      name: connectedDealer.name,
      city: connectedDealer.city,
      state: connectedDealer.state,
      zip: connectedDealer.zip,
      street: connectedDealer.street,
      phone: connectedDealer.phone,
      website: connectedDealer.website,
      latitude: connectedDealer.latitude,
      longitude: connectedDealer.longitude,
      inventory_count: connectedDealer.inventory_count,
      dealer_type: connectedDealer.dealer_type,
      franchise_dealer: connectedDealer.franchise_dealer,
    } : null
  );
  const [scanProgress, setScanProgress] = useState<ScanProgress>({
    step: "",
    pct: 0,
    detail: "",
  });
  const [inventory, setInventory] = useState<ScoredVehicle[]>(
    savedInventory as ScoredVehicle[]
  );
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "hot" | "decent" | "skip">(
    "all"
  );
  const [modal, setModal] = useState<ScoredVehicle | null>(null);
  const [soldVins, setSoldVins] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.get<Array<{ vin: string; status: string }>>("/api/vehicles").then((vehicles) => {
      const vins = new Set(
        vehicles.filter((v) => v.status === "Sold").map((v) => v.vin)
      );
      setSoldVins(vins);
    }).catch(() => {});
  }, []);

  const connectDealerHandler = useCallback(async (dealer: Dealer) => {
    try {
    setSelectedDealer(dealer);
    setPhase("scanning");

    // Step 1: Pull inventory
    setScanProgress({
      step: "Connecting to MarketCheck API...",
      pct: 5,
      detail: `Pulling inventory for ${dealer.name}`,
    });
    await delay(600);
    setScanProgress({
      step: "Fetching dealer inventory",
      pct: 15,
      detail: `GET /v2/dealerships/inventory?source=${dealer.website}`,
    });
    const inv = await API.getDealerInventory(dealer.website);
    setScanProgress({
      step: `Found ${inv.listings.length} vehicles`,
      pct: 30,
      detail: "Starting competitive market scan...",
    });
    await delay(400);

    // Step 2: Scan market for each vehicle
    const scored: ScoredVehicle[] = [];
    let quotaExhausted = false;
    for (let i = 0; i < inv.listings.length; i++) {
      const v = inv.listings[i];
      const pct = 30 + Math.round((i / inv.listings.length) * 60);
      setScanProgress({
        step: `Scanning market for ${v.year} ${v.make} ${v.model}`,
        pct,
        detail: `GET /v2/search/car/active?year=${v.year}&make=${v.make}&model=${v.model}&radius=100`,
      });
      let comps: { num_found: number; stats: MarketStats; listings: MarketData["competitors"] } | null = null;
      if (!quotaExhausted) {
        try {
          comps = await API.getMarketComps(v, dealer.latitude, dealer.longitude);
        } catch (compsErr) {
          if (compsErr instanceof Error && compsErr.message === "quota_exhausted") {
            quotaExhausted = true;
            // Show toast once and continue scoring without comps
            toast.warning("MarketCheck API quota exhausted — market data unavailable. Inventory loaded without competitor analysis.");
          }
          // Any other error: leave comps as null and continue
        }
      }
      scored.push(scoreVehicle(v, comps));
    }

    // Step 3: Sort and finalize
    setScanProgress({
      step: "Calculating competitive scores...",
      pct: 95,
      detail: "Ranking inventory by market position",
    });
    await delay(500);
    scored.sort((a, b) => b.score - a.score);
    setInventory(scored);

    // Save to context for use in other views
    saveToContext(dealer, scored as DealershipVehicle[]);

    setScanProgress({
      step: "Scan complete!",
      pct: 100,
      detail: `${scored.length} vehicles analyzed`,
    });
    await delay(600);

    // If callback provided, navigate to dashboard
    if (onConnected) {
      onConnected('dashboard');
    } else {
      setPhase("dashboard");
    }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message === "marketcheck_not_configured") {
        toast.error("Add your MarketCheck API key in the ENV tab to connect your dealership.");
      } else {
        toast.error(message || "Failed to connect dealership.");
      }
      setPhase("connect");
    }
  }, [saveToContext, onConnected]);

  const handleConnect = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const dealer = await API.lookupDealer(query.trim());
      setSearching(false);
      await connectDealerHandler(dealer);
    } catch (err) {
      setSearching(false);
      const message = err instanceof Error ? err.message : String(err);
      if (message === "marketcheck_not_configured") {
        toast.error("Add your MarketCheck API key in the ENV tab to connect your dealership.");
      } else {
        toast.error(message || "Dealership not found. Check the website domain and try again.");
      }
    }
  }, [query, connectDealerHandler]);

  const filtered =
    filter === "all" ? inventory : inventory.filter((v) => v.tier === filter);
  const hot = inventory.filter((v) => v.tier === "hot").length;
  const decent = inventory.filter((v) => v.tier === "decent").length;
  const skip = inventory.filter((v) => v.tier === "skip").length;

  return (
    <div className="min-h-full">
      {/* ══════════════════════════════════════ */}
      {/* PHASE: CONNECT DEALERSHIP             */}
      {/* ══════════════════════════════════════ */}
      {phase === "connect" && (
        <div className="animate-fadeIn">
          <div className="text-center mb-10 mt-10">
            <h1 className="font-bebas text-3xl tracking-wider text-foreground mb-2">
              CONNECT YOUR DEALERSHIP
            </h1>
            <p className="text-sm text-muted-foreground max-w-[480px] mx-auto leading-6">
              Enter your dealership's website domain to pull your live inventory from a database of 45,000+ US dealerships.
            </p>
          </div>

          <div className="max-w-[520px] mx-auto">
            <div className="flex gap-2 mb-5">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                placeholder="e.g. doralacura.com"
                className="flex-1 bg-input border border-border rounded-lg px-4 py-3 text-foreground text-sm font-dm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={handleConnect}
                disabled={searching || !query.trim()}
                className="bg-primary border-none rounded-lg px-6 py-3 text-primary-foreground text-sm font-bold cursor-pointer disabled:opacity-50 font-dm"
              >
                {searching ? "Connecting..." : "Connect"}
              </button>
            </div>

            <div className="mt-8 bg-card border border-border rounded-xl p-5">
              <div className="text-xs font-bold text-muted-foreground mb-3">
                How it works
              </div>
              <div className="flex flex-col gap-3">
                {[
                  [
                    "1",
                    "Enter Website",
                    "Type your dealership domain (e.g. doralacura.com) — no name search needed",
                  ],
                  [
                    "2",
                    "Scan",
                    "We pull your full inventory and scan 100+ competing listings per vehicle",
                  ],
                  [
                    "3",
                    "Score",
                    "AI ranks every car by competitive position: Hot Deal, Decent, or Skip",
                  ],
                  [
                    "4",
                    "Post",
                    "One-click flow to post your best deals to Facebook Marketplace",
                  ],
                ].map(([n, t, desc]) => (
                  <div key={n} className="flex gap-3 items-start">
                    <div className="w-6 h-6 rounded-md bg-primary/15 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                      {n}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-foreground">{t}</div>
                      <div className="text-xs text-muted-foreground leading-5">
                        {desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ══════════════════════════════════════ */}
      {/* PHASE: SCANNING                       */}
      {/* ══════════════════════════════════════ */}
      {phase === "scanning" && (
        <div className="animate-fadeIn max-w-[520px] mx-auto mt-16 text-center">
          <div className="text-5xl mb-4">🔍</div>
          <h2 className="font-bebas text-2xl tracking-wider text-foreground mb-1">
            SCANNING MARKET
          </h2>
          <p className="text-sm text-muted-foreground mb-8">
            {selectedDealer?.name} · {selectedDealer?.city},{" "}
            {selectedDealer?.state}
          </p>

          <div className="w-full h-1 rounded bg-muted overflow-hidden mb-4">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/70 rounded transition-all duration-300"
              style={{ width: `${scanProgress.pct}%` }}
            />
          </div>

          <div className="text-sm font-bold text-foreground mb-1">
            {scanProgress.step}
          </div>
          <div className="text-xs text-muted-foreground font-mono break-all">
            {scanProgress.detail}
          </div>

          <div className="mt-10 p-4 bg-card border border-border rounded-lg text-left">
            <div className="text-[10px] font-semibold tracking-widest text-muted-foreground mb-2">
              API CALLS BEING MADE
            </div>
            <div className="text-[10px] text-muted-foreground/40 font-mono leading-7">
              <div
                className={
                  scanProgress.pct >= 15
                    ? "text-green-500"
                    : "text-muted-foreground/30"
                }
              >
                ✓ GET /v2/dealerships/inventory?source={selectedDealer?.website}
              </div>
              <div
                className={
                  scanProgress.pct >= 40
                    ? "text-green-500"
                    : "text-muted-foreground/30"
                }
              >
                ⟳ GET /v2/search/car/active?year=*&make=*&model=*&radius=100
              </div>
              <div
                className={
                  scanProgress.pct >= 90
                    ? "text-green-500"
                    : "text-muted-foreground/30"
                }
              >
                ⟳ Competitive scoring algorithm
              </div>
              <div
                className={
                  scanProgress.pct >= 95
                    ? "text-green-500"
                    : "text-muted-foreground/30"
                }
              >
                ⟳ AI listing generation
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════ */}
      {/* PHASE: DASHBOARD                      */}
      {/* ══════════════════════════════════════ */}
      {phase === "dashboard" && (
        <div className="animate-fadeIn">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="font-bebas text-2xl tracking-wider text-foreground">
                INVENTORY INTELLIGENCE
              </h1>
              <p className="text-xs text-muted-foreground">
                {selectedDealer?.name} · {selectedDealer?.city},{" "}
                {selectedDealer?.state}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (connectedDealer) connectDealerHandler(connectedDealer as Dealer);
                }}
                className="bg-muted/40 border border-border rounded-md px-4 py-2 text-muted-foreground text-xs font-semibold cursor-pointer hover:border-primary hover:text-foreground transition-all"
              >
                Refresh Inventory
              </button>
              <button
                onClick={() => {
                  setPhase("connect");
                  setQuery("");
                  setInventory([]);
                  setSelectedDealer(null);
                  disconnect();
                }}
                className="bg-muted/40 border border-border rounded-md px-4 py-2 text-muted-foreground text-xs font-semibold cursor-pointer hover:border-primary hover:text-foreground transition-all"
              >
                Switch Dealership
              </button>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5 mb-5">
            {[
              {
                l: "POST NOW",
                v: hot,
                c: "text-green-500",
                bg: "bg-green-500/7",
                border: "border-green-500/20",
              },
              {
                l: "WORTH POSTING",
                v: decent,
                c: "text-amber-400",
                bg: "bg-amber-400/7",
                border: "border-amber-400/20",
              },
              {
                l: "SKIP",
                v: skip,
                c: "text-red-500",
                bg: "bg-red-500/7",
                border: "border-red-500/20",
              },
              {
                l: "MARKET SCANNED",
                v: inventory.reduce((a, v) => a + (v.market?.total ?? 0), 0),
                c: "text-blue-400",
                bg: "bg-blue-400/6",
                border: "border-blue-400/20",
              },
            ].map((s, i) => (
              <div
                key={i}
                className={`${s.bg} border ${s.border} rounded-lg px-4 py-3`}
              >
                <div className={`text-[9px] font-bold tracking-widest ${s.c}`}>
                  {s.l}
                </div>
                <div className="text-2xl font-extrabold text-foreground font-mono leading-tight">
                  {s.v}
                </div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex gap-1.5 mb-4 flex-wrap items-center">
            {(
              [
                ["all", `All (${inventory.length})`],
                ["hot", `🟢 Hot (${hot})`],
                ["decent", `🟡 Decent (${decent})`],
                ["skip", `🔴 Skip (${skip})`],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold cursor-pointer border transition-all ${
                  filter === k
                    ? "bg-muted border-border text-foreground"
                    : "bg-muted/30 border-transparent text-muted-foreground hover:border-border"
                }`}
              >
                {l}
              </button>
            ))}
            <div className="ml-auto text-[10px] text-muted-foreground/40">
              Data: MarketCheck API · Updated daily
            </div>
          </div>

          {/* Vehicle list */}
          <div className="flex flex-col gap-1.5">
            {filtered.map((v) => (
              <VehicleCard
                key={v.id}
                v={v}
                expanded={expanded === v.id}
                onToggle={() => setExpanded(expanded === v.id ? null : v.id)}
                onPost={setModal}
                isSold={soldVins.has(v.vin || "")}
              />
            ))}
          </div>

          <div className="mt-5 pt-3 border-t border-border text-center">
            <p className="text-[10px] text-muted-foreground/30 font-mono">
              305CarDeals v1.0 · MarketCheck API Integration ·{" "}
              {selectedDealer?.name}
            </p>
          </div>
        </div>
      )}

      {modal && <PostModal vehicle={modal} onClose={() => setModal(null)} />}
    </div>
  );
}

export default ConnectInventory;
