import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Car,
  MessageSquare,
  CalendarCheck,
  TrendingUp,
  Zap,
  Pause,
  Play,
  Facebook,
  AlertCircle,
  Loader2,
  Settings2,
  Globe,
  Clock,
  Users,
  BadgeDollarSign,
  BarChart3,
  ArrowUpRight,
  Flame,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { ActiveView } from './types';
import { getBackendUrl } from '@/lib/backend-url';
import { cn } from '@/lib/utils';

interface DashboardViewProps {
  onNavigate: (view: ActiveView) => void;
}

interface AutomationStatus {
  automation: { enabled: boolean; postingEnabled: boolean; replyEnabled: boolean };
  facebook: { connected: boolean; lastUsedAt: string | null };
  stats: {
    totalVehicles: number;
    postsToday: number;
    postsThirtyDays: number;
    messagesThirtyDays: number;
    appointmentsThirtyDays: number;
    pendingTasks: number;
    failedTasks: number;
  };
}

interface ActivityItem {
  type: 'post' | 'message' | 'appointment';
  id: string;
  title: string;
  subtitle: string;
  status: string;
  timestamp: string;
}

interface ChartPoint {
  date: string;
  label: string;
  count: number;
}

interface DashboardData {
  postingChart: ChartPoint[];
  messagesChart: ChartPoint[];
  pipeline: Record<string, number>;
  totals: {
    totalPosted: number;
    totalVehicles: number;
    soldVehicles: number;
    newMessagesLast7d: number;
    appointmentCount: number;
    totalLeads: number;
  };
}

export function DashboardView({ onNavigate }: DashboardViewProps) {
  const [status, setStatus] = useState<AutomationStatus | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [statusRes, activityRes, dashRes] = await Promise.all([
        fetch(`${getBackendUrl()}/api/automation/status`, { credentials: 'include' }),
        fetch(`${getBackendUrl()}/api/automation/activity?limit=10`, { credentials: 'include' }),
        fetch(`${getBackendUrl()}/api/automation/dashboard`, { credentials: 'include' }),
      ]);
      const s = await statusRes.json();
      const a = await activityRes.json();
      const d = await dashRes.json();
      if (s.data) setStatus(s.data);
      if (a.data) setActivity(a.data);
      if (d.data) setDashboard(d.data);
    } catch {
      // silently fail on first load
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const handleToggle = async () => {
    setToggling(true);
    try {
      const newState = !status?.automation.enabled;
      await fetch(`${getBackendUrl()}/api/automation/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled: newState }),
      });
      toast.success(newState ? 'Automation activated' : 'Automation paused');
      fetchAll();
    } catch {
      toast.error('Failed to toggle automation');
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isLive = status?.automation.enabled;
  const fbConnected = status?.facebook.connected;
  const needsSetup = !status || (!fbConnected && !isLive);

  if (needsSetup) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="font-bebas text-4xl tracking-wider text-foreground leading-none">Home</h1>
          <p className="font-dm text-sm text-muted-foreground mt-1">
            Facebook Marketplace Autopost & Messenger Auto-Reply
          </p>
        </div>

        <div className="bg-card border border-primary/20 rounded-xl p-8 bg-primary/5 max-w-2xl">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Zap className="w-7 h-7 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-bebas text-2xl tracking-wider text-foreground mb-2">Set Up Automation</h3>
              <p className="font-dm text-sm text-muted-foreground mb-4">
                Connect your dealer website and Facebook account. We'll auto-post inventory and reply to buyer messages 24/7 — zero manual effort.
              </p>
              <Button
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-dm font-bold gap-2"
                onClick={() => onNavigate('onboarding')}
              >
                <Zap className="w-4 h-4" />
                Get Started — 3 Steps
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl">
          <div className="p-5 bg-card border border-border rounded-xl">
            <Globe className="w-5 h-5 text-[#1877F2] mb-3" />
            <h4 className="font-bebas text-lg tracking-wider">01. Connect</h4>
            <p className="font-dm text-xs text-muted-foreground mt-1">Upload your URL once — inventory syncs automatically.</p>
          </div>
          <div className="p-5 bg-card border border-border rounded-xl">
            <Settings2 className="w-5 h-5 text-primary mb-3" />
            <h4 className="font-bebas text-lg tracking-wider">02. Set Rules</h4>
            <p className="font-dm text-xs text-muted-foreground mt-1">Define posting hours, reply tone, and frequency.</p>
          </div>
          <div className="p-5 bg-card border border-border rounded-xl">
            <TrendingUp className="w-5 h-5 text-green-500 mb-3" />
            <h4 className="font-bebas text-lg tracking-wider">03. Go Live</h4>
            <p className="font-dm text-xs text-muted-foreground mt-1">Listings, replies, and bookings run on autopilot.</p>
          </div>
        </div>
      </div>
    );
  }

  const stats = status!.stats;
  const totals = dashboard?.totals;
  const postingChart = dashboard?.postingChart ?? [];
  const messagesChart = dashboard?.messagesChart ?? [];
  const pipeline = dashboard?.pipeline ?? {};

  const postChartMax = Math.max(...postingChart.map((p) => p.count), 1);
  const msgChartMax = Math.max(...messagesChart.map((p) => p.count), 1);

  const pipelineStages = [
    { key: 'new', label: 'New Leads', color: 'bg-blue-500', textColor: 'text-blue-400' },
    { key: 'contacted', label: 'Contacted', color: 'bg-violet-500', textColor: 'text-violet-400' },
    { key: 'appointment', label: 'Appointment', color: 'bg-amber-500', textColor: 'text-amber-400' },
    { key: 'hot', label: 'Hot', color: 'bg-red-500', textColor: 'text-red-400' },
    { key: 'warm', label: 'Warm', color: 'bg-orange-500', textColor: 'text-orange-400' },
    { key: 'converted', label: 'Converted', color: 'bg-green-500', textColor: 'text-green-400' },
    { key: 'lost', label: 'Lost', color: 'bg-zinc-500', textColor: 'text-zinc-400' },
  ];

  const pipelineTotal = useMemo(
    () => Object.values(pipeline).reduce((s, n) => s + n, 0),
    [pipeline]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bebas text-4xl tracking-wider text-foreground leading-none">Dashboard</h1>
          <p className="font-dm text-sm text-muted-foreground mt-1">Automation overview</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="font-dm gap-2" onClick={() => onNavigate('dealer-logic')}>
            <Settings2 className="w-4 h-4" /> Settings
          </Button>
          <Button
            size="sm"
            className={cn(
              'font-dm font-bold gap-2',
              isLive
                ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
                : 'bg-green-600 text-white hover:bg-green-700'
            )}
            onClick={handleToggle}
            disabled={toggling}
          >
            {toggling ? <Loader2 className="w-4 h-4 animate-spin" /> : isLive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isLive ? 'Pause' : 'Activate'}
          </Button>
        </div>
      </div>

      {/* Live status banner */}
      <div className={cn(
        'flex items-center gap-3 px-5 py-3 rounded-xl border',
        isLive ? 'bg-green-500/5 border-green-500/20' : 'bg-yellow-500/5 border-yellow-500/20'
      )}>
        <div className={cn('w-2.5 h-2.5 rounded-full', isLive ? 'bg-green-500 animate-pulse' : 'bg-yellow-500')} />
        <span className={cn('font-dm text-sm font-medium', isLive ? 'text-green-400' : 'text-yellow-400')}>
          {isLive ? 'Automation is live' : 'Automation paused'}
        </span>
        {fbConnected ? (
          <span className="font-dm text-xs text-muted-foreground ml-auto flex items-center gap-1.5">
            <Facebook className="w-3.5 h-3.5" /> Connected
          </span>
        ) : (
          <span className="font-dm text-xs text-yellow-400 ml-auto flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" /> Facebook not connected
          </span>
        )}
      </div>

      {/* ── Big Stats Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <BigStat
          icon={Car}
          label="Total Posted"
          value={totals?.totalPosted ?? stats.postsThirtyDays}
          delta={`${stats.postsToday} today`}
          color="text-[#1877F2]"
          bg="bg-[#1877F2]/8"
        />
        <BigStat
          icon={MessageSquare}
          label="New Messages"
          value={totals?.newMessagesLast7d ?? 0}
          delta="last 7 days"
          color="text-green-500"
          bg="bg-green-500/8"
        />
        <BigStat
          icon={Users}
          label="Total Leads"
          value={totals?.totalLeads ?? 0}
          delta={`${pipeline['hot'] ?? 0} hot`}
          color="text-violet-500"
          bg="bg-violet-500/8"
        />
        <BigStat
          icon={CalendarCheck}
          label="Appointments"
          value={totals?.appointmentCount ?? stats.appointmentsThirtyDays}
          delta="last 30 days"
          color="text-primary"
          bg="bg-primary/8"
        />
        <BigStat
          icon={BadgeDollarSign}
          label="Sold"
          value={totals?.soldVehicles ?? 0}
          delta={`${totals?.totalVehicles ?? stats.totalVehicles} available`}
          color="text-emerald-500"
          bg="bg-emerald-500/8"
        />
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Posting Activity Chart */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#1877F2]" />
              <h3 className="font-dm text-sm font-medium">Listings Posted</h3>
            </div>
            <span className="font-dm text-[10px] text-muted-foreground">Last 7 days</span>
          </div>
          <div className="flex items-end gap-1.5 h-32">
            {postingChart.map((point) => (
              <div key={point.date} className="flex-1 flex flex-col items-center gap-1">
                <span className="font-dm text-[10px] text-muted-foreground">
                  {point.count > 0 ? point.count : ''}
                </span>
                <div
                  className="w-full rounded-t-md bg-[#1877F2]/70 hover:bg-[#1877F2] transition-colors min-h-[4px]"
                  style={{ height: `${Math.max((point.count / postChartMax) * 100, 4)}%` }}
                />
                <span className="font-dm text-[10px] text-muted-foreground">{point.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Messages Chart */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-green-500" />
              <h3 className="font-dm text-sm font-medium">Incoming Messages</h3>
            </div>
            <span className="font-dm text-[10px] text-muted-foreground">Last 7 days</span>
          </div>
          <div className="flex items-end gap-1.5 h-32">
            {messagesChart.map((point) => (
              <div key={point.date} className="flex-1 flex flex-col items-center gap-1">
                <span className="font-dm text-[10px] text-muted-foreground">
                  {point.count > 0 ? point.count : ''}
                </span>
                <div
                  className="w-full rounded-t-md bg-green-500/70 hover:bg-green-500 transition-colors min-h-[4px]"
                  style={{ height: `${Math.max((point.count / msgChartMax) * 100, 4)}%` }}
                />
                <span className="font-dm text-[10px] text-muted-foreground">{point.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Lead Pipeline Funnel ── */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-400" />
            <h3 className="font-dm text-sm font-medium">Lead Pipeline</h3>
          </div>
          <button
            onClick={() => onNavigate('leads-list')}
            className="font-dm text-xs text-primary hover:text-primary/80 flex items-center gap-1"
          >
            View all <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>

        {pipelineTotal === 0 ? (
          <div className="text-center py-8">
            <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="font-dm text-sm text-muted-foreground">No leads yet</p>
            <p className="font-dm text-xs text-muted-foreground mt-1">Leads will appear here once buyers message your listings.</p>
          </div>
        ) : (
          <>
            {/* Funnel bar */}
            <div className="flex h-10 rounded-lg overflow-hidden mb-4">
              {pipelineStages.map((stage) => {
                const count = pipeline[stage.key] ?? 0;
                if (count === 0) return null;
                const pct = (count / pipelineTotal) * 100;
                return (
                  <div
                    key={stage.key}
                    className={cn('relative flex items-center justify-center transition-all', stage.color)}
                    style={{ width: `${Math.max(pct, 5)}%` }}
                    title={`${stage.label}: ${count}`}
                  >
                    {pct > 10 && (
                      <span className="font-dm text-[10px] text-white font-bold">{count}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Stage breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {pipelineStages.map((stage) => {
                const count = pipeline[stage.key] ?? 0;
                return (
                  <div key={stage.key} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/40">
                    <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', stage.color)} />
                    <div className="min-w-0">
                      <p className={cn('font-bebas text-lg leading-none', stage.textColor)}>{count}</p>
                      <p className="font-dm text-[10px] text-muted-foreground truncate">{stage.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Quick Actions ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => onNavigate('connect-inventory')}
          className="text-left bg-card border border-border rounded-xl p-5 hover:border-primary/40 transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <Car className="w-5 h-5 text-[#1877F2]" />
            <h3 className="font-dm text-sm font-medium">Inventory</h3>
          </div>
          <p className="font-dm text-xs text-muted-foreground">View and manage synced vehicles.</p>
        </button>
        <button
          type="button"
          onClick={() => onNavigate('leads')}
          className="text-left bg-card border border-border rounded-xl p-5 hover:border-primary/40 transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <MessageSquare className="w-5 h-5 text-green-500" />
            <h3 className="font-dm text-sm font-medium">Conversations</h3>
          </div>
          <p className="font-dm text-xs text-muted-foreground">View AI replies and buyer messages.</p>
        </button>
        <button
          type="button"
          onClick={() => onNavigate('listing-analytics')}
          className="text-left bg-card border border-border rounded-xl p-5 hover:border-primary/40 transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <BarChart3 className="w-5 h-5 text-orange-400" />
            <h3 className="font-dm text-sm font-medium">Listing Analytics</h3>
          </div>
          <p className="font-dm text-xs text-muted-foreground">Track per-listing performance.</p>
        </button>
      </div>

      {/* ── Activity Feed ── */}
      {activity.length > 0 && (
        <div>
          <h2 className="font-bebas text-lg tracking-wider text-foreground mb-3">Recent Activity</h2>
          <div className="bg-card border border-border rounded-xl divide-y divide-border">
            {activity.slice(0, 8).map((item) => (
              <div key={`${item.type}-${item.id}`} className="flex items-center gap-3 px-4 py-3">
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                  item.type === 'post' ? 'bg-[#1877F2]/10' :
                  item.type === 'message' ? 'bg-green-500/10' :
                  'bg-primary/10'
                )}>
                  {item.type === 'post' && <Car className="w-4 h-4 text-[#1877F2]" />}
                  {item.type === 'message' && <MessageSquare className="w-4 h-4 text-green-500" />}
                  {item.type === 'appointment' && <CalendarCheck className="w-4 h-4 text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-dm text-sm truncate">{item.title}</p>
                  <p className="font-dm text-xs text-muted-foreground truncate">{item.subtitle}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className={cn(
                    'font-dm text-[10px] px-2 py-0.5 rounded border capitalize',
                    item.status === 'posted' || item.status === 'scheduled' ? 'bg-green-500/10 text-green-400 border-green-500/30' :
                    item.status === 'failed' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
                    'bg-muted text-muted-foreground border-border'
                  )}>
                    {item.status}
                  </span>
                  <p className="font-dm text-[10px] text-muted-foreground mt-0.5">
                    <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                    {formatRelativeTime(item.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BigStat({ icon: Icon, label, value, delta, color, bg }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  delta: string;
  color: string;
  bg: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col justify-between">
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center mb-3', bg)}>
        <Icon className={cn('w-4.5 h-4.5', color)} />
      </div>
      <p className="font-bebas text-3xl tracking-wider leading-none">{value.toLocaleString()}</p>
      <p className="font-dm text-xs font-medium mt-1">{label}</p>
      <p className="font-dm text-[10px] text-muted-foreground">{delta}</p>
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
