import { useState } from 'react';
import { Car, TrendingUp, Link2, Flame, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import JSZip from 'jszip';
import { toast } from 'sonner';
import type { ActiveView } from './types';
import { useDealer } from '../../context/DealerContext';
import { useDealership, type DealershipVehicle } from './DealershipContext';

interface DashboardViewProps {
  onNavigate: (view: ActiveView) => void;
}

const DONUT_COLORS: Record<string, string> = {
  'Hot Deals': '#22c55e',
  'Decent': '#eab308',
  'Skip': '#ef4444',
};

const tooltipStyle = {
  contentStyle: {
    backgroundColor: '#111111',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#ffffff',
    borderRadius: '6px',
    fontSize: '12px',
    fontFamily: 'var(--font-dm)',
  },
  labelStyle: { color: '#ffffff', fontWeight: 600 },
  itemStyle: { color: '#ffffff' },
};

function getTodayLabel(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

// ── AI LISTING GENERATOR ──
function generateListing(v: DealershipVehicle): string {
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

  if (v.drivetrain === 'SH-AWD' || v.drivetrain === 'AWD' || v.drivetrain === '4WD')
    desc += `${v.drivetrain} for confident handling in any conditions.\n`;
  if (v.engine?.includes('Turbo')) desc += `Turbocharged performance.\n`;
  if (v.is_certified) desc += `Certified Pre-Owned with manufacturer warranty.\n`;
  if (v.fuel_type === 'Hybrid') desc += `Hybrid efficiency — save on gas in Miami traffic.\n`;

  desc += `\nThoroughly inspected and ready to go.\n\n`;
  desc += `📍 Doral, FL 33172\n📱 Message for details\n💰 Financing available\n`;
  desc += `\n#${v.make} #${v.model} #Miami #Doral #305CarDeals #UsedCars`;

  return desc;
}

// ── Facebook Icon ──
const FBIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="11" fill="#1877F2" />
    <path
      d="M16.5 6H14.25C13.01 6 12 7.01 12 8.25V10.5H9.75V13.5H12V21H15V13.5H17.25L18 10.5H15V8.625C15 8.28 15.28 8 15.625 8H16.5V6Z"
      fill="white"
    />
  </svg>
);

// ── Post Modal Component ──
function PostModal({
  vehicle,
  onClose,
}: {
  vehicle: DealershipVehicle;
  onClose: () => void;
}) {
  const [cp, setCp] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<number>>(
    new Set((vehicle.media?.photo_links ?? []).map((_, i) => i))
  );
  const [imgErrors, setImgErrors] = useState<Set<number>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [extensionSent, setExtensionSent] = useState(false);
  const listing = generateListing(vehicle);

  const photoLinks: string[] = vehicle.media?.photo_links ?? [];

  const copy = (t: string, f: string) => {
    navigator.clipboard.writeText(t).catch(() => {});
    setCp(f);
    setTimeout(() => setCp(null), 1800);
  };

  const togglePhoto = (i: number) => {
    setSelectedPhotos((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const selectAll = () => setSelectedPhotos(new Set(photoLinks.map((_, i) => i)));
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
          const ext = url.split('.').pop()?.split('?')[0] ?? 'jpg';
          folder.file(`photo_${i + 1}.${ext}`, blob);
          fetched++;
        } catch {
          console.warn(`[ZIP] Skipped ${url}`);
        }
      })
    );
    if (fetched === 0) console.warn('[ZIP] No photos fetched');
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${vehicle.year}_${vehicle.make}_${vehicle.model}_photos.zip`;
    a.click();
    URL.revokeObjectURL(url);
    setDownloading(false);
  };

  const fields: [string, string][] = [
    ['Year', String(vehicle.year)],
    ['Make', vehicle.make],
    ['Model', `${vehicle.model} ${vehicle.trim}`],
    ['Price', String(vehicle.price)],
    ['Mileage', String(vehicle.miles)],
    ['Body', vehicle.body_type],
    ['Fuel', vehicle.fuel_type],
    ['Trans', vehicle.transmission],
    ['Drive', vehicle.drivetrain],
    ['Color', vehicle.exterior_color],
    ['VIN', vehicle.vin],
    ['Location', 'Doral, FL 33172'],
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
            <span className="text-sm font-bold text-foreground font-dm">Post to Marketplace</span>
            <span className="text-xs text-muted-foreground/30">— {vehicle.year} {vehicle.make} {vehicle.model}</span>
          </div>
          <button onClick={onClose} className="bg-transparent border-none text-muted-foreground cursor-pointer text-lg">✕</button>
        </div>

        <div className="p-5">
          {/* Progress bar — 4 steps */}
          <div className="flex gap-1 mb-4">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className={`flex-1 h-0.5 rounded-sm transition-colors ${step >= s ? 'bg-[#1877F2]' : 'bg-muted'}`} />
            ))}
          </div>

          {/* STEP 1 — Vehicle Details */}
          {step === 1 && (
            <>
              <div className="text-[10px] font-semibold tracking-widest text-muted-foreground mb-3">STEP 1 — COPY VEHICLE DETAILS</div>
              <div className="grid grid-cols-2 gap-1.5 mb-3">
                {fields.map(([l, v], i) => (
                  <div
                    key={i}
                    onClick={() => copy(v, l)}
                    className={`rounded-md px-3 py-2 cursor-pointer transition-all border ${cp === l ? 'bg-green-500/10 border-green-500/25' : 'bg-muted/40 border-border hover:border-muted-foreground/20'}`}
                  >
                    <div className="text-[9px] text-muted-foreground font-semibold">{l}</div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-foreground font-semibold font-mono">{v}</span>
                      <span className={`text-[9px] ${cp === l ? 'text-green-500' : 'text-muted-foreground/30'}`}>{cp === l ? '✓' : 'copy'}</span>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => copy(fields.map(([l, v]) => `${l}: ${v}`).join('\n'), 'all')}
                className={`w-full rounded-md py-2 text-xs font-semibold cursor-pointer mb-3 border transition-all ${cp === 'all' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-muted/40 border-border text-muted-foreground hover:border-muted-foreground/20'}`}
              >
                {cp === 'all' ? '✓ Copied!' : 'Copy All Fields'}
              </button>
              <button onClick={() => setStep(2)} className="w-full bg-[#1877F2] border-none rounded-lg py-3 text-white text-xs font-bold cursor-pointer">Next →</button>
            </>
          )}

          {/* STEP 2 — AI Description */}
          {step === 2 && (
            <>
              <div className="text-[10px] font-semibold tracking-widest text-muted-foreground mb-3">STEP 2 — AI LISTING DESCRIPTION</div>
              <div className="bg-black/40 border border-border rounded-lg p-3 text-xs text-muted-foreground leading-7 whitespace-pre-wrap max-h-[200px] overflow-y-auto mb-3">{listing}</div>
              <button
                onClick={() => copy(listing, 'desc')}
                className={`w-full rounded-md py-2 text-xs font-semibold cursor-pointer mb-3 border transition-all ${cp === 'desc' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-muted/40 border-border text-muted-foreground hover:border-muted-foreground/20'}`}
              >
                {cp === 'desc' ? '✓ Copied!' : 'Copy Description'}
              </button>
              <div className="flex gap-1.5">
                <button onClick={() => setStep(1)} className="flex-1 bg-muted/40 border border-border rounded-md py-2 text-muted-foreground text-xs font-semibold cursor-pointer">← Back</button>
                <button onClick={() => setStep(3)} className="flex-[2] bg-[#1877F2] border-none rounded-lg py-3 text-white text-xs font-bold cursor-pointer">Next →</button>
              </div>
            </>
          )}

          {/* STEP 3 — Vehicle Photos */}
          {step === 3 && (
            <>
              <div className="text-[10px] font-semibold tracking-widest text-muted-foreground mb-3">STEP 3 — VEHICLE PHOTOS</div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted-foreground">{selectedPhotos.size} of {photoLinks.length} selected</span>
                <div className="flex gap-1.5">
                  <button onClick={selectAll} className="bg-muted/40 border border-border rounded px-2.5 py-1 text-[10px] font-semibold text-muted-foreground cursor-pointer hover:border-muted-foreground/30 transition-all">Select All</button>
                  <button onClick={deselectAll} className="bg-muted/40 border border-border rounded px-2.5 py-1 text-[10px] font-semibold text-muted-foreground cursor-pointer hover:border-muted-foreground/30 transition-all">Deselect All</button>
                </div>
              </div>

              {photoLinks.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground/50">No photos available for this vehicle.</div>
              ) : (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {photoLinks.map((url, i) => {
                    const isSelected = selectedPhotos.has(i);
                    const hasError = imgErrors.has(i);
                    return (
                      <div
                        key={i}
                        onClick={() => togglePhoto(i)}
                        className={`relative rounded-lg overflow-hidden cursor-pointer border-2 transition-all aspect-[4/3] ${isSelected ? 'border-[#1877F2] ring-1 ring-[#1877F2]/40' : 'border-border opacity-50 hover:opacity-70'}`}
                      >
                        {hasError ? (
                          <div className="w-full h-full bg-muted/60 flex flex-col items-center justify-center gap-1">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-muted-foreground/30">
                              <path d="M3 7h2l2-3h10l2 3h2a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
                              <circle cx="12" cy="13" r="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
                            </svg>
                            <span className="text-[8px] text-muted-foreground/30 px-1 text-center break-all leading-3">{url.split('/').pop()}</span>
                          </div>
                        ) : (
                          <img
                            src={url}
                            alt={`Vehicle photo ${i + 1}`}
                            className="w-full h-full object-cover"
                            onError={() => setImgErrors((prev) => new Set(prev).add(i))}
                          />
                        )}
                        <div className={`absolute top-1.5 right-1.5 w-4 h-4 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-[#1877F2] border-[#1877F2]' : 'bg-black/50 border-white/30'}`}>
                          {isSelected && (
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <div className="absolute bottom-1 left-1.5 text-[9px] text-white/60 font-mono">{i + 1}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                onClick={downloadZip}
                disabled={selectedPhotos.size === 0 || downloading}
                className={`w-full rounded-md py-2.5 text-xs font-semibold cursor-pointer mb-3 border transition-all flex items-center justify-center gap-2 ${downloading ? 'bg-muted/40 border-border text-muted-foreground/50 cursor-not-allowed' : selectedPhotos.size === 0 ? 'bg-muted/20 border-border/50 text-muted-foreground/30 cursor-not-allowed' : 'bg-muted/40 border-border text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground'}`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="shrink-0">
                  <path d="M12 3v13M7 11l5 5 5-5M5 21h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {downloading ? 'Downloading...' : selectedPhotos.size === 0 ? 'Select photos to download' : `Download ${selectedPhotos.size} Photo${selectedPhotos.size !== 1 ? 's' : ''} as ZIP`}
              </button>

              <div className="flex gap-1.5">
                <button onClick={() => setStep(2)} className="flex-1 bg-muted/40 border border-border rounded-md py-2 text-muted-foreground text-xs font-semibold cursor-pointer">← Back</button>
                <button onClick={() => setStep(4)} className="flex-[2] bg-[#1877F2] border-none rounded-lg py-3 text-white text-xs font-bold cursor-pointer">Next →</button>
              </div>
            </>
          )}

          {/* STEP 4 — Ready to Post */}
          {step === 4 && (
            <>
              <div className="text-center py-4">
                <div className="text-4xl mb-2">🚀</div>
                <div className="text-base font-bold text-foreground mb-1">Ready to Post</div>
                <div className="text-xs text-muted-foreground max-w-[380px] mx-auto leading-5">
                  {extensionSent
                    ? 'Sent to your Chrome extension! Click the extension icon and hit "Open FB Marketplace & Auto-Fill".'
                    : 'Send this listing to your Chrome extension for auto-fill, or open FB Marketplace manually.'}
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
                        vehicleId: 1,
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
                className={`flex items-center justify-center gap-2 w-full border-none rounded-lg py-3 text-sm font-bold cursor-pointer mb-2 transition-all ${extensionSent ? 'bg-green-600 text-white' : 'bg-[#1877F2] text-white hover:bg-[#166fe5]'}`}
              >
                {extensionSent ? <>✓ Sent to Extension</> : <><FBIcon /> Send to Extension & Auto-Fill</>}
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
                <button onClick={() => setStep(3)} className="flex-1 bg-muted/40 border border-border rounded-md py-2 text-muted-foreground text-xs font-semibold cursor-pointer">← Back</button>
                <button onClick={onClose} className="flex-1 bg-muted/40 border border-border rounded-md py-2 text-muted-foreground text-xs font-semibold cursor-pointer">Done</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Hot Deal Card Component ──
function HotDealCard({
  v,
  expanded,
  onToggle,
  onPost,
}: {
  v: DealershipVehicle;
  expanded: boolean;
  onToggle: () => void;
  onPost: (v: DealershipVehicle) => void;
}) {
  const scoreColor = '#00C853';

  return (
    <div
      onClick={onToggle}
      className={`rounded-xl p-4 cursor-pointer transition-all border ${
        expanded
          ? 'bg-muted/50 border-border'
          : 'bg-background/50 border-border/50 hover:border-border'
      }`}
    >
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-bold text-foreground font-dm">
              {v.year} {v.make} {v.model}
            </span>
            <span className="bg-green-500/20 text-green-500 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide">
              HOT DEAL
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
            <div className="text-base font-bold text-foreground font-mono">
              ${v.price.toLocaleString()}
            </div>
            {v.price_diff > 0 && (
              <div className="text-xs font-semibold font-mono text-green-500">
                ▼ ${v.price_diff.toLocaleString()}
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
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-border">
          <div
            className="rounded-lg p-3 mb-3 border-l-[3px]"
            style={{
              background: 'rgba(0,0,0,0.3)',
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

          <button
            onClick={(e) => {
              e.stopPropagation();
              onPost(v);
            }}
            className="w-full bg-[#1877F2] border-none rounded-lg py-3 text-white text-xs font-bold cursor-pointer flex items-center justify-center gap-2 mb-3"
          >
            <FBIcon /> Post to Facebook Marketplace
          </button>

          {v.market && (
            <>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-2 mb-3">
                {(
                  [
                    ['Market Avg', `$${v.market.price.mean.toLocaleString()}`],
                    [
                      'Range',
                      `$${v.market.price.min.toLocaleString()}-${v.market.price.max.toLocaleString()}`,
                    ],
                    ['Avg Miles', v.market.miles.mean.toLocaleString()],
                    ['Supply', `${v.market.total} in 100mi`],
                    ['Your LOT', `${v.dom_active}d`],
                    [
                      'Mile Diff',
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
                    {c.dealer?.name || 'Unknown'}
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

export function DashboardView({ onNavigate }: DashboardViewProps) {
  const { dealer } = useDealer();
  const { isConnected, dealer: connectedDealer, hotDeals, decentDeals, skipDeals, inventory } = useDealership();
const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modal, setModal] = useState<DealershipVehicle | null>(null);

  const totalInventory = isConnected ? inventory.length : 0;
  const totalValue = isConnected ? inventory.reduce((sum, v) => sum + v.price, 0) : 0;

  // Donut chart data
  const donutData = isConnected ? [
    { name: 'Hot Deals', value: hotDeals.length },
    { name: 'Decent', value: decentDeals.length },
    { name: 'Skip', value: skipDeals.length },
  ].filter((d) => d.value > 0) : [];

  // Body type breakdown from connected inventory
  const bodyTypeCountMap: Record<string, number> = {};
  if (isConnected) {
    inventory.forEach((v) => {
      bodyTypeCountMap[v.body_type] = (bodyTypeCountMap[v.body_type] ?? 0) + 1;
    });
  }
  const bodyTypeCountData = Object.entries(bodyTypeCountMap)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  // Avg price by body type
  const bodyTypePriceMap: Record<string, number[]> = {};
  if (isConnected) {
    inventory.forEach((v) => {
      if (!bodyTypePriceMap[v.body_type]) bodyTypePriceMap[v.body_type] = [];
      bodyTypePriceMap[v.body_type].push(v.price);
    });
  }
  const avgPriceData = Object.entries(bodyTypePriceMap).map(([type, prices]) => ({
    type,
    avgPrice: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-bebas text-4xl tracking-wider text-foreground leading-none">
            DASHBOARD
          </h1>
          <p className="font-dm text-sm text-muted-foreground mt-1">
            {isConnected ? `${connectedDealer?.name} · ${getTodayLabel()}` : getTodayLabel()}
          </p>
        </div>
      </div>

      {/* Connect Dealership CTA - Only show when not connected */}
      {!isConnected && (
        <div className="bg-card border border-primary/20 rounded-lg p-6 bg-primary/5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Link2 className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-bebas text-lg tracking-wider text-foreground mb-1">CONNECT YOUR DEALERSHIP</h3>
              <p className="font-dm text-sm text-muted-foreground mb-3">
                Import your inventory automatically with AI-powered market analysis. See which vehicles are hot deals and should be posted immediately.
              </p>
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-dm font-medium"
                onClick={() => onNavigate('connect-inventory')}
              >
                Connect Now
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards - Always visible */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-start justify-between mb-3">
            <span className="font-dm text-xs text-muted-foreground uppercase tracking-wider">Total Inventory</span>
            <Car className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="font-bebas text-4xl tracking-wider text-foreground leading-none">{totalInventory}</div>
          <div className="font-dm text-xs text-muted-foreground mt-1">vehicles on lot</div>
        </div>

        <div className="bg-card border border-green-500/20 rounded-lg p-5 bg-green-500/5">
          <div className="flex items-start justify-between mb-3">
            <span className="font-dm text-xs text-green-500 uppercase tracking-wider">Hot Deals</span>
            <Flame className="w-4 h-4 text-green-500" />
          </div>
          <div className="font-bebas text-4xl tracking-wider text-green-500 leading-none">{isConnected ? hotDeals.length : 0}</div>
          <div className="font-dm text-xs text-muted-foreground mt-1">post immediately</div>
        </div>

        <div className="bg-card border border-amber-400/20 rounded-lg p-5 bg-amber-400/5">
          <div className="flex items-start justify-between mb-3">
            <span className="font-dm text-xs text-amber-400 uppercase tracking-wider">Worth Posting</span>
            <CheckCircle2 className="w-4 h-4 text-amber-400" />
          </div>
          <div className="font-bebas text-4xl tracking-wider text-amber-400 leading-none">{isConnected ? decentDeals.length : 0}</div>
          <div className="font-dm text-xs text-muted-foreground mt-1">decent deals</div>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-start justify-between mb-3">
            <span className="font-dm text-xs text-muted-foreground uppercase tracking-wider">Total Value</span>
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <div className="font-bebas text-4xl tracking-wider text-foreground leading-none">
            ${totalValue > 0 ? (totalValue / 1000).toFixed(0) + 'K' : '0'}
          </div>
          <div className="font-dm text-xs text-muted-foreground mt-1">inventory value</div>
        </div>
      </div>

      {/* Hot Deals Section - Only show when connected and has hot deals */}
      {isConnected && hotDeals.length > 0 && (
        <div className="bg-card border border-green-500/20 rounded-lg p-5 bg-green-500/5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-green-500" />
              <h2 className="font-bebas text-xl tracking-wider text-foreground">HOT DEALS - POST NOW</h2>
            </div>
            <Button
              size="sm"
              className="text-xs bg-blue-400/20 text-blue-400 hover:bg-blue-400/30 border border-blue-400/30"
              onClick={() => onNavigate('connect-inventory')}
            >
              View All
            </Button>
          </div>
          <div className="space-y-2">
            {hotDeals.slice(0, 5).map((v) => (
              <HotDealCard
                key={v.id}
                v={v}
                expanded={expandedId === v.id}
                onToggle={() => setExpandedId(expandedId === v.id ? null : v.id)}
                onPost={setModal}
              />
            ))}
          </div>
        </div>
      )}

      {/* Charts row - Always visible */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inventory Status donut */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="font-bebas text-xl tracking-wider text-foreground mb-4">DEAL BREAKDOWN</h2>
          <div className="relative flex flex-col items-center">
            <div className="relative w-full" style={{ height: 180 }}>
              {donutData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {donutData.map((entry) => (
                        <Cell key={entry.name} fill={DONUT_COLORS[entry.name] ?? '#888'} />
                      ))}
                    </Pie>
                    <Tooltip {...tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-40 h-40 rounded-full border-[16px] border-muted/30 flex items-center justify-center">
                    <div className="text-center">
                      <span className="font-bebas text-3xl tracking-wider text-muted-foreground leading-none">0</span>
                      <br />
                      <span className="font-dm text-xs text-muted-foreground">total</span>
                    </div>
                  </div>
                </div>
              )}
              {donutData.length > 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="font-bebas text-3xl tracking-wider text-foreground leading-none">{totalInventory}</span>
                  <span className="font-dm text-xs text-muted-foreground">total</span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap justify-center gap-4 mt-2">
              {donutData.length > 0 ? (
                donutData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-1.5">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: DONUT_COLORS[entry.name] ?? '#888' }}
                    />
                    <span className="font-dm text-xs text-muted-foreground">{entry.name}</span>
                    <span className="font-dm text-xs text-foreground font-medium">{entry.value}</span>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500/30" />
                    <span className="font-dm text-xs text-muted-foreground">Hot Deals</span>
                    <span className="font-dm text-xs text-muted-foreground">0</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400/30" />
                    <span className="font-dm text-xs text-muted-foreground">Decent</span>
                    <span className="font-dm text-xs text-muted-foreground">0</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500/30" />
                    <span className="font-dm text-xs text-muted-foreground">Skip</span>
                    <span className="font-dm text-xs text-muted-foreground">0</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Avg Price by Body Type */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="font-bebas text-xl tracking-wider text-foreground mb-4">AVG PRICE BY TYPE</h2>
          {avgPriceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={avgPriceData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                    <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.8} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                <XAxis
                  dataKey="type"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontFamily: 'var(--font-dm)' }}
                  axisLine={false}
                  tickLine={false}
                  dy={5}
                />
                <YAxis
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                  axisLine={false}
                  tickLine={false}
                  width={45}
                />
                <Tooltip
                  formatter={(value: number | undefined) => [`$${(value ?? 0).toLocaleString()}`, 'Avg Price']}
                  cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                  {...tooltipStyle}
                />
                <Bar
                  dataKey="avgPrice"
                  fill="url(#priceGradient)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={50}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-44">
              <p className="font-dm text-sm text-muted-foreground">No data yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Inventory Breakdown - Always visible */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="font-bebas text-xl tracking-wider text-foreground mb-4">INVENTORY BY BODY TYPE</h2>
        {bodyTypeCountData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              layout="vertical"
              data={bodyTypeCountData}
              margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
            >
              <defs>
                <linearGradient id="countGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#16a34a" stopOpacity={1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="type"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontFamily: 'var(--font-dm)' }}
                axisLine={false}
                tickLine={false}
                width={75}
              />
              <Tooltip
                formatter={(value: number | string | undefined) => [value ?? 0, 'Vehicles']}
                cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                {...tooltipStyle}
              />
              <Bar
                dataKey="count"
                fill="url(#countGradient)"
                radius={[0, 6, 6, 0]}
                maxBarSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-48">
            <p className="font-dm text-sm text-muted-foreground">No data yet</p>
          </div>
        )}
      </div>

      {/* Post Modal */}
      {modal && <PostModal vehicle={modal} onClose={() => setModal(null)} />}
    </div>
  );
}
