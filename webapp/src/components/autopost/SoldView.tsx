import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BadgeDollarSign, Car, Search, Plus, X, TrendingUp, DollarSign } from 'lucide-react';
import { api } from '@/lib/api';
import type { Vehicle } from './types';

// Map common color names to Tailwind bg classes for the fallback placeholder
function colorToBg(color: string): string {
  const c = color.toLowerCase();
  if (c.includes('black')) return 'bg-zinc-900';
  if (c.includes('white') || c.includes('pearl')) return 'bg-zinc-200';
  if (c.includes('silver') || c.includes('grey') || c.includes('gray')) return 'bg-zinc-500';
  if (c.includes('red') || c.includes('crimson') || c.includes('burgundy')) return 'bg-red-700';
  if (c.includes('blue') || c.includes('navy') || c.includes('cobalt')) return 'bg-blue-700';
  if (c.includes('green') || c.includes('olive')) return 'bg-green-700';
  if (c.includes('brown') || c.includes('bronze') || c.includes('tan')) return 'bg-amber-800';
  if (c.includes('orange')) return 'bg-orange-600';
  if (c.includes('yellow') || c.includes('gold')) return 'bg-yellow-500';
  if (c.includes('purple') || c.includes('violet')) return 'bg-purple-700';
  return 'bg-zinc-700';
}

interface SoldVehicleCardProps {
  vehicle: BackendVehicle;
  formatSoldDate: (v: BackendVehicle) => string;
}

function SoldVehicleCard({ vehicle, formatSoldDate }: SoldVehicleCardProps) {
  const [imgError, setImgError] = useState(false);

  // Priority 1: real listing photo from MarketCheck
  // Priority 2: imagin.studio generic render
  // Priority 3: color-coded placeholder
  const realPhoto = vehicle.photoUrl && !imgError ? vehicle.photoUrl : null;
  const genericPhoto = !realPhoto && !imgError
    ? `https://cdn.imagin.studio/getimage?customer=img&make=${encodeURIComponent(vehicle.make.toLowerCase())}&modelFamily=${encodeURIComponent(vehicle.model.toLowerCase())}&modelYear=${vehicle.year}&angle=29`
    : null;

  const showPlaceholder = imgError && !vehicle.photoUrl;

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Photo banner — real listing photo, no text overlay */}
      <div className="relative h-44 overflow-hidden bg-zinc-900">
        {showPlaceholder ? (
          <div className={`w-full h-full ${colorToBg(vehicle.color)} flex items-center justify-center`}>
            <Car className="w-14 h-14 text-white/20" />
          </div>
        ) : (
          <img
            src={realPhoto || genericPhoto || ''}
            alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        )}
        {/* Sold ribbon — top-right corner only, no text overlay on photo */}
        <div className="absolute top-2 right-2">
          <span className="font-dm text-[10px] font-bold bg-green-500 text-white px-2 py-0.5 rounded-full shadow">
            SOLD
          </span>
        </div>
      </div>

      <div className="p-5 space-y-3">
        {/* Top row: name + sold badge */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-bebas text-xl tracking-wider text-foreground leading-tight">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </h3>
            <p className="font-dm text-xs text-muted-foreground mt-0.5">{vehicle.trim}</p>
          </div>
          <span className="shrink-0 font-dm text-xs font-semibold bg-green-500/15 text-green-500 border border-green-500/20 px-2.5 py-1 rounded-full">
            SOLD
          </span>
        </div>

        {/* Divider */}
        <div className="h-px bg-border" />

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <div>
            <p className="font-dm text-[10px] text-muted-foreground uppercase tracking-wider">Sale Price</p>
            <p className="font-dm text-sm font-semibold text-green-500">${vehicle.price.toLocaleString()}</p>
          </div>
          <div>
            <p className="font-dm text-[10px] text-muted-foreground uppercase tracking-wider">Mileage</p>
            <p className="font-dm text-sm text-foreground">{vehicle.mileage.toLocaleString()} mi</p>
          </div>
          <div>
            <p className="font-dm text-[10px] text-muted-foreground uppercase tracking-wider">Color</p>
            <p className="font-dm text-sm text-foreground">{vehicle.color}</p>
          </div>
          <div>
            <p className="font-dm text-[10px] text-muted-foreground uppercase tracking-wider">Sold Date</p>
            <p className="font-dm text-sm text-foreground">{formatSoldDate(vehicle)}</p>
          </div>
        </div>

        {/* VIN */}
        <div className="bg-secondary rounded px-3 py-2">
          <p className="font-dm text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">VIN</p>
          <p className="font-dm text-xs text-foreground font-mono break-all">{vehicle.vin}</p>
        </div>
      </div>
    </div>
  );
}

interface BackendVehicle {
  id: number;
  year: number;
  make: string;
  model: string;
  trim: string;
  price: number;
  mileage: number;
  color: string;
  vin: string;
  condition: 'Excellent' | 'Good' | 'Fair';
  bodyType: 'Sedan' | 'SUV' | 'Truck' | 'Coupe' | 'Van' | 'Convertible';
  status: 'Available' | 'Sold' | 'Pending';
  description: string;
  photoUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RecordSaleForm {
  year: string;
  make: string;
  model: string;
  trim: string;
  price: string;
  mileage: string;
  color: string;
  vin: string;
  condition: 'Excellent' | 'Good' | 'Fair';
  bodyType: 'Sedan' | 'SUV' | 'Truck' | 'Coupe' | 'Van' | 'Convertible';
  description: string;
}

const emptyForm: RecordSaleForm = {
  year: '',
  make: '',
  model: '',
  trim: '',
  price: '',
  mileage: '',
  color: '',
  vin: '',
  condition: 'Good',
  bodyType: 'Sedan',
  description: '',
};

export function SoldView({ vehicles }: { vehicles: Vehicle[] }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [yearMin, setYearMin] = useState('');
  const [yearMax, setYearMax] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<RecordSaleForm>(emptyForm);
  const [formError, setFormError] = useState('');

  // Fetch vehicles from backend
  const { data: backendVehicles = [] } = useQuery<BackendVehicle[]>({
    queryKey: ['vehicles'],
    queryFn: () => api.get<BackendVehicle[]>('/api/vehicles'),
    retry: 1,
  });

  // Mark as sold mutation
  const markSoldMutation = useMutation({
    mutationFn: (id: number) =>
      api.put<BackendVehicle>(`/api/vehicles/${id}`, { status: 'Sold' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });

  // Record a sale (POST) mutation
  const recordSaleMutation = useMutation({
    mutationFn: (payload: object) =>
      api.post<BackendVehicle>('/api/vehicles', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      setShowForm(false);
      setForm(emptyForm);
      setFormError('');
    },
    onError: (err: Error) => {
      setFormError(err.message || 'Failed to record sale');
    },
  });

  // Merge backend sold vehicles with prop vehicles filtered by Sold
  const propSold: BackendVehicle[] = vehicles
    .filter((v) => v.status === 'Sold')
    .map((v) => ({
      ...v,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

  const backendSold = backendVehicles.filter((v) => v.status === 'Sold');

  // Deduplicate by id — backend takes priority
  const backendIds = new Set(backendSold.map((v) => v.id));
  const mergedSold = [
    ...backendSold,
    ...propSold.filter((v) => !backendIds.has(v.id)),
  ];

  // Available vehicles from backend (for "Mark as Sold")
  const availableVehicles = backendVehicles.filter(
    (v) => v.status === 'Available' || v.status === 'Pending'
  );

  // Filter sold vehicles
  const filtered = mergedSold.filter((v) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      v.make.toLowerCase().includes(q) ||
      v.model.toLowerCase().includes(q) ||
      v.vin.toLowerCase().includes(q) ||
      String(v.year).includes(q);
    const matchesYearMin = !yearMin || v.year >= parseInt(yearMin);
    const matchesYearMax = !yearMax || v.year <= parseInt(yearMax);
    return matchesSearch && matchesYearMin && matchesYearMax;
  });

  // Summary stats
  const totalRevenue = mergedSold.reduce((sum, v) => sum + v.price, 0);
  const avgPrice =
    mergedSold.length > 0 ? Math.round(totalRevenue / mergedSold.length) : 0;
  const bestSale =
    mergedSold.length > 0 ? Math.max(...mergedSold.map((v) => v.price)) : 0;

  function formatSoldDate(v: BackendVehicle): string {
    const raw = v.updatedAt || v.createdAt;
    if (!raw) return '—';
    try {
      return new Date(raw).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '—';
    }
  }

  function handleFormChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleRecordSale(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    const yearNum = parseInt(form.year);
    const priceNum = parseFloat(form.price);
    const mileageNum = parseInt(form.mileage);
    if (!form.make || !form.model || !form.vin) {
      setFormError('Make, model, and VIN are required.');
      return;
    }
    if (isNaN(yearNum) || yearNum < 1900 || yearNum > 2030) {
      setFormError('Enter a valid year (1900–2030).');
      return;
    }
    if (isNaN(priceNum) || priceNum < 0) {
      setFormError('Enter a valid sale price.');
      return;
    }
    recordSaleMutation.mutate({
      year: yearNum,
      make: form.make,
      model: form.model,
      trim: form.trim || 'Base',
      price: priceNum,
      mileage: isNaN(mileageNum) ? 0 : mileageNum,
      color: form.color || 'Unknown',
      vin: form.vin,
      condition: form.condition,
      bodyType: form.bodyType,
      status: 'Sold',
      description: form.description || '',
    });
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-bebas text-4xl tracking-wider text-foreground leading-none">
            SOLD VEHICLES
          </h1>
          <p className="font-dm text-sm text-muted-foreground mt-1">
            Track completed sales and revenue from your inventory.
          </p>
        </div>
        <button
          onClick={() => { setShowForm((p) => !p); setFormError(''); }}
          className="shrink-0 flex items-center gap-2 bg-primary text-primary-foreground font-dm text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-primary/90 transition-colors"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'Record a Sale'}
        </button>
      </div>

      {/* Record a Sale form */}
      {showForm && (
        <div className="bg-card border border-border rounded-lg p-6 space-y-5">
          <h2 className="font-bebas text-xl tracking-wider text-foreground leading-none">
            RECORD A SALE
          </h2>
          <form onSubmit={handleRecordSale} className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="font-dm text-xs text-muted-foreground uppercase tracking-wider">Year *</label>
                <input
                  name="year"
                  value={form.year}
                  onChange={handleFormChange}
                  placeholder="2020"
                  className="w-full bg-secondary border border-border rounded-md px-3 py-2 font-dm text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-1">
                <label className="font-dm text-xs text-muted-foreground uppercase tracking-wider">Make *</label>
                <input
                  name="make"
                  value={form.make}
                  onChange={handleFormChange}
                  placeholder="Toyota"
                  className="w-full bg-secondary border border-border rounded-md px-3 py-2 font-dm text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-1">
                <label className="font-dm text-xs text-muted-foreground uppercase tracking-wider">Model *</label>
                <input
                  name="model"
                  value={form.model}
                  onChange={handleFormChange}
                  placeholder="Camry"
                  className="w-full bg-secondary border border-border rounded-md px-3 py-2 font-dm text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-1">
                <label className="font-dm text-xs text-muted-foreground uppercase tracking-wider">Trim</label>
                <input
                  name="trim"
                  value={form.trim}
                  onChange={handleFormChange}
                  placeholder="XSE"
                  className="w-full bg-secondary border border-border rounded-md px-3 py-2 font-dm text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="font-dm text-xs text-muted-foreground uppercase tracking-wider">Sale Price *</label>
                <input
                  name="price"
                  value={form.price}
                  onChange={handleFormChange}
                  placeholder="27500"
                  className="w-full bg-secondary border border-border rounded-md px-3 py-2 font-dm text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-1">
                <label className="font-dm text-xs text-muted-foreground uppercase tracking-wider">Mileage</label>
                <input
                  name="mileage"
                  value={form.mileage}
                  onChange={handleFormChange}
                  placeholder="28400"
                  className="w-full bg-secondary border border-border rounded-md px-3 py-2 font-dm text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-1">
                <label className="font-dm text-xs text-muted-foreground uppercase tracking-wider">Color</label>
                <input
                  name="color"
                  value={form.color}
                  onChange={handleFormChange}
                  placeholder="Black"
                  className="w-full bg-secondary border border-border rounded-md px-3 py-2 font-dm text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-1">
                <label className="font-dm text-xs text-muted-foreground uppercase tracking-wider">VIN *</label>
                <input
                  name="vin"
                  value={form.vin}
                  onChange={handleFormChange}
                  placeholder="4T1BF1FK5EU123456"
                  className="w-full bg-secondary border border-border rounded-md px-3 py-2 font-dm text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-dm text-xs text-muted-foreground uppercase tracking-wider">Condition</label>
                <select
                  name="condition"
                  value={form.condition}
                  onChange={handleFormChange}
                  className="w-full bg-secondary border border-border rounded-md px-3 py-2 font-dm text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Excellent">Excellent</option>
                  <option value="Good">Good</option>
                  <option value="Fair">Fair</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="font-dm text-xs text-muted-foreground uppercase tracking-wider">Body Type</label>
                <select
                  name="bodyType"
                  value={form.bodyType}
                  onChange={handleFormChange}
                  className="w-full bg-secondary border border-border rounded-md px-3 py-2 font-dm text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Sedan">Sedan</option>
                  <option value="SUV">SUV</option>
                  <option value="Truck">Truck</option>
                  <option value="Coupe">Coupe</option>
                  <option value="Van">Van</option>
                  <option value="Convertible">Convertible</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="font-dm text-xs text-muted-foreground uppercase tracking-wider">Notes</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleFormChange}
                placeholder="Optional notes about this sale..."
                rows={2}
                className="w-full bg-secondary border border-border rounded-md px-3 py-2 font-dm text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>
            {formError && (
              <p className="font-dm text-sm text-red-500">{formError}</p>
            )}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={recordSaleMutation.isPending}
                className="font-dm text-sm font-semibold bg-green-600 text-white px-5 py-2.5 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {recordSaleMutation.isPending ? 'Saving...' : 'Save Sale'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setForm(emptyForm); setFormError(''); }}
                className="font-dm text-sm text-muted-foreground hover:text-foreground transition-colors px-4 py-2.5"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-start justify-between mb-3">
            <span className="font-dm text-xs text-muted-foreground uppercase tracking-wider">Total Sold</span>
            <Car className="w-4 h-4 text-primary" />
          </div>
          <div className="font-bebas text-4xl tracking-wider text-foreground leading-none">
            {mergedSold.length}
          </div>
          <div className="font-dm text-xs text-muted-foreground mt-1">vehicles</div>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-start justify-between mb-3">
            <span className="font-dm text-xs text-muted-foreground uppercase tracking-wider">Total Revenue</span>
            <BadgeDollarSign className="w-4 h-4 text-green-500" />
          </div>
          <div className="font-bebas text-4xl tracking-wider text-green-500 leading-none">
            ${totalRevenue.toLocaleString()}
          </div>
          <div className="font-dm text-xs text-muted-foreground mt-1">from sold inventory</div>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-start justify-between mb-3">
            <span className="font-dm text-xs text-muted-foreground uppercase tracking-wider">Avg Sale Price</span>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="font-bebas text-4xl tracking-wider text-foreground leading-none">
            ${avgPrice.toLocaleString()}
          </div>
          <div className="font-dm text-xs text-muted-foreground mt-1">per vehicle</div>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-start justify-between mb-3">
            <span className="font-dm text-xs text-muted-foreground uppercase tracking-wider">Best Sale</span>
            <DollarSign className="w-4 h-4 text-green-500" />
          </div>
          <div className="font-bebas text-4xl tracking-wider text-green-500 leading-none">
            ${bestSale.toLocaleString()}
          </div>
          <div className="font-dm text-xs text-muted-foreground mt-1">highest sale</div>
        </div>
      </div>

      {/* Mark as Sold — available vehicles */}
      {availableVehicles.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <h2 className="font-bebas text-lg tracking-wider text-foreground leading-none">
            MARK AS SOLD
          </h2>
          <p className="font-dm text-xs text-muted-foreground">
            Select an inventory vehicle to record as sold.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {availableVehicles.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between bg-secondary border border-border rounded-lg px-4 py-3 gap-3"
              >
                <div className="min-w-0">
                  <p className="font-dm text-sm font-semibold text-foreground truncate">
                    {v.year} {v.make} {v.model}
                  </p>
                  <p className="font-dm text-xs text-muted-foreground">{v.trim} · ${v.price.toLocaleString()}</p>
                </div>
                <button
                  onClick={() => markSoldMutation.mutate(v.id)}
                  disabled={markSoldMutation.isPending}
                  className="shrink-0 font-dm text-xs font-semibold bg-green-500/15 text-green-500 border border-green-500/20 hover:bg-green-500/25 transition-colors px-3 py-1.5 rounded-full disabled:opacity-50"
                >
                  {markSoldMutation.isPending && markSoldMutation.variables === v.id
                    ? 'Saving...'
                    : 'Sold'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search / filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search make, model, VIN..."
            className="w-full bg-card border border-border rounded-lg pl-9 pr-4 py-2.5 font-dm text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex gap-2">
          <input
            value={yearMin}
            onChange={(e) => setYearMin(e.target.value)}
            placeholder="Year from"
            className="w-28 bg-card border border-border rounded-lg px-3 py-2.5 font-dm text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <input
            value={yearMax}
            onChange={(e) => setYearMax(e.target.value)}
            placeholder="Year to"
            className="w-28 bg-card border border-border rounded-lg px-3 py-2.5 font-dm text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Sold vehicle grid */}
      {filtered.length === 0 ? (
        mergedSold.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-16 flex flex-col items-center justify-center text-center">
            <Car className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <h3 className="font-bebas text-xl tracking-wider text-foreground mb-1">
              NO SOLD VEHICLES YET
            </h3>
            <p className="font-dm text-sm text-muted-foreground max-w-xs">
              No sold vehicles yet — mark a vehicle as Sold in Inventory to see it here.
            </p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg p-10 flex flex-col items-center justify-center text-center">
            <Search className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="font-dm text-sm text-muted-foreground">No results match your search.</p>
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((vehicle) => (
            <SoldVehicleCard key={vehicle.id} vehicle={vehicle} formatSoldDate={formatSoldDate} />
          ))}
        </div>
      )}
    </div>
  );
}
