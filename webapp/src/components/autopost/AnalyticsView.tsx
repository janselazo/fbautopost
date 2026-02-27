import { BarChart3, Eye, MousePointerClick, MessageSquare, TrendingUp } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  ReferenceLine,
} from 'recharts';
import type { Vehicle } from './types';

interface AnalyticsViewProps {
  vehicles: Vehicle[];
}

const postPerformanceData = [
  { day: 'Mon', views: 0 },
  { day: 'Tue', views: 0 },
  { day: 'Wed', views: 0 },
  { day: 'Thu', views: 0 },
  { day: 'Fri', views: 0 },
  { day: 'Sat', views: 0 },
  { day: 'Sun', views: 0 },
];

const leadsByTypeData = [
  { type: 'Sedan', leads: 0, color: '#f97316' },
  { type: 'SUV', leads: 0, color: '#3b82f6' },
  { type: 'Truck', leads: 0, color: '#10b981' },
  { type: 'Coupe', leads: 0, color: '#a855f7' },
  { type: 'Van', leads: 0, color: '#f59e0b' },
  { type: 'Conv.', leads: 0, color: '#ec4899' },
];

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  color: 'hsl(var(--foreground))',
  fontFamily: 'var(--font-dm)',
  fontSize: '12px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
};

const avgLeads = leadsByTypeData.reduce((s, d) => s + d.leads, 0) / leadsByTypeData.length;

export function AnalyticsView({ vehicles: _vehicles }: AnalyticsViewProps) {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-bebas text-4xl tracking-wider text-foreground leading-none">ANALYTICS</h1>
        <p className="font-dm text-sm text-muted-foreground mt-1">
          Performance insights for your Facebook Marketplace listings.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-start justify-between mb-3">
            <span className="font-dm text-xs text-muted-foreground uppercase tracking-wider">Total Posts</span>
            <BarChart3 className="w-4 h-4 text-primary" />
          </div>
          <div className="font-bebas text-4xl tracking-wider text-foreground leading-none">—</div>
          <div className="font-dm text-xs text-muted-foreground mt-1">this month</div>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-start justify-between mb-3">
            <span className="font-dm text-xs text-muted-foreground uppercase tracking-wider">Avg. Views / Post</span>
            <Eye className="w-4 h-4 text-blue-400" />
          </div>
          <div className="font-bebas text-4xl tracking-wider text-foreground leading-none">—</div>
          <div className="font-dm text-xs text-muted-foreground mt-1">impressions</div>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-start justify-between mb-3">
            <span className="font-dm text-xs text-muted-foreground uppercase tracking-wider">Click-Through Rate</span>
            <MousePointerClick className="w-4 h-4 text-green-500" />
          </div>
          <div className="font-bebas text-4xl tracking-wider text-muted-foreground leading-none">—</div>
          <div className="font-dm text-xs text-muted-foreground mt-1">of viewers clicked</div>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-start justify-between mb-3">
            <span className="font-dm text-xs text-muted-foreground uppercase tracking-wider">Messages Received</span>
            <MessageSquare className="w-4 h-4 text-yellow-400" />
          </div>
          <div className="font-bebas text-4xl tracking-wider text-foreground leading-none">—</div>
          <div className="font-dm text-xs text-muted-foreground mt-1">buyer inquiries</div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Line chart */}
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h2 className="font-bebas text-xl tracking-wider text-foreground">POST PERFORMANCE</h2>
          </div>
          <p className="font-dm text-xs text-muted-foreground mb-5">Views per day — last 7 days</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={postPerformanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="day"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontFamily: 'var(--font-dm)' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontFamily: 'var(--font-dm)' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: 'hsl(var(--border))' }} />
              <Line
                type="monotone"
                dataKey="views"
                stroke="#f97316"
                strokeWidth={2}
                dot={{ fill: '#f97316', r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#f97316' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Leads by Vehicle Type — improved */}
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              <h2 className="font-bebas text-xl tracking-wider text-foreground">LEADS BY VEHICLE TYPE</h2>
            </div>
          </div>
          <p className="font-dm text-xs text-muted-foreground mb-5">Buyer inquiries broken down by body style</p>

          {/* Color legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-4">
            {leadsByTypeData.map(d => (
              <div key={d.type} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
                <span className="font-dm text-[11px] text-muted-foreground">{d.type}</span>
              </div>
            ))}
          </div>

          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={leadsByTypeData} margin={{ top: 18, right: 10, left: -20, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="type"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontFamily: 'var(--font-dm)' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontFamily: 'var(--font-dm)' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: 'hsl(var(--secondary))', radius: 4 }}
                formatter={(value: number | undefined) => [value ?? 0, 'Leads']}
              />
              {avgLeads > 0 && (
                <ReferenceLine
                  y={avgLeads}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="4 3"
                  strokeWidth={1}
                  label={{
                    value: 'avg',
                    position: 'insideTopRight',
                    fill: 'hsl(var(--muted-foreground))',
                    fontSize: 10,
                    fontFamily: 'var(--font-dm)',
                  }}
                />
              )}
              <Bar dataKey="leads" radius={[4, 4, 0, 0]} maxBarSize={48}>
                {leadsByTypeData.map((entry) => (
                  <Cell key={entry.type} fill={entry.color} fillOpacity={0.85} />
                ))}
                <LabelList
                  dataKey="leads"
                  position="top"
                  style={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontFamily: 'var(--font-dm)' }}
                  formatter={(v: string | number | boolean | null | undefined) => (Number(v) > 0 ? v : '')}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
