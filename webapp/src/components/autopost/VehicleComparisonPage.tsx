import { useState } from 'react';
import { Search, Trophy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';
import { getBackendUrl } from '@/lib/backend-url';
import type { Vehicle } from './types';

const RADIUS_OPTIONS = [50, 100, 250, 500] as const;

type CompListing = {
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

type CompsResult = {
  num_found: number;
  stats: { price: { mean: number; median: number; min: number; max: number }; miles: { mean: number } };
  listings: CompListing[];
};

function computeValueScore(
  price: number,
  miles: number,
  meanPrice: number,
  meanMiles: number
): { score: number; priceVsMarket: number; mileageVsMarket: number } {
  const priceVsMarket = price - meanPrice;
  const mileageVsMarket = miles - meanMiles;
  const priceScore =
    meanPrice > 0 ? Math.max(-25, Math.min(25, (25 * -priceVsMarket) / meanPrice)) : 0;
  const milesScore =
    meanMiles > 0 ? Math.max(-25, Math.min(25, (25 * -mileageVsMarket) / meanMiles)) : 0;
  const score = Math.min(100, Math.max(1, Math.round(50 + priceScore + milesScore)));
  return { score, priceVsMarket, mileageVsMarket };
}

interface VehicleComparisonPageProps {
  vehicles: Vehicle[];
}

export function VehicleComparisonPage({ vehicles }: VehicleComparisonPageProps) {
  const [source, setSource] = useState<'manual_vin' | number>('manual_vin');
  const [vinInput, setVinInput] = useState('');
  const [radius, setRadius] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comps, setComps] = useState<{
    result: CompsResult;
    queryLabel: string;
    radius: number;
  } | null>(null);

  const inventoryVehicles = vehicles.filter((v) => v.status === 'Available');

  const runCompare = async () => {
    setError(null);
    setComps(null);
    let year: number;
    let make: string;
    let model: string;
    let trim: string | undefined;
    let queryLabel: string;

    const baseUrl = getBackendUrl();

    if (source === 'manual_vin') {
      const vin = vinInput.trim();
      if (vin.length !== 17) {
        setError('Enter a 17-character VIN.');
        return;
      }
      setLoading(true);
      try {
        const r = await fetch(
          `${baseUrl}/api/marketcheck/vin-decode?vin=${encodeURIComponent(vin)}`
        );
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.data) {
          const backendMsg = j?.error?.message || (typeof j?.message === 'string' ? j.message : null);
          const msg = backendMsg || `VIN decode failed (${r.status}). Check backend and MARKETCHECK_API_KEY in backend/.env. If you changed .env, restart the backend.`;
          setError(msg + ' You can still compare by selecting a vehicle from the "From inventory" dropdown.');
          setLoading(false);
          return;
        }
        year = Number(j.data.year);
        make = String(j.data.make ?? '').trim();
        model = String(j.data.model ?? '').trim();
        trim = j.data.trim != null ? String(j.data.trim).trim() || undefined : undefined;
        queryLabel = `${year} ${make} ${model} ${trim || ''}`.trim();
        if (!year || !make || !model) {
          setError('VIN decode returned incomplete data.');
          setLoading(false);
          return;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'VIN decode failed. Is the backend running?';
        setError(msg + ' Try selecting a vehicle from "From inventory" instead.');
        setLoading(false);
        return;
      } finally {
        setLoading(false);
      }
    } else {
      const v = inventoryVehicles.find((x) => x.id === source);
      if (!v) {
        setError('Select a vehicle from inventory.');
        return;
      }
      year = v.year;
      make = v.make;
      model = v.model;
      trim = v.trim != null ? String(v.trim).trim() || undefined : undefined;
      queryLabel = `${v.year} ${v.make} ${v.model} ${v.trim}`.trim();
    }

    setLoading(true);
    try {
      const compsParams = new URLSearchParams({
        year: String(year),
        make,
        model,
        radius: String(radius),
        rows: '50',
      });
      if (trim) compsParams.set('trim', trim);
      const url = `${baseUrl}/api/marketcheck/comps?${compsParams.toString()}`;
      const res = await fetch(url);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error?.message || `Request failed (${res.status}). Ensure backend is running and MARKETCHECK_API_KEY is set in backend/.env.`);
        setLoading(false);
        return;
      }
      const data = json.data ?? json;
      const listings = Array.isArray(data?.listings) ? data.listings : [];
      const stats = data?.stats ?? { price: { mean: 0, median: 0, min: 0, max: 0 }, miles: { mean: 0 } };
      const num_found = Number(data?.num_found ?? listings.length);
      setComps({
        result: {
          num_found,
          stats: {
            price: {
              mean: Number(stats?.price?.mean ?? 0),
              median: Number(stats?.price?.median ?? 0),
              min: Number(stats?.price?.min ?? 0),
              max: Number(stats?.price?.max ?? 0),
            },
            miles: { mean: Number(stats?.miles?.mean ?? 0) },
          },
          listings: listings.map((l: Record<string, unknown>) => ({
            price: Number(l.price ?? l.dealer_price ?? 0),
            miles: Number(l.miles ?? 0),
            dealer: {
              name: String((l.dealer as Record<string, unknown>)?.name ?? 'Unknown'),
              city: String((l.dealer as Record<string, unknown>)?.city ?? ''),
            },
            dom_active: Number(l.dom_active ?? l.dom ?? 0),
            year: l.year != null ? Number(l.year) : undefined,
            make: l.make != null ? String(l.make) : undefined,
            model: l.model != null ? String(l.model) : undefined,
            trim: l.trim != null ? String(l.trim) : undefined,
            is_certified: Boolean(l.is_certified),
          })),
        },
        queryLabel,
        radius,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed. Is the backend running on port 3000?');
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number) => n.toLocaleString();
  const fmtPrice = (n: number) => '$' + n.toLocaleString();

  const rowsWithScore = comps
    ? comps.result.listings
        .filter((l) => l.price > 0)
        .map((l) => {
          const { score, priceVsMarket, mileageVsMarket } = computeValueScore(
            l.price,
            l.miles,
            comps.result.stats.price.mean,
            comps.result.stats.miles.mean
          );
          return {
            ...l,
            valueScore: score,
            priceVsMarket,
            mileageVsMarket,
            vehicleLabel: [l.year, l.make, l.model, l.trim].filter(Boolean).join(' ') || 'Vehicle',
          };
        })
        .sort((a, b) => b.valueScore - a.valueScore)
    : [];

  const best = rowsWithScore[0];
  const meanPrice = comps?.result.stats.price.mean ?? 0;
  const meanMiles = comps?.result.stats.miles.mean ?? 0;
  const medianPrice = comps?.result.stats.price.median ?? meanPrice;
  const hasResults = rowsWithScore.length > 0;

  return (
    <div className="flex flex-col gap-8 animate-slide-up">
      <div>
        <h1 className="font-bebas text-3xl tracking-wider text-foreground">Vehicle comparison</h1>
        <p className="font-dm text-sm text-muted-foreground mt-0.5">
          Enter a VIN or pick from inventory to find similar vehicles and see the best option.
        </p>
      </div>

      {/* Comparison query */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground">From inventory</Label>
          <Select
            value={source === 'manual_vin' ? 'manual_vin' : String(source)}
            onValueChange={(v) => setSource(v === 'manual_vin' ? 'manual_vin' : Number(v))}
          >
            <SelectTrigger className="bg-card border-border text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual_vin">Manual VIN</SelectItem>
              {inventoryVehicles.map((v) => (
                <SelectItem key={v.id} value={String(v.id)}>
                  {v.year} {v.make} {v.model} {v.trim}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {source === 'manual_vin' && (
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">VIN (17 characters)</Label>
            <Input
              placeholder="3HDSA1H5XSM702627"
              maxLength={17}
              value={vinInput}
              onChange={(e) => setVinInput(e.target.value.toUpperCase())}
              className="font-mono bg-card border-border text-foreground"
            />
          </div>
        )}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground">Radius (mi)</Label>
          <Select value={String(radius)} onValueChange={(v) => setRadius(Number(v))}>
            <SelectTrigger className="w-full bg-card border-border text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RADIUS_OPTIONS.map((r) => (
                <SelectItem key={r} value={String(r)}>
                  {r} mi
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button
            onClick={runCompare}
            disabled={loading || (source === 'manual_vin' && vinInput.trim().length !== 17)}
            className="bg-amber-500 hover:bg-amber-600 text-black font-semibold gap-2"
          >
            <Search className="w-4 h-4" />
            Compare
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading && (
        <div className="rounded-lg border border-border bg-muted/20 p-8 text-center text-muted-foreground">
          Loading comparison…
        </div>
      )}

      {comps && !loading && (
        <>
          {!hasResults && (
            <div className="rounded-lg border border-border bg-muted/20 p-6 text-center">
              <p className="text-sm font-medium text-foreground">No listings found</p>
              <p className="text-xs text-muted-foreground mt-1">
                No comparable vehicles in this radius. Try a larger radius or a different vehicle.
              </p>
            </div>
          )}
          {/* Best value pick */}
          {best && (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="flex border-l-4 border-amber-500 bg-amber-500/5 p-5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-500 shrink-0" />
                    <span className="font-semibold text-foreground">Best value pick</span>
                  </div>
                  <h2 className="text-xl font-bold text-foreground mt-2">{best.vehicleLabel}</h2>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-sm">
                    <span className="text-muted-foreground">Price: {fmtPrice(best.price)}</span>
                    <span className="text-green-500">Market: {fmtPrice(meanPrice)}</span>
                    <span className="text-muted-foreground">Mileage: {fmt(best.miles)} mi</span>
                    <span className="text-amber-500">Avg miles: {fmt(meanMiles)} mi</span>
                    <span className="text-muted-foreground">
                      Dealer: {best.dealer.name} {best.dealer.city ? `· ${best.dealer.city}` : ''}
                    </span>
                    <span className="text-muted-foreground">Days on market: {best.dom_active}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Why this one: {Math.abs(best.mileageVsMarket).toFixed(2)} mi{' '}
                    {best.mileageVsMarket < 0 ? 'fewer' : 'more'} than avg
                    {best.is_certified ? ' · Certified pre-owned' : ''}.
                  </p>
                </div>
                <div className="shrink-0">
                  <span className="inline-flex items-center rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 px-3 py-1 text-sm font-semibold">
                    Value score: {best.valueScore}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Similar vehicles table */}
          {hasResults && (
          <div>
            <h3 className="text-lg font-bold text-foreground">Similar vehicles</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {comps.queryLabel} — {comps.result.num_found} listings found within {comps.radius}{' '}
              miles.
            </p>
            <div className="mt-3 rounded-lg border border-border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Vehicle</th>
                    <th className="text-right py-3 px-4 font-semibold text-foreground">Price</th>
                    <th className="text-right py-3 px-4 font-semibold text-foreground">vs Market</th>
                    <th className="text-right py-3 px-4 font-semibold text-foreground">Miles</th>
                    <th className="text-right py-3 px-4 font-semibold text-foreground">vs Avg</th>
                    <th className="text-right py-3 px-4 font-semibold text-foreground">Value</th>
                    <th className="text-right py-3 px-4 font-semibold text-foreground">DOM</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Dealer</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsWithScore.map((row, idx) => (
                    <tr
                      key={idx}
                      className={cn(
                        'border-b border-border/50 hover:bg-muted/20',
                        idx === 0 && 'bg-amber-500/5 border-l-4 border-l-amber-500'
                      )}
                    >
                      <td className="py-2 px-4">
                        <div className="flex items-center gap-1.5">
                          {idx === 0 && (
                            <span className="text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded">
                              Best
                            </span>
                          )}
                          <span className="text-foreground">{row.vehicleLabel}</span>
                          <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
                          {row.is_certified && (
                            <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                              CPO
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-right py-2 px-4 font-medium">{fmtPrice(row.price)}</td>
                      <td
                        className={cn(
                          'text-right py-2 px-4',
                          row.priceVsMarket <= 0 ? 'text-green-500' : 'text-red-500'
                        )}
                      >
                        {row.priceVsMarket <= 0 ? '-' : '+'}
                        {fmtPrice(Math.abs(row.priceVsMarket))}
                      </td>
                      <td className="text-right py-2 px-4">{fmt(row.miles)}</td>
                      <td
                        className={cn(
                          'text-right py-2 px-4',
                          row.mileageVsMarket <= 0 ? 'text-green-500' : 'text-red-500'
                        )}
                      >
                        {row.mileageVsMarket <= 0 ? '' : '+'}
                        {row.mileageVsMarket.toFixed(2)} mi
                      </td>
                      <td className="text-right py-2 px-4 text-amber-500 font-medium">
                        {row.valueScore}
                      </td>
                      <td className="text-right py-2 px-4">{row.dom_active}</td>
                      <td className="py-2 px-4 text-muted-foreground">
                        {row.dealer.name} {row.dealer.city ? `· ${row.dealer.city}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          )}

          {/* Market Value vs Miles scatter */}
          {rowsWithScore.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-5">
              <h3 className="text-lg font-bold text-foreground">Market Value vs Miles</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Hover over any dot to inspect price & mileage. Best value in the lower-left zone.
              </p>
              <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground mb-2">
                <span>Median price {fmtPrice(medianPrice)}</span>
                <span>Avg miles {fmt(meanMiles)}</span>
                <span className="text-green-500">Best option</span>
                <span className="text-muted-foreground">Other listings</span>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <XAxis
                      type="number"
                      dataKey="miles"
                      name="Miles"
                      unit=" mi"
                      domain={['auto', 'auto']}
                      tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                    />
                    <YAxis
                      type="number"
                      dataKey="price"
                      name="Price"
                      tickFormatter={(v) => `$${Math.round(v / 1000)}k`}
                      domain={['auto', 'auto']}
                    />
                    <ZAxis type="number" dataKey="valueScore" range={[80, 400]} />
                    <ReferenceLine
                      y={medianPrice}
                      stroke="rgb(249 115 22)"
                      strokeDasharray="4 4"
                      label={{ value: fmtPrice(medianPrice), position: 'left' }}
                    />
                    <ReferenceLine
                      x={meanMiles}
                      stroke="rgb(249 115 22)"
                      strokeDasharray="4 4"
                      label={{ value: 'avg', position: 'top' }}
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: '3 3' }}
                      formatter={(value: number, name: string) => [name === 'price' ? fmtPrice(value) : name === 'miles' ? `${fmt(value)} mi` : value, name]}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Scatter
                      name="Listings"
                      data={rowsWithScore}
                      fill="hsl(var(--muted-foreground) / 0.5)"
                    >
                      {rowsWithScore.map((entry, idx) => (
                        <Cell
                          key={idx}
                          fill={
                            entry.valueScore >= 70
                              ? '#22c55e'
                              : entry.valueScore >= 40
                                ? '#eab308'
                                : 'hsl(var(--muted-foreground) / 0.5)'
                          }
                        />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-6 mt-2 text-xs text-muted-foreground">
                <span>
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" />
                  High value (score ≥70)
                </span>
                <span>
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1" />
                  Medium (40–69)
                </span>
                <span>
                  <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground/50 mr-1" />
                  Low (&lt;40)
                </span>
              </div>
            </div>
          )}

          {/* Charts: Value score top 10, Price comparison, Mileage vs price */}
          {rowsWithScore.length > 0 && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-foreground">Charts</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-lg border border-border bg-card p-5">
                  <h4 className="text-sm font-semibold text-foreground">Value score (top 10)</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Higher = better price and mileage vs market
                  </p>
                  <div className="h-64 mt-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={rowsWithScore.slice(0, 10).map((r, i) => ({
                          name: r.vehicleLabel.slice(0, 12),
                          score: r.valueScore,
                          fill: i === 0 ? '#eab308' : 'hsl(var(--muted-foreground) / 0.4)',
                        }))}
                        margin={{ left: 50, right: 20 }}
                      >
                        <XAxis type="number" domain={[0, 100]} />
                        <YAxis type="category" dataKey="name" width={50} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                          {rowsWithScore.slice(0, 10).map((_, i) => (
                            <Cell key={i} fill={i === 0 ? '#eab308' : 'hsl(var(--muted-foreground) / 0.4)'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-card p-5">
                  <h4 className="text-sm font-semibold text-foreground">Price comparison</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Market median: {fmtPrice(medianPrice)}
                  </p>
                  <div className="h-64 mt-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={rowsWithScore.slice(0, 10).map((r, i) => ({
                          name: r.vehicleLabel.slice(0, 10),
                          price: r.price,
                          fill: i === 0 ? '#eab308' : 'hsl(var(--muted-foreground) / 0.4)',
                        }))}
                        margin={{ top: 20, right: 20, left: 0 }}
                      >
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
                        <ReferenceLine
                          y={medianPrice}
                          stroke="rgb(249 115 22)"
                          strokeDasharray="4 4"
                          label={{ value: 'median', position: 'right' }}
                        />
                        <Tooltip formatter={(v: number) => [fmtPrice(v), 'Price']} />
                        <Bar dataKey="price" radius={[4, 4, 0, 0]}>
                          {rowsWithScore.slice(0, 10).map((_, i) => (
                            <Cell key={i} fill={i === 0 ? '#eab308' : 'hsl(var(--muted-foreground) / 0.4)'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-card p-5">
                <h4 className="text-sm font-semibold text-foreground">Mileage vs price</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Lower miles and lower price = better value. Best option highlighted.
                </p>
                <div className="h-64 mt-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart>
                      <XAxis
                        type="number"
                        dataKey="miles"
                        name="Miles"
                        tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                      />
                      <YAxis
                        type="number"
                        dataKey="price"
                        name="Price"
                        tickFormatter={(v) => `$${Math.round(v / 1000)}k`}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) =>
                          name === 'price' ? fmtPrice(value) : `${fmt(value)} mi`
                        }
                      />
                      <Scatter data={rowsWithScore} name="Listings">
                        {rowsWithScore.map((_, i) => (
                          <Cell
                            key={i}
                            fill={i === 0 ? '#eab308' : 'hsl(var(--muted-foreground) / 0.4)'}
                          />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
