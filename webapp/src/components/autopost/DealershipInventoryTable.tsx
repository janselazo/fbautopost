import { useState } from 'react';
import { Link2, Search, Filter } from 'lucide-react';
import { useDealership, type DealershipVehicle } from './DealershipContext';

interface DealershipInventoryTableProps {
  onNavigateToConnect: () => void;
}

const FBIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="11" fill="#1877F2" />
    <path
      d="M16.5 6H14.25C13.01 6 12 7.01 12 8.25V10.5H9.75V13.5H12V21H15V13.5H17.25L18 10.5H15V8.625C15 8.28 15.28 8 15.625 8H16.5V6Z"
      fill="white"
    />
  </svg>
);

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

  if (v.drivetrain === "SH-AWD" || v.drivetrain === "AWD" || v.drivetrain === "4WD")
    desc += `${v.drivetrain} for confident handling in any conditions.\n`;
  if (v.engine?.includes("Turbo")) desc += `Turbocharged performance.\n`;
  if (v.is_certified) desc += `Certified Pre-Owned with manufacturer warranty.\n`;
  if (v.fuel_type === "Hybrid") desc += `Hybrid efficiency — save on gas in Miami traffic.\n`;

  desc += `\nThoroughly inspected and ready to go.\n\n`;
  desc += `📍 Doral, FL 33172\n📱 Message for details\n💰 Financing available\n`;
  desc += `\n#${v.make} #${v.model} #Miami #Doral #305CarDeals #UsedCars`;

  return desc;
}

function PostModal({ vehicle, onClose }: { vehicle: DealershipVehicle; onClose: () => void }) {
  const [cp, setCp] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const listing = generateListing(vehicle);

  const copy = (t: string, f: string) => {
    navigator.clipboard.writeText(t).catch(() => {});
    setCp(f);
    setTimeout(() => setCp(null), 1800);
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
            <span className="text-sm font-bold text-foreground font-dm">Post to Marketplace</span>
            <span className="text-xs text-muted-foreground/30">
              — {vehicle.year} {vehicle.make} {vehicle.model}
            </span>
          </div>
          <button onClick={onClose} className="bg-transparent border-none text-muted-foreground cursor-pointer text-lg">
            ✕
          </button>
        </div>

        <div className="p-5">
          <div className="flex gap-1 mb-4">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`flex-1 h-0.5 rounded-sm transition-colors ${step >= s ? "bg-[#1877F2]" : "bg-muted"}`}
              />
            ))}
          </div>

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
                    <div className="text-[9px] text-muted-foreground font-semibold">{l}</div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-foreground font-semibold font-mono">{v}</span>
                      <span className={`text-[9px] ${cp === l ? "text-green-500" : "text-muted-foreground/30"}`}>
                        {cp === l ? "✓" : "copy"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => copy(fields.map(([l, v]) => `${l}: ${v}`).join("\n"), "all")}
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

          {step === 3 && (
            <>
              <div className="text-center py-4">
                <div className="text-4xl mb-2">🚀</div>
                <div className="text-base font-bold text-foreground mb-1">Ready to Post</div>
                <div className="text-xs text-muted-foreground max-w-[380px] mx-auto leading-5">
                  Open Facebook Marketplace, paste the details and description you copied, add your photos, and publish.
                </div>
              </div>
              <a
                href="https://www.facebook.com/marketplace/create/vehicle"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-[#1877F2] border-none rounded-lg py-3 text-white text-sm font-bold cursor-pointer no-underline mb-3"
              >
                <FBIcon /> Open Facebook Marketplace
              </a>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setStep(2)}
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

export function DealershipInventoryTable({ onNavigateToConnect }: DealershipInventoryTableProps) {
  const { isConnected, dealer, inventory, hotDeals, decentDeals, skipDeals } = useDealership();
  const [filter, setFilter] = useState<'all' | 'hot' | 'decent' | 'skip'>('all');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<DealershipVehicle | null>(null);

  // If not connected, show connect prompt
  if (!isConnected) {
    return (
      <div className="animate-fadeIn">
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Link2 className="w-8 h-8 text-primary" />
          </div>
          <h2 className="font-bebas text-2xl tracking-wider text-foreground mb-2">
            CONNECT YOUR DEALERSHIP
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-8">
            Connect your dealership to automatically import your inventory with competitive market analysis and AI-powered scoring.
          </p>
          <button
            onClick={onNavigateToConnect}
            className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors"
          >
            Connect Dealership
          </button>
        </div>
      </div>
    );
  }

  const filtered = filter === 'all'
    ? inventory
    : filter === 'hot'
      ? hotDeals
      : filter === 'decent'
        ? decentDeals
        : skipDeals;

  const searchFiltered = search
    ? filtered.filter(v =>
        `${v.year} ${v.make} ${v.model} ${v.trim}`.toLowerCase().includes(search.toLowerCase()) ||
        v.vin.toLowerCase().includes(search.toLowerCase())
      )
    : filtered;

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-bebas text-3xl tracking-wider text-foreground">INVENTORY</h1>
          <p className="text-sm text-muted-foreground">
            {dealer?.name} · {inventory.length} vehicles
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search vehicles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-input border border-border rounded-lg pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary w-full md:w-64"
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'HOT DEALS', value: hotDeals.length, color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/20' },
          { label: 'DECENT', value: decentDeals.length, color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20' },
          { label: 'SKIP', value: skipDeals.length, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' },
          { label: 'TOTAL VALUE', value: `$${(inventory.reduce((a, v) => a + v.price, 0) / 1000).toFixed(0)}K`, color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20' },
        ].map((stat, i) => (
          <div key={i} className={`${stat.bg} border ${stat.border} rounded-lg px-4 py-3`}>
            <div className={`text-[9px] font-bold tracking-widest ${stat.color}`}>{stat.label}</div>
            <div className="text-2xl font-extrabold text-foreground font-mono">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <Filter className="w-4 h-4 text-muted-foreground self-center" />
        {[
          { key: 'all', label: `All (${inventory.length})` },
          { key: 'hot', label: `🟢 Hot (${hotDeals.length})` },
          { key: 'decent', label: `🟡 Decent (${decentDeals.length})` },
          { key: 'skip', label: `🔴 Skip (${skipDeals.length})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key as typeof filter)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold cursor-pointer border transition-all ${
              filter === key
                ? 'bg-muted border-border text-foreground'
                : 'bg-muted/30 border-transparent text-muted-foreground hover:border-border'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Vehicle</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase hidden md:table-cell">Status</th>
                <th className="text-right px-4 py-3 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Price</th>
                <th className="text-right px-4 py-3 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase hidden sm:table-cell">Miles</th>
                <th className="text-center px-4 py-3 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase hidden lg:table-cell">Score</th>
                <th className="text-right px-4 py-3 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Action</th>
              </tr>
            </thead>
            <tbody>
              {searchFiltered.map((v) => {
                const tierColor = v.tier === 'hot' ? 'text-green-500' : v.tier === 'decent' ? 'text-amber-400' : 'text-red-500';
                const tierBg = v.tier === 'hot' ? 'bg-green-500/20' : v.tier === 'decent' ? 'bg-amber-400/20' : 'bg-red-500/20';
                const tierLabel = v.tier === 'hot' ? 'HOT' : v.tier === 'decent' ? 'DECENT' : 'SKIP';
                const scoreColor = v.tier === 'hot' ? '#00C853' : v.tier === 'decent' ? '#FFB300' : '#E53935';

                return (
                  <tr key={v.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="text-sm font-semibold text-foreground">
                            {v.year} {v.make} {v.model}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {v.trim} · {v.exterior_color}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`${tierBg} ${tierColor} px-2 py-1 rounded text-[10px] font-bold tracking-wide`}>
                        {tierLabel}
                      </span>
                      {v.is_certified && (
                        <span className="ml-1.5 bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded text-[9px] font-bold">
                          CPO
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-sm font-bold text-foreground font-mono">
                        {v.price > 0 ? `$${v.price.toLocaleString()}` : <span className="text-muted-foreground text-xs font-semibold">Call for Price</span>}
                      </div>
                      {v.price > 0 && v.price_diff !== 0 && (
                        <div className={`text-[10px] font-semibold font-mono ${
                          v.price_diff > 0 ? 'text-green-500' : v.price_diff < -500 ? 'text-red-400' : 'text-amber-400'
                        }`}>
                          {v.price_diff > 0 ? '▼' : '▲'} ${Math.abs(v.price_diff).toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      <div className="text-sm text-foreground font-mono">{v.miles.toLocaleString()}</div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-1.5 rounded bg-muted overflow-hidden">
                          <div
                            className="h-full rounded"
                            style={{ width: `${v.score}%`, background: scoreColor }}
                          />
                        </div>
                        <span className="text-xs font-bold font-mono" style={{ color: scoreColor }}>
                          {v.score}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {v.tier !== 'skip' ? (
                        <button
                          onClick={() => setModal(v)}
                          className="bg-[#1877F2] text-white px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-[#1877F2]/90 transition-colors inline-flex items-center gap-1.5"
                        >
                          <FBIcon /> Post
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Reprice first</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {searchFiltered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">No vehicles found matching your criteria</p>
          </div>
        )}
      </div>

      {modal && <PostModal vehicle={modal} onClose={() => setModal(null)} />}
    </div>
  );
}
