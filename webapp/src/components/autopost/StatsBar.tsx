import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import type { Vehicle, VehicleStatus, VehicleBodyType } from './types';

interface StatsBarProps {
  vehicles: Vehicle[];
}

const STATUS_COLORS: Record<VehicleStatus, string> = {
  Available: '#22c55e',
  Pending: '#eab308',
  Sold: '#ef4444',
};

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 px-3 py-2 bg-secondary rounded border border-border min-w-[90px]">
      <span className="font-dm text-[10px] text-muted-foreground uppercase tracking-wider whitespace-nowrap">
        {label}
      </span>
      <span
        className={
          accent
            ? 'font-bebas text-xl text-primary tracking-wide'
            : 'font-bebas text-xl text-foreground tracking-wide'
        }
      >
        {value}
      </span>
    </div>
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload?: { fill?: string } }>;
}

function DonutTooltip({ active, payload }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    const item = payload[0];
    return (
      <div className="bg-card border border-border rounded px-3 py-1.5 text-xs font-dm shadow-lg">
        <span style={{ color: item.payload?.fill }} className="font-semibold">
          {item.name}
        </span>
        <span className="text-muted-foreground ml-2">{item.value}</span>
      </div>
    );
  }
  return null;
}

function BarTooltip({ active, payload }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    const item = payload[0];
    return (
      <div className="bg-card border border-border rounded px-3 py-1.5 text-xs font-dm shadow-lg">
        <span className="text-foreground font-semibold">{item.name}</span>
        <span className="text-muted-foreground ml-2">{item.value} vehicles</span>
      </div>
    );
  }
  return null;
}

const BODY_TYPE_COLORS: Record<VehicleBodyType, string> = {
  Sedan: '#f97316',
  SUV: '#fb923c',
  Truck: '#fdba74',
  Coupe: '#c2410c',
  Van: '#9a3412',
  Convertible: '#ea580c',
};

export function StatsBar({ vehicles }: StatsBarProps) {
  const total = vehicles.length;
  const byStatus = (status: VehicleStatus) =>
    vehicles.filter((v) => v.status === status).length;

  const available = byStatus('Available');
  const sold = byStatus('Sold');
  const pending = byStatus('Pending');

  const availableVehicles = vehicles.filter((v) => v.status === 'Available');
  const totalValue = availableVehicles.reduce((sum, v) => sum + v.price, 0);

  // Donut chart data
  const statusData = [
    { name: 'Available', value: available, fill: STATUS_COLORS.Available },
    { name: 'Pending', value: pending, fill: STATUS_COLORS.Pending },
    { name: 'Sold', value: sold, fill: STATUS_COLORS.Sold },
  ].filter((d) => d.value > 0);

  // Body type bar chart data
  const bodyTypeCounts = vehicles.reduce<Record<string, number>>((acc, v) => {
    acc[v.bodyType] = (acc[v.bodyType] ?? 0) + 1;
    return acc;
  }, {});

  const bodyTypeData = (Object.entries(bodyTypeCounts) as [VehicleBodyType, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({
      name: type,
      count,
      fill: BODY_TYPE_COLORS[type] ?? '#f97316',
    }));

  // Sparkline data: sort available vehicles by price for area chart
  const sparklineData = availableVehicles
    .sort((a, b) => a.price - b.price)
    .map((v, i) => ({ i, price: v.price }));

  return (
    <div className="flex flex-col gap-4">
      {/* Stat Cards Row */}
      <div className="flex flex-wrap gap-2">
        <StatCard label="Total Inventory" value={total} />
        <StatCard label="Available" value={available} accent />
        <StatCard label="Pending" value={pending} />
        <StatCard label="Sold" value={sold} />
        <StatCard
          label="Inventory Value"
          value={`$${(totalValue / 1000).toFixed(0)}K`}
          accent
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

        {/* Donut Chart — Status Breakdown */}
        <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-2">
          <span className="font-bebas text-sm tracking-widest text-muted-foreground uppercase">
            Status Breakdown
          </span>
          <div className="flex items-center gap-4">
            <div className="w-[110px] h-[110px] flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={32}
                    outerRadius={50}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {statusData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<DonutTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-2 flex-1">
              {statusData.map((entry) => (
                <div key={entry.name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: entry.fill }}
                    />
                    <span className="font-dm text-xs text-muted-foreground">{entry.name}</span>
                  </div>
                  <span className="font-bebas text-base tracking-wide" style={{ color: entry.fill }}>
                    {entry.value}
                  </span>
                </div>
              ))}
              {total > 0 && (
                <div className="mt-1 pt-1 border-t border-border">
                  <span className="font-dm text-[10px] text-muted-foreground">
                    {available > 0 ? Math.round((available / total) * 100) : 0}% available
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bar Chart — Body Type Distribution */}
        <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-2">
          <span className="font-bebas text-sm tracking-widest text-muted-foreground uppercase">
            Body Types
          </span>
          <div className="flex-1" style={{ minHeight: 110 }}>
            <ResponsiveContainer width="100%" height={110}>
              <BarChart
                data={bodyTypeData}
                layout="vertical"
                margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
                barSize={10}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontFamily: 'DM Sans, sans-serif' }}
                  axisLine={false}
                  tickLine={false}
                  width={62}
                />
                <Tooltip content={<BarTooltip />} cursor={{ fill: 'hsl(var(--secondary))' }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {bodyTypeData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Inventory Value Sparkline */}
        <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-2">
          <span className="font-bebas text-sm tracking-widest text-muted-foreground uppercase">
            Inventory Value
          </span>
          <div className="flex flex-col gap-1">
            <span className="font-bebas text-3xl text-primary tracking-wide leading-none">
              ${(totalValue / 1000).toFixed(0)}
              <span className="text-xl text-muted-foreground">K</span>
            </span>
            <span className="font-dm text-[10px] text-muted-foreground">
              {availableVehicles.length} available vehicles
            </span>
          </div>
          {sparklineData.length > 1 ? (
            <div style={{ height: 56 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparklineData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="sparkGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#sparkGradient)"
                    dot={false}
                    isAnimationActive={true}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-14 flex items-center">
              <span className="font-dm text-xs text-muted-foreground">No price data</span>
            </div>
          )}
          <div className="flex justify-between font-dm text-[10px] text-muted-foreground">
            {availableVehicles.length > 0 && (
              <>
                <span>Low: ${Math.min(...availableVehicles.map((v) => v.price)).toLocaleString()}</span>
                <span>High: ${Math.max(...availableVehicles.map((v) => v.price)).toLocaleString()}</span>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
