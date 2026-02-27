import { useState, useEffect, useRef } from 'react';
import { X, TrendingDown, TrendingUp, Loader2, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDealer } from '../../context/DealerContext';
import type { Vehicle } from './types';
import { analysisCache, fetchVehicleAnalysis, type MarketResult } from './marketCache';

interface VehicleDetailDrawerProps {
  vehicle: Vehicle | null;
  allVehicles: Vehicle[];
  onClose: () => void;
  onEdit: (v: Vehicle) => void;
  onPost: (v: Vehicle) => void;
}

// ---- Helpers ----

const RADIUS_OPTIONS = [
  { label: '50 miles', value: 50 },
  { label: '100 miles', value: 100 },
  { label: '250 miles', value: 250 },
  { label: '500 miles', value: 500 },
  { label: '750 miles', value: 750 },
];

function fmt(n: number) { return n.toLocaleString(); }
function fmtPrice(n: number) { return '$' + n.toLocaleString(); }

function scoreColor(s: number) {
  if (s > 70) return '#22c55e';
  if (s >= 40) return '#eab308';
  return '#ef4444';
}
function scoreTextClass(s: number) {
  if (s > 70) return 'text-green-400';
  if (s >= 40) return 'text-yellow-500';
  return 'text-red-400';
}
function supplyClass(l: 'LOW' | 'MODERATE' | 'HIGH') {
  if (l === 'LOW') return 'text-green-400';
  if (l === 'MODERATE') return 'text-yellow-500';
  return 'text-red-400';
}
function labelBadgeClass(label: MarketResult['label']) {
  if (label === 'HOT DEAL') return 'bg-green-500 text-white';
  if (label === 'WORTH POSTING') return 'bg-yellow-500 text-black';
  return 'bg-red-500 text-white';
}
function labelBorderClass(label: MarketResult['label']) {
  if (label === 'HOT DEAL') return 'border-l-green-500';
  if (label === 'WORTH POSTING') return 'border-l-yellow-500';
  return 'border-l-red-500';
}
function labelTextClass(label: MarketResult['label']) {
  if (label === 'HOT DEAL') return 'text-green-400';
  if (label === 'WORTH POSTING') return 'text-yellow-500';
  return 'text-red-400';
}

const statusStyles: Record<string, string> = {
  Available: 'bg-green-500/15 text-green-400 border-green-500/30',
  Pending: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  Sold: 'bg-red-500/15 text-red-400 border-red-500/30',
};

// ---- Score bar ----

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, backgroundColor: scoreColor(score) }}
        />
      </div>
      <span className={cn('text-sm font-bold w-8 text-right', scoreTextClass(score))}>
        {score}
      </span>
    </div>
  );
}

// ---- Skeleton ----

function DrawerSkeleton() {
  return (
    <div className="animate-pulse flex flex-col gap-4 p-5">
      <div className="h-3 bg-secondary rounded w-48" />
      <div className="h-8 bg-secondary rounded w-20" />
      <div className="h-4 bg-secondary rounded w-full" />
      <div className="h-4 bg-secondary rounded w-5/6" />
      <div className="h-10 bg-secondary rounded" />
      <div className="grid grid-cols-5 gap-2">
        {[0,1,2,3,4].map(i => <div key={i} className="bg-secondary rounded h-14" />)}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[0,1,2].map(i => <div key={i} className="bg-secondary rounded h-14" />)}
      </div>
      <div className="h-3 bg-secondary rounded w-32 mt-2" />
      {[0,1,2].map(i => <div key={i} className="h-8 bg-secondary rounded" />)}
    </div>
  );
}

// ---- Main Drawer ----

export function VehicleDetailDrawer({
  vehicle,
  allVehicles,
  onClose,
  onEdit,
  onPost,
}: VehicleDetailDrawerProps) {
  const { dealer } = useDealer();
  const [radiusMiles, setRadiusMiles] = useState(100);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MarketResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasLoaded = useRef(false);
  const open = vehicle !== null;

  // Reset + fetch whenever vehicle or radius changes
  useEffect(() => {
    if (!vehicle) return;
    hasLoaded.current = false;
    setResult(null);
    setError(null);
    analyze(vehicle, radiusMiles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle?.id, radiusMiles]);

  const analyze = async (v: Vehicle, radius: number) => {
    if (v.status === 'Sold') return;
    // Check shared cache first — instant if pre-warmed
    const key = `${v.id}-${radius}`;
    const cached = analysisCache.get(key);
    if (cached) {
      setResult(cached);
      setLoading(false);
      hasLoaded.current = true;
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchVehicleAnalysis(v, radius);
      if (res) {
        setResult(res);
        hasLoaded.current = true;
      } else {
        setError('Analysis unavailable. Please try again.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const bodyTypeEmoji: Record<string, string> = {
    Sedan: '🚗', SUV: '🚙', Truck: '🛻', Coupe: '🏎️', Van: '🚐', Convertible: '🚘',
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-background/60 backdrop-blur-sm transition-opacity duration-300',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className={cn(
          'fixed top-0 right-0 z-50 h-screen w-full max-w-lg bg-card border-l border-border flex flex-col shadow-2xl transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {vehicle && (
          <>
            {/* Drawer header */}
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center text-xl shrink-0">
                  {bodyTypeEmoji[vehicle.bodyType] ?? '🚗'}
                </div>
                <div className="min-w-0">
                  <div className="font-mono text-base font-bold text-foreground leading-tight truncate">
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {vehicle.trim} · {vehicle.color}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn('text-xs font-medium border rounded px-2 py-0.5', statusStyles[vehicle.status])}>
                  {vehicle.status}
                </span>
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">

              {/* Vehicle quick stats */}
              <div className="px-5 py-4 border-b border-border">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Price</div>
                    <div className="text-lg font-bold text-foreground mt-0.5">{fmtPrice(vehicle.price)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Mileage</div>
                    <div className="text-lg font-bold text-foreground mt-0.5">{fmt(vehicle.mileage)} mi</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Condition</div>
                    <div className="text-lg font-bold text-foreground mt-0.5">{vehicle.condition}</div>
                  </div>
                </div>
                <div className="font-mono text-xs text-muted-foreground/50 mt-3 tracking-wider">
                  VIN: {vehicle.vin}
                </div>
              </div>

              {/* Action buttons */}
              <div className="px-5 py-3 border-b border-border flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onEdit(vehicle)}
                  className="border-border text-muted-foreground hover:text-foreground gap-1.5 font-dm text-xs"
                >
                  <Pencil className="w-3 h-3" />
                  Edit Vehicle
                </Button>
              </div>

              {/* Market Analysis header */}
              <div className="px-5 pt-4 pb-2 flex items-center justify-between gap-3">
                <div>
                  <div className="font-bebas text-lg tracking-wider text-foreground leading-none">
                    MARKET ANALYSIS
                  </div>
                  <div className="text-[11px] text-muted-foreground/60 mt-0.5">
                    Inventory Intelligence · {dealer.name} · {radiusMiles}mi scan
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground/60" />}
                  <Select value={String(radiusMiles)} onValueChange={v => setRadiusMiles(Number(v))}>
                    <SelectTrigger className="w-28 h-7 text-xs bg-secondary border-border text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {RADIUS_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={String(opt.value)} className="text-foreground text-xs">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="mx-5 mb-3 bg-red-500/10 border border-red-500/30 rounded p-3">
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              {/* Sold state — no analysis */}
              {vehicle.status === 'Sold' && (
                <div className="mx-5 mb-4 bg-secondary/60 rounded-lg p-4 text-center">
                  <p className="text-sm text-muted-foreground">Market analysis is only available for Available vehicles.</p>
                </div>
              )}

              {/* Loading skeleton */}
              {loading && !result && vehicle.status !== 'Sold' && <DrawerSkeleton />}

              {/* Results */}
              {!loading && result && (
                <div className="px-5 pb-6 flex flex-col gap-4">

                  {/* Score + label row */}
                  <div className="flex items-center gap-3">
                    <span className={cn('text-xs font-bold px-2.5 py-1 rounded uppercase tracking-wide', labelBadgeClass(result.label))}>
                      {result.label}
                    </span>
                    <div className="flex-1">
                      <ScoreBar score={result.sellabilityScore} />
                    </div>
                  </div>

                  {/* AI Recommendation */}
                  <div className={cn('border-l-4 pl-3 py-2', labelBorderClass(result.label))}>
                    <div className={cn('text-[11px] font-bold uppercase tracking-wide', labelTextClass(result.label))}>
                      AI RECOMMENDATION: {result.recommendedAction}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      {result.insight}
                    </p>
                  </div>

                  {/* Price vs market */}
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'flex items-center gap-1 text-sm font-semibold',
                        result.priceVsMarket > 0 ? 'text-red-400' : 'text-green-400'
                      )}
                    >
                      {result.priceVsMarket > 0
                        ? <TrendingUp className="w-4 h-4" />
                        : <TrendingDown className="w-4 h-4" />
                      }
                      {result.priceVsMarket > 0 ? '+' : ''}
                      {fmtPrice(Math.abs(result.priceVsMarket))} vs market
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Mkt avg: {fmtPrice(result.marketAvgPrice)}
                    </span>
                  </div>

                  {/* Data grid row 1 — 5 cells */}
                  <div className="bg-secondary/20 rounded-lg p-3 flex flex-col gap-2">
                    <div className="grid grid-cols-5 gap-2">
                      {[
                        { label: 'Market Avg', value: fmtPrice(result.marketAvgPrice) },
                        { label: 'Range', value: `${fmtPrice(result.priceRange.low)} – ${fmtPrice(result.priceRange.high)}`, small: true },
                        { label: 'Avg Miles', value: fmt(result.avgMarketMiles) },
                        { label: 'Competing', value: `${result.estimatedCompetitors} in ${radiusMiles}mi` },
                        { label: 'Supply', value: result.supplyLevel, colored: supplyClass(result.supplyLevel) },
                      ].map(cell => (
                        <div key={cell.label} className="bg-secondary/60 rounded p-2 col-span-1">
                          <div className="text-[9px] text-muted-foreground/70 uppercase tracking-wide leading-none mb-1">
                            {cell.label}
                          </div>
                          <div className={cn('text-xs font-semibold leading-snug', cell.colored ?? 'text-foreground', cell.small ? 'text-[10px]' : '')}>
                            {cell.value}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Data grid row 2 — 3 cells */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Mkt DOM', value: `${result.marketDaysOnLot}d`, colored: '' },
                        { label: 'Your LOT', value: `${result.dealerDaysOnLot}d`, colored: '' },
                        {
                          label: 'Mile Adv',
                          value: `${fmt(Math.abs(result.mileageVsMarket))} ${result.mileageVsMarket > 0 ? 'more' : 'fewer'}`,
                          colored: result.mileageVsMarket > 0 ? 'text-red-400' : 'text-green-400',
                        },
                      ].map(cell => (
                        <div key={cell.label} className="bg-secondary/60 rounded p-2">
                          <div className="text-[9px] text-muted-foreground/70 uppercase tracking-wide leading-none mb-1">
                            {cell.label}
                          </div>
                          <div className={cn('text-xs font-semibold', cell.colored || 'text-foreground')}>
                            {cell.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Nearest Competitors */}
                  {result.nearestCompetitors.length > 0 && (
                    <div>
                      <div className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest mb-2">
                        NEAREST COMPETITORS
                      </div>
                      <div className="border border-border rounded-lg overflow-hidden">
                        {result.nearestCompetitors.slice(0, 3).map((comp, i) => (
                          <div
                            key={i}
                            className={cn(
                              'flex items-center justify-between px-4 py-3',
                              i < 2 ? 'border-b border-border/50' : ''
                            )}
                          >
                            <span className="text-sm text-foreground/80 font-medium">{comp.name}</span>
                            <div className="text-right">
                              <span className="text-sm font-semibold text-foreground">{fmtPrice(comp.price)}</span>
                              <span className="text-xs text-muted-foreground ml-3">{fmt(comp.miles)} mi</span>
                              <span className="text-xs text-muted-foreground ml-2">{comp.distance}mi away</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
