import { useState, useEffect } from 'react';
import { Plus, Search, Send, Pencil, Filter, BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { StatsBar } from './StatsBar';
import { VehicleModal } from './VehicleModal';
import { VehicleDetailDrawer } from './VehicleDetailDrawer';
import { fetchVehicleAnalysis } from './marketCache';
import type { Vehicle, VehicleStatus } from './types';

interface InventoryTableProps {
  vehicles: Vehicle[];
  onVehiclesChange: (vehicles: Vehicle[]) => void;
  onPostVehicle: (vehicle: Vehicle) => void;
}

const statusStyles: Record<VehicleStatus, string> = {
  Available: 'bg-green-500/15 text-green-400 border-green-500/30',
  Pending: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  Sold: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const bodyTypeEmoji: Record<string, string> = {
  Sedan: '🚗',
  SUV: '🚙',
  Truck: '🛻',
  Coupe: '🏎️',
  Van: '🚐',
  Convertible: '🚘',
};

export function InventoryTable({
  vehicles,
  onVehiclesChange,
  onPostVehicle,
}: InventoryTableProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | 'All'>('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [drawerVehicle, setDrawerVehicle] = useState<Vehicle | null>(null);

  // Background pre-warm: silently fetch analysis for all available vehicles
  // so drawer opens are instant (results served from cache)
  useEffect(() => {
    const available = vehicles.filter((v) => v.status === 'Available');
    // Stagger requests slightly to avoid hammering the API simultaneously
    available.forEach((v, i) => {
      setTimeout(() => { void fetchVehicleAnalysis(v, 100); }, i * 800);
    });
  // Only run on initial mount or when vehicle IDs change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicles.map(v => v.id).join(',')]);

  const filtered = vehicles.filter((v) => {
    const matchSearch =
      search.trim() === '' ||
      `${v.year} ${v.make} ${v.model} ${v.trim} ${v.color} ${v.vin}`
        .toLowerCase()
        .includes(search.toLowerCase());
    const matchStatus =
      statusFilter === 'All' || v.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleSave = (data: Omit<Vehicle, 'id'> & { id?: number }) => {
    if (data.id !== undefined) {
      onVehiclesChange(
        vehicles.map((v) => (v.id === data.id ? { ...data, id: data.id } : v))
      );
    } else {
      const newId = Math.max(0, ...vehicles.map((v) => v.id)) + 1;
      onVehiclesChange([...vehicles, { ...data, id: newId }]);
    }
  };

  const openAdd = () => {
    setEditingVehicle(null);
    setModalOpen(true);
  };

  const openEdit = (v: Vehicle) => {
    setEditingVehicle(v);
    setModalOpen(true);
  };

  return (
    <div className="flex flex-col gap-5 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-bebas text-3xl tracking-wider text-foreground">
            VEHICLE INVENTORY
          </h1>
          <p className="font-dm text-sm text-muted-foreground mt-0.5">
            Manage your dealership stock
          </p>
        </div>
        <Button
          onClick={openAdd}
          className="bg-primary text-primary-foreground font-dm font-medium hover:bg-primary/90 gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Vehicle
        </Button>
      </div>

      {/* Stats */}
      <StatsBar vehicles={vehicles} />

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by make, model, VIN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-input border-border text-foreground font-dm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as VehicleStatus | 'All')}
          >
            <SelectTrigger className="w-36 bg-input border-border text-foreground font-dm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {(['All', 'Available', 'Pending', 'Sold'] as const).map((s) => (
                <SelectItem key={s} value={s} className="text-foreground font-dm">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-dm">
            <thead>
              <tr className="bg-secondary border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Vehicle
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                  Price
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                  Mileage
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                  Color
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden xl:table-cell">
                  VIN
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-muted-foreground font-dm"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-4xl">🔍</span>
                      <span>No vehicles found</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={openAdd}
                        className="mt-2 border-border"
                      >
                        Add your first vehicle
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((v) => (
                  <tr
                    key={v.id}
                    onClick={() => setDrawerVehicle(v)}
                    className="bg-card hover:bg-secondary/50 transition-colors duration-150 cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center text-base shrink-0">
                          {bodyTypeEmoji[v.bodyType] ?? '🚗'}
                        </div>
                        <div>
                          <div className="font-medium text-foreground">
                            {v.year} {v.make} {v.model}
                          </div>
                          <div className="text-xs text-muted-foreground">{v.trim}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-foreground hidden sm:table-cell">
                      ${v.price.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell">
                      {v.mileage.toLocaleString()} mi
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                      {v.color}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs hidden xl:table-cell">
                      {v.vin}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className={cn(
                          'text-xs font-medium border',
                          statusStyles[v.status]
                        )}
                      >
                        {v.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); setDrawerVehicle(v); }}
                          variant="outline"
                          className="border-border text-muted-foreground hover:text-foreground gap-1.5 font-dm text-xs"
                        >
                          <BarChart2 className="w-3 h-3" />
                          <span className="hidden sm:inline">Analysis</span>
                        </Button>
                        <Button
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); onPostVehicle(v); }}
                          disabled={v.status === 'Sold'}
                          className="bg-blue-600 hover:bg-blue-500 text-white gap-1.5 font-dm text-xs disabled:opacity-40"
                        >
                          <Send className="w-3 h-3" />
                          <span className="hidden sm:inline">Post to FB</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => { e.stopPropagation(); openEdit(v); }}
                          className="border-border text-muted-foreground hover:text-foreground gap-1.5 font-dm text-xs"
                        >
                          <Pencil className="w-3 h-3" />
                          <span className="hidden sm:inline">Edit</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <VehicleModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        vehicle={editingVehicle}
        onSave={handleSave}
      />

      <VehicleDetailDrawer
        vehicle={drawerVehicle}
        allVehicles={vehicles}
        onClose={() => setDrawerVehicle(null)}
        onEdit={(v) => { setDrawerVehicle(null); openEdit(v); }}
        onPost={(v) => { setDrawerVehicle(null); onPostVehicle(v); }}
      />
    </div>
  );
}
