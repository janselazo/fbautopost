import { useState, useEffect, useRef } from 'react';
import { Radar, Loader2, TrendingDown, TrendingUp, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { getBackendUrl } from '@/lib/backend-url';
import type { Vehicle } from './types';
import { useDealer } from '../../context/DealerContext';

// ---- Types ----

interface MarketResult {
  id: number;
  label: 'HOT DEAL' | 'WORTH POSTING' | 'SKIP / REPRICE';
  sellabilityScore: number;
  marketAvgPrice: number;
  priceRange: { low: number; high: number };
  avgMarketMiles: number;
  priceVsMarket: number; // negative = below market (good)
  mileageVsMarket: number; // negative = fewer miles than avg (good)
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

// Cache: key = `${vehicleId}-${radiusMiles}`, value = MarketResult
const analysisCache = new Map<string, MarketResult>();

interface MarketScannerProps {
  vehicles: Vehicle[];
  compact?: boolean;
  onViewFull?: () => void;
}

type FilterTab = 'all' | 'hot' | 'decent' | 'skip';

// ---- Constants ----

const RADIUS_OPTIONS: { label: string; value: number }[] = [
  { label: '50 miles', value: 50 },
  { label: '100 miles', value: 100 },
  { label: '250 miles', value: 250 },
  { label: '500 miles', value: 500 },
  { label: '750 miles', value: 750 },
];

// ---- Helpers ----

function fmt(n: number): string {
  return n.toLocaleString();
}

function fmtPrice(n: number): string {
  return '$' + n.toLocaleString();
}

function labelBadgeClass(label: MarketResult['label']): string {
  if (label === 'HOT DEAL') return 'bg-green-500 text-white';
  if (label === 'WORTH POSTING') return 'bg-yellow-500 text-black';
  return 'bg-red-500 text-white';
}

function labelAccentBorderClass(label: MarketResult['label']): string {
  if (label === 'HOT DEAL') return 'border-l-green-500';
  if (label === 'WORTH POSTING') return 'border-l-yellow-500';
  return 'border-l-red-500';
}

function labelRecommendTextClass(label: MarketResult['label']): string {
  if (label === 'HOT DEAL') return 'text-green-400';
  if (label === 'WORTH POSTING') return 'text-yellow-500';
  return 'text-red-400';
}

function scoreColor(score: number): string {
  if (score > 70) return '#22c55e';
  if (score >= 40) return '#eab308';
  return '#ef4444';
}

function scoreTextClass(score: number): string {
  if (score > 70) return 'text-green-400';
  if (score >= 40) return 'text-yellow-500';
  return 'text-red-400';
}

function supplyClass(level: 'LOW' | 'MODERATE' | 'HIGH'): string {
  if (level === 'LOW') return 'text-green-400';
  if (level === 'MODERATE') return 'text-yellow-500';
  return 'text-red-400';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: 'numeric' });
}

// ---- Score Bar ----

function ScoreBar({ score, width = 'w-20' }: { score: number; width?: string }) {
  const color = scoreColor(score);
  return (
    <div className={cn(width, 'h-1.5 bg-secondary rounded-full overflow-hidden')}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${score}%`, backgroundColor: color }}
      />
    </div>
  );
}

// ---- Label Badge ----

function LabelBadge({ label }: { label: MarketResult['label'] }) {
  return (
    <span
      className={cn(
        'inline-flex items-center text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wide',
        labelBadgeClass(label)
      )}
    >
      {label}
    </span>
  );
}

// ---- Stat Tile ----

function StatTile({
  labelText,
  labelClass,
  count,
  sub,
}: {
  labelText: string;
  labelClass: string;
  count: number | string;
  sub: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-1">
      <div className={cn('text-xs font-bold uppercase tracking-widest leading-none', labelClass)}>
        {labelText}
      </div>
      <div className="text-3xl font-bold text-foreground leading-tight">
        {count}
      </div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

// ---- Skeleton Tile ----

function SkeletonTile() {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-2 animate-pulse">
      <div className="h-3 bg-secondary rounded w-20" />
      <div className="h-8 bg-secondary rounded w-12" />
      <div className="h-3 bg-secondary rounded w-28" />
    </div>
  );
}

// ---- Skeleton Card ----

function SkeletonCard() {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden flex flex-col animate-pulse">
      <div className="p-5 flex items-start gap-3">
        <div className="flex-1 flex flex-col gap-2">
          <div className="h-5 bg-secondary rounded w-48" />
          <div className="h-3 bg-secondary rounded w-32" />
        </div>
        <div className="shrink-0 flex flex-col gap-1 items-end">
          <div className="h-5 bg-secondary rounded w-20" />
          <div className="h-3 bg-secondary rounded w-24" />
        </div>
        <div className="shrink-0 flex flex-col gap-1 ml-6 items-end">
          <div className="h-3 bg-secondary rounded w-10" />
          <div className="h-4 bg-secondary rounded w-14" />
          <div className="h-3 bg-secondary rounded w-10 mt-1" />
          <div className="h-3 bg-secondary rounded w-24" />
        </div>
      </div>
      <hr className="border-border mx-4" />
      <div className="mx-4 my-3 pl-3 border-l-4 border-secondary py-2 flex flex-col gap-2">
        <div className="h-3 bg-secondary rounded w-40" />
        <div className="h-3 bg-secondary rounded w-full" />
        <div className="h-3 bg-secondary rounded w-5/6" />
      </div>
      <div className="mx-4 mb-3 h-10 bg-secondary rounded" />
      <div className="p-4 bg-secondary/20">
        <div className="grid grid-cols-5 gap-2 mb-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-secondary/60 rounded p-3 h-14" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-secondary/60 rounded p-3 h-14" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- Skeleton Compact Card ----

function SkeletonCompactCard() {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-2 animate-pulse">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 flex flex-col gap-2">
          <div className="h-5 bg-secondary rounded w-40" />
          <div className="h-4 bg-secondary rounded w-20" />
        </div>
        <div className="flex flex-col gap-1 items-end">
          <div className="h-5 bg-secondary rounded w-16" />
          <div className="h-3 bg-secondary rounded w-20" />
        </div>
      </div>
      <div className="h-1.5 bg-secondary rounded-full w-full" />
      <div className="h-3 bg-secondary rounded w-full" />
      <div className="h-3 bg-secondary rounded w-4/5" />
    </div>
  );
}

// ---- Filter Tab Button ----

function TabButton({
  active,
  onClick,
  dot,
  label,
}: {
  active: boolean;
  onClick: () => void;
  dot?: 'green' | 'yellow' | 'red';
  label: string;
}) {
  const dotColorMap = {
    green: '#22c55e',
    yellow: '#eab308',
    red: '#ef4444',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
        active
          ? 'bg-card border border-border text-foreground'
          : 'text-muted-foreground bg-transparent hover:text-foreground'
      )}
    >
      {dot ? (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: dotColorMap[dot] }}
        />
      ) : null}
      {label}
    </button>
  );
}

// ---- Full Vehicle Card ----

function VehicleCard({
  result,
  vehicle,
  radiusMiles,
}: {
  result: MarketResult;
  vehicle: Vehicle | undefined;
  radiusMiles: number;
}) {
  const vehicleName = vehicle
    ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
    : `Vehicle #${result.id}`;
  const trimLine = vehicle
    ? [vehicle.trim, vehicle.color, vehicle.condition].filter(Boolean).join(' · ')
    : '';
  const vin = vehicle?.vin ?? '';
  const price = vehicle?.price ?? result.marketAvgPrice;
  const miles = vehicle?.mileage ?? result.avgMarketMiles;

  const priceVsMarket = result.priceVsMarket;
  const priceAbove = priceVsMarket > 0;
  const priceDiff = Math.abs(priceVsMarket);

  const mileageVsMarket = result.mileageVsMarket;
  const milesAbove = mileageVsMarket > 0;
  const milesDiff = Math.abs(mileageVsMarket);

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden flex flex-col">

      {/* Section 1: Header */}
      <div className="p-5">
        <div className="flex items-start gap-3">

          {/* Left col: vehicle info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xl font-bold text-foreground leading-tight">
                {vehicleName}
              </span>
              <LabelBadge label={result.label} />
            </div>
            {trimLine ? (
              <div className="text-xs text-muted-foreground mt-1">{trimLine}</div>
            ) : null}
            {vin ? (
              <div className="font-mono text-xs text-muted-foreground/50 mt-0.5 tracking-wider">
                VIN: {vin}
              </div>
            ) : null}
          </div>

          {/* Center col: price */}
          <div className="shrink-0 text-right">
            <div className="text-xl font-bold text-foreground leading-tight">
              {fmtPrice(price)}
            </div>
            {priceDiff > 0 ? (
              <div
                className={cn(
                  'flex items-center justify-end gap-0.5 text-xs font-medium mt-0.5',
                  priceAbove ? 'text-red-400' : 'text-green-400'
                )}
              >
                {priceAbove ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {priceAbove ? '+' : '-'}{fmtPrice(priceDiff)} vs mkt
              </div>
            ) : null}
          </div>

          {/* Right col: miles + score */}
          <div className="shrink-0 ml-6 flex flex-col items-end">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide leading-none">
              Miles
            </div>
            <div className="text-sm font-semibold text-foreground mt-0.5">
              {fmt(miles)}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide leading-none mt-2">
              Score
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <ScoreBar score={result.sellabilityScore} width="w-20" />
              <span className={cn('text-sm font-bold', scoreTextClass(result.sellabilityScore))}>
                {result.sellabilityScore}
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* Separator */}
      <hr className="border-border mx-4" />

      {/* Section 2: AI Recommendation */}
      <div className="mx-4 my-3">
        <div
          className={cn(
            'border-l-4 pl-3 py-2',
            labelAccentBorderClass(result.label)
          )}
        >
          <div
            className={cn(
              'text-[11px] font-bold uppercase tracking-wide',
              labelRecommendTextClass(result.label)
            )}
          >
            AI RECOMMENDATION: {result.recommendedAction}
          </div>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            {result.insight}
          </p>
        </div>
      </div>

      {/* Section 3: Facebook Button */}
      <div className="mx-4 mb-3">
        <button
          type="button"
          onClick={() => {}}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-md py-3 font-medium flex items-center justify-center gap-2 transition-colors text-sm"
        >
          <Share2 className="w-4 h-4" />
          Post to Facebook Marketplace
        </button>
      </div>

      {/* Section 4: Data Grid */}
      <div className="p-4 bg-secondary/20">
        {/* Row 1: 5 cells */}
        <div className="grid grid-cols-5 gap-2 mb-2">
          <div className="bg-secondary/60 rounded p-3 col-span-1">
            <div className="text-[10px] text-muted-foreground/70 uppercase tracking-wide leading-none mb-1">
              Market Avg
            </div>
            <div className="text-sm font-semibold text-foreground">
              {fmtPrice(result.marketAvgPrice)}
            </div>
          </div>
          <div className="bg-secondary/60 rounded p-3 col-span-1">
            <div className="text-[10px] text-muted-foreground/70 uppercase tracking-wide leading-none mb-1">
              Range
            </div>
            <div className="text-sm font-semibold text-foreground leading-snug">
              {fmtPrice(result.priceRange.low)} –<br />{fmtPrice(result.priceRange.high)}
            </div>
          </div>
          <div className="bg-secondary/60 rounded p-3 col-span-1">
            <div className="text-[10px] text-muted-foreground/70 uppercase tracking-wide leading-none mb-1">
              Avg Miles
            </div>
            <div className="text-sm font-semibold text-foreground">
              {fmt(result.avgMarketMiles)}
            </div>
          </div>
          <div className="bg-secondary/60 rounded p-3 col-span-1">
            <div className="text-[10px] text-muted-foreground/70 uppercase tracking-wide leading-none mb-1">
              Competing
            </div>
            <div className="text-sm font-semibold text-foreground">
              {result.estimatedCompetitors} in {radiusMiles}mi
            </div>
          </div>
          <div className="bg-secondary/60 rounded p-3 col-span-1">
            <div className="text-[10px] text-muted-foreground/70 uppercase tracking-wide leading-none mb-1">
              Supply
            </div>
            <div className={cn('text-sm font-semibold', supplyClass(result.supplyLevel))}>
              {result.supplyLevel}
            </div>
          </div>
        </div>
        {/* Row 2: 3 cells */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-secondary/60 rounded p-3">
            <div className="text-[10px] text-muted-foreground/70 uppercase tracking-wide leading-none mb-1">
              Mkt DOM
            </div>
            <div className="text-sm font-semibold text-foreground">
              {result.marketDaysOnLot}d
            </div>
          </div>
          <div className="bg-secondary/60 rounded p-3">
            <div className="text-[10px] text-muted-foreground/70 uppercase tracking-wide leading-none mb-1">
              Your LOT
            </div>
            <div className="text-sm font-semibold text-foreground">
              {result.dealerDaysOnLot}d
            </div>
          </div>
          <div className="bg-secondary/60 rounded p-3">
            <div className="text-[10px] text-muted-foreground/70 uppercase tracking-wide leading-none mb-1">
              Mile Adv
            </div>
            <div className={cn('text-sm font-semibold', milesAbove ? 'text-red-400' : 'text-green-400')}>
              {fmt(milesDiff)} {milesAbove ? 'more' : 'fewer'}
            </div>
          </div>
        </div>
      </div>

      {/* Section 5: Nearest Competitors */}
      {result.nearestCompetitors.filter(c => c.price > 0).length > 0 ? (
        <div className="px-4 pb-4 pt-3">
          <div className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest mb-3">
            NEAREST COMPETITORS
          </div>
          <hr className="border-border mb-3" />
          <div className="flex flex-col">
            {result.nearestCompetitors.filter(c => c.price > 0).slice(0, 3).map((comp, idx, arr) => (
              <div
                key={idx}
                className={cn(
                  'flex justify-between items-center py-2 border-b border-border/50',
                  idx === arr.length - 1 ? 'border-0' : ''
                )}
              >
                <span className="text-sm text-foreground/80">{comp.name}</span>
                <span className="text-xs text-muted-foreground">
                  {fmtPrice(comp.price)}&nbsp;&nbsp;{fmt(comp.miles)} mi&nbsp;&nbsp;{comp.distance}mi
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---- Compact Vehicle Card ----

function CompactVehicleCard({
  result,
  vehicle,
}: {
  result: MarketResult;
  vehicle: Vehicle | undefined;
}) {
  const vehicleName = vehicle
    ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
    : `Vehicle #${result.id}`;
  const price = vehicle?.price ?? result.marketAvgPrice;
  const priceDiff = Math.abs(result.priceVsMarket);
  const priceAbove = result.priceVsMarket > 0;

  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-base font-bold text-foreground leading-tight truncate">
            {vehicleName}
          </div>
          <div className="mt-1">
            <LabelBadge label={result.label} />
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-lg font-bold text-foreground leading-tight">
            {fmtPrice(price)}
          </div>
          {priceDiff > 0 ? (
            <div
              className={cn(
                'text-xs font-medium mt-0.5',
                priceAbove ? 'text-red-400' : 'text-green-400'
              )}
            >
              {priceAbove ? '+' : '-'}{fmtPrice(priceDiff)} vs mkt
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ScoreBar score={result.sellabilityScore} width="flex-1" />
        <span className={cn('text-xs font-bold shrink-0', scoreTextClass(result.sellabilityScore))}>
          {result.sellabilityScore}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
        {result.insight}
      </p>
    </div>
  );
}

// ---- Main Component ----

export function MarketScanner({ vehicles, compact = false, onViewFull }: MarketScannerProps) {
  const { dealer } = useDealer();
  const [radiusMiles, setRadiusMiles] = useState<number>(100);
  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<MarketResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [analyzedAt, setAnalyzedAt] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  // Track whether we have ever loaded data (to show skeleton vs previous results)
  const hasLoadedOnce = useRef<boolean>(false);

  const availableVehicles = vehicles.filter((v) => v.status === 'Available');

  const runAnalysis = async (vehicleList: Vehicle[], radius: number) => {
    if (vehicleList.length === 0) return;
    setLoading(true);
    setError(null);
    // Clear results only on first load
    if (!hasLoadedOnce.current) setResults([]);

    try {
      // Fire all requests in parallel
      const promises = vehicleList.map(async (vehicle) => {
        // Check cache first
        const cacheKey = `${vehicle.id}-${radius}`;
        const cached = analysisCache.get(cacheKey);
        if (cached) {
          // Stream cached result immediately
          setResults(prev => {
            const exists = prev.find(r => r.id === cached.id);
            if (exists) return prev;
            return [...prev, cached].sort((a, b) => b.sellabilityScore - a.sellabilityScore);
          });
          return;
        }

        const res = await fetch(`${getBackendUrl()}/api/market/analyze-one`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vehicle, radiusMiles: radius }),
        });
        type R = { data?: { result: MarketResult }; error?: { message: string } };
        const json = (await res.json()) as R;
        if (res.ok && json.data?.result) {
          const result = json.data.result;
          analysisCache.set(cacheKey, result);
          setError(null); // clear error when at least one request succeeds
          // Stream: add to results sorted by score as each one arrives
          setResults(prev => {
            const filtered = prev.filter(r => r.id !== result.id);
            return [...filtered, result].sort((a, b) => b.sellabilityScore - a.sellabilityScore);
          });
        } else {
          setError(json?.error?.message || `Analysis failed (${res.status}). Ensure the backend is running and MARKETCHECK_API_KEY is set in backend/.env.`);
        }
      });

      await Promise.allSettled(promises);
      hasLoadedOnce.current = true;
      setAnalyzedAt(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  // Auto-trigger on mount and whenever radiusMiles changes
  useEffect(() => {
    if (availableVehicles.length === 0) return;
    runAnalysis(availableVehicles, radiusMiles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radiusMiles]);

  const vehicleMap = new Map<number, Vehicle>(vehicles.map((v) => [v.id, v]));

  // Summary counts
  const hotCount = results.filter((r) => r.label === 'HOT DEAL').length;
  const worthCount = results.filter((r) => r.label === 'WORTH POSTING').length;
  const skipCount = results.filter((r) => r.label === 'SKIP / REPRICE').length;
  const totalCompetitors = results.reduce((sum, r) => sum + r.estimatedCompetitors, 0);

  // Filter
  const filteredResults = results.filter((r) => {
    if (activeFilter === 'hot') return r.label === 'HOT DEAL';
    if (activeFilter === 'decent') return r.label === 'WORTH POSTING';
    if (activeFilter === 'skip') return r.label === 'SKIP / REPRICE';
    return true;
  });

  // In compact mode: top 3 by score
  const displayResults = compact ? [...results].slice(0, 3) : filteredResults;

  const scanDateStr = analyzedAt ? formatDate(analyzedAt) : null;

  // First-time loading state: show skeleton only when no results have streamed in yet
  const isFirstLoad = loading && !hasLoadedOnce.current && results.length === 0;
  // Re-scan loading: show previous results with subtle indicator
  const isReloading = loading && (hasLoadedOnce.current || results.length > 0);

  // No vehicles available
  if (availableVehicles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <Radar className="w-10 h-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No available vehicles to analyze.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Meta line + radius selector */}
      {compact ? (
        // Compact mode: just a small meta line, no radius selector
        <p className="text-[11px] text-muted-foreground/70 tracking-wide flex items-center gap-1.5">
          Inventory Intelligence · {dealer.name} · {radiusMiles}mi scan
          {scanDateStr ? ` · ${scanDateStr}` : ''}
          {isReloading ? (
            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground/50 shrink-0" />
          ) : null}
        </p>
      ) : (
        // Full mode: meta line + inline radius selector
        <div className="flex items-center gap-3 flex-wrap">
          <Select
            value={String(radiusMiles)}
            onValueChange={(v) => setRadiusMiles(Number(v))}
          >
            <SelectTrigger className="w-32 h-7 text-xs bg-card border-border text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {RADIUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)} className="text-foreground text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <p className="text-[11px] text-muted-foreground/70 tracking-wide flex items-center gap-1.5">
            Inventory Intelligence · {dealer.name} · {radiusMiles}mi scan
            {scanDateStr ? ` · ${scanDateStr}` : ''}
            {isReloading ? (
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground/50 shrink-0" />
            ) : null}
          </p>
        </div>
      )}

      {/* Error — show backend/API message so we can debug */}
      {error !== null ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <p className="text-sm font-medium text-red-400 mb-1">Market Intelligence error</p>
          <p className="text-sm text-red-300/90 break-words">{error}</p>
          <p className="text-xs text-muted-foreground mt-2">
            Backend: ensure it’s running on port 3000 and <code className="bg-black/20 px-1 rounded">MARKETCHECK_API_KEY</code> is in <code className="bg-black/20 px-1 rounded">backend/.env</code>. Restart the backend after changing .env.
          </p>
        </div>
      ) : null}

      {/* Empty state: finished loading but no results (e.g. all requests failed without setting error, or network issue) */}
      {!isFirstLoad && !loading && results.length === 0 && availableVehicles.length > 0 ? (
        <div className="rounded-lg border border-border bg-muted/20 p-6 text-center">
          <Radar className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">No analysis results</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            The backend may be down or MarketCheck is not configured. Start the backend (port 3000), add <code className="bg-muted px-1 rounded">MARKETCHECK_API_KEY</code> to <code className="bg-muted px-1 rounded">backend/.env</code>, then refresh or change the radius to retry.
          </p>
        </div>
      ) : null}

      {/* First-load skeleton: stat tiles */}
      {isFirstLoad ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonTile key={i} />
          ))}
        </div>
      ) : null}

      {/* Stat tiles — shown after first load */}
      {!isFirstLoad && results.length > 0 && !compact ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile
            labelText="POST NOW"
            labelClass="text-green-400"
            count={hotCount}
            sub="Strong competitive advantage"
          />
          <StatTile
            labelText="WORTH POSTING"
            labelClass="text-yellow-500"
            count={worthCount}
            sub="Decent market position"
          />
          <StatTile
            labelText="SKIP / REPRICE"
            labelClass="text-red-400"
            count={skipCount}
            sub="Not competitive enough"
          />
          <StatTile
            labelText="MARKET SCANNED"
            labelClass="text-muted-foreground"
            count={totalCompetitors}
            sub="Competing vehicles"
          />
        </div>
      ) : null}

      {/* Filter tabs — full mode only, after first load */}
      {!compact && !isFirstLoad && results.length > 0 ? (
        <div className="flex items-center gap-1 flex-wrap">
          <TabButton
            active={activeFilter === 'all'}
            onClick={() => setActiveFilter('all')}
            label={`All (${results.length})`}
          />
          <TabButton
            active={activeFilter === 'hot'}
            onClick={() => setActiveFilter('hot')}
            dot="green"
            label={`Hot (${hotCount})`}
          />
          <TabButton
            active={activeFilter === 'decent'}
            onClick={() => setActiveFilter('decent')}
            dot="yellow"
            label={`Decent (${worthCount})`}
          />
          <TabButton
            active={activeFilter === 'skip'}
            onClick={() => setActiveFilter('skip')}
            dot="red"
            label={`Skip (${skipCount})`}
          />
        </div>
      ) : null}

      {/* First-load skeleton: vehicle cards */}
      {isFirstLoad ? (
        compact ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <SkeletonCompactCard key={i} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {[0, 1, 2].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )
      ) : null}

      {/* Results — shown after first load (or while re-loading with previous data) */}
      {!isFirstLoad && displayResults.length > 0 ? (
        <>
          {compact ? (
            <div className="flex flex-col gap-3">
              {displayResults.map((r) => (
                <CompactVehicleCard key={r.id} result={r} vehicle={vehicleMap.get(r.id)} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {displayResults.map((r) => (
                <VehicleCard
                  key={r.id}
                  result={r}
                  vehicle={vehicleMap.get(r.id)}
                  radiusMiles={radiusMiles}
                />
              ))}
            </div>
          )}

          {/* Loading more indicator while streaming */}
          {loading && results.length > 0 ? (
            <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground/60">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading more...
            </div>
          ) : null}

          {/* Compact view-full button */}
          {compact && results.length > 3 ? (
            <div className="flex justify-center pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={onViewFull}
                className="border-border text-muted-foreground hover:text-foreground text-xs gap-2"
              >
                <Radar className="w-3.5 h-3.5" />
                View Full Analysis ({results.length} vehicles)
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
