import { useState, useEffect, useCallback } from 'react';
import {
  Car,
  ExternalLink,
  MessageSquare,
  Clock,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Trash2,
  ChevronLeft,
  Eye,
  BadgeDollarSign,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getBackendUrl } from '@/lib/backend-url';
import { cn } from '@/lib/utils';
import type { ActiveView } from './types';

interface ListingAnalyticsViewProps {
  onNavigate: (view: ActiveView) => void;
}

interface ListingData {
  id: string;
  vehicleId: number;
  vehicleName: string;
  vehicleVin: string;
  vehiclePrice: number;
  vehiclePhotoUrl: string | null;
  vehicleStatus: string;
  taskType: string;
  status: string;
  fbListingUrl: string | null;
  listingText: string | null;
  messagesReceived: number;
  attempts: number;
  scheduledFor: string | null;
  completedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  error: string | null;
  soldAt?: string;
  totalPosts?: number;
}

type StatusFilter = 'all' | 'posted' | 'queued' | 'failed' | 'deleted' | 'sold';

export function ListingAnalyticsView({ onNavigate }: ListingAnalyticsViewProps) {
  const [listings, setListings] = useState<ListingData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    task: ListingData;
    vehicle: Record<string, unknown>;
    history: { id: string; taskType: string; status: string; completedAt: string | null; createdAt: string; fbListingUrl: string | null }[];
    conversations: { id: string; buyerName: string; lastMessage: string; intentScore: number; status: string; lastMessageAt: string }[];
  } | null>(null);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(
        `${getBackendUrl()}/api/automation/listings?status=${filter}&limit=50`,
        { credentials: 'include' }
      );
      const j = await r.json();
      if (j.data) {
        setListings(j.data.listings);
        setTotal(j.data.total);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  const fetchDetail = async (id: string) => {
    setSelectedId(id);
    try {
      const r = await fetch(`${getBackendUrl()}/api/automation/listings/${id}`, { credentials: 'include' });
      const j = await r.json();
      if (j.data) setDetail(j.data);
    } catch {
      // silent
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'posted': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'queued': case 'posting': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'deleted': return <Trash2 className="w-4 h-4 text-muted-foreground" />;
      case 'sold': return <BadgeDollarSign className="w-4 h-4 text-emerald-400" />;
      default: return <AlertTriangle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      posted: 'bg-green-500/10 text-green-400 border-green-500/30',
      queued: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
      posting: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      failed: 'bg-red-500/10 text-red-400 border-red-500/30',
      deleted: 'bg-muted text-muted-foreground border-border',
      skipped: 'bg-muted text-muted-foreground border-border',
      sold: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    };
    return colors[status] || 'bg-muted text-muted-foreground border-border';
  };

  // Detail drawer
  if (selectedId && detail) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => { setSelectedId(null); setDetail(null); }}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground font-dm"
        >
          <ChevronLeft className="w-4 h-4" /> Back to listings
        </button>

        <div className="flex items-start gap-4">
          {detail.vehicle && (detail.vehicle as { photoUrl?: string }).photoUrl && (
            <img
              src={(detail.vehicle as { photoUrl: string }).photoUrl}
              alt=""
              className="w-32 h-24 rounded-lg object-cover shrink-0"
            />
          )}
          <div>
            <h1 className="font-bebas text-3xl tracking-wider">{detail.task.vehicleName}</h1>
            <p className="font-dm text-sm text-muted-foreground">
              VIN: {detail.task.vehicleVin} | ${detail.task.vehiclePrice?.toLocaleString()}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className={cn('font-dm text-[10px] px-2 py-0.5 rounded border capitalize', statusBadge(detail.task.status))}>
                {detail.task.status}
              </span>
              <span className={cn('font-dm text-[10px] px-2 py-0.5 rounded border', 'bg-muted text-muted-foreground border-border')}>
                {detail.task.taskType}
              </span>
            </div>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-card border border-border rounded-xl p-4">
            <MessageSquare className="w-5 h-5 text-green-500 mb-1" />
            <p className="font-bebas text-2xl">{detail.conversations.length}</p>
            <p className="font-dm text-xs text-muted-foreground">Conversations</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <RefreshCw className="w-5 h-5 text-[#1877F2] mb-1" />
            <p className="font-bebas text-2xl">{detail.history.length}</p>
            <p className="font-dm text-xs text-muted-foreground">Times posted</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <Eye className="w-5 h-5 text-primary mb-1" />
            <p className="font-bebas text-2xl">{detail.task.attempts}</p>
            <p className="font-dm text-xs text-muted-foreground">Attempts</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <Clock className="w-5 h-5 text-orange-400 mb-1" />
            <p className="font-bebas text-2xl">{detail.task.completedAt ? formatRelative(detail.task.completedAt) : '—'}</p>
            <p className="font-dm text-xs text-muted-foreground">Last posted</p>
          </div>
        </div>

        {/* FB Link */}
        {detail.task.fbListingUrl && (
          <a
            href={detail.task.fbListingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 bg-[#1877F2]/5 border border-[#1877F2]/20 rounded-lg hover:bg-[#1877F2]/10 transition-colors"
          >
            <ExternalLink className="w-4 h-4 text-[#1877F2]" />
            <span className="font-dm text-sm text-[#1877F2]">View on Facebook Marketplace</span>
          </a>
        )}

        {/* Posting history */}
        {detail.history.length > 0 && (
          <div>
            <h3 className="font-bebas text-lg tracking-wider mb-2">Posting History</h3>
            <div className="bg-card border border-border rounded-xl divide-y divide-border">
              {detail.history.map((h) => (
                <div key={h.id} className="flex items-center gap-3 px-4 py-3">
                  {statusIcon(h.status)}
                  <div className="flex-1">
                    <span className={cn('font-dm text-[10px] px-1.5 py-0.5 rounded border mr-2 capitalize', statusBadge(h.status))}>
                      {h.status}
                    </span>
                    <span className="font-dm text-xs text-muted-foreground capitalize">{h.taskType}</span>
                  </div>
                  <span className="font-dm text-xs text-muted-foreground">{formatRelative(h.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Conversations about this vehicle */}
        {detail.conversations.length > 0 && (
          <div>
            <h3 className="font-bebas text-lg tracking-wider mb-2">Buyer Conversations</h3>
            <div className="bg-card border border-border rounded-xl divide-y divide-border">
              {detail.conversations.map((conv) => (
                <div key={conv.id} className="flex items-center gap-3 px-4 py-3">
                  <MessageSquare className="w-4 h-4 text-green-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-dm text-sm truncate">{conv.buyerName}</p>
                    <p className="font-dm text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-dm text-[10px] text-muted-foreground">
                      Intent: {conv.intentScore}%
                    </div>
                    <div className="font-dm text-[10px] text-muted-foreground">
                      {formatRelative(conv.lastMessageAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bebas text-3xl tracking-wider text-foreground">Listing Analytics</h1>
          <p className="font-dm text-xs text-muted-foreground mt-0.5">
            Track every vehicle posted to Facebook Marketplace
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchListings} disabled={loading} className="font-dm gap-2">
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'posted', 'queued', 'failed', 'deleted', 'sold'] as StatusFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'font-dm text-xs px-3 py-1.5 rounded-full border capitalize transition-colors',
              filter === f
                ? 'bg-primary text-primary-foreground border-primary'
                : 'text-muted-foreground border-border hover:border-primary/40'
            )}
          >
            {f} {f === 'all' ? `(${total})` : ''}
          </button>
        ))}
      </div>

      {filter === 'sold' && !loading && listings.length > 0 && (
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-4">
          <BadgeDollarSign className="w-8 h-8 text-emerald-400 shrink-0" />
          <div>
            <p className="font-bebas text-xl tracking-wider text-emerald-400">{total} Sold Vehicle{total !== 1 ? 's' : ''}</p>
            <p className="font-dm text-xs text-muted-foreground">
              Vehicles marked as sold are automatically delisted from Facebook Marketplace.
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-16">
          <Car className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-dm text-sm text-muted-foreground">No listings found</p>
          <p className="font-dm text-xs text-muted-foreground mt-1">
            Listings will appear here once vehicles start posting to Facebook Marketplace.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {listings.map((listing) => {
            const isSold = listing.status === 'sold';
            const canDrillDown = !isSold || (isSold && !listing.id.startsWith('sold-'));
            return (
              <button
                key={listing.id}
                onClick={() => canDrillDown ? fetchDetail(listing.id) : undefined}
                className={cn(
                  "w-full text-left flex items-center gap-3 px-4 py-3 transition-colors",
                  canDrillDown ? "hover:bg-secondary/50 cursor-pointer" : "cursor-default"
                )}
              >
                {listing.vehiclePhotoUrl ? (
                  <img src={listing.vehiclePhotoUrl} alt="" className="w-14 h-10 rounded object-cover shrink-0" />
                ) : (
                  <div className="w-14 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                    <Car className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-dm text-sm font-medium truncate">{listing.vehicleName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-dm text-xs text-muted-foreground">
                      ${listing.vehiclePrice?.toLocaleString()}
                    </span>
                    {isSold && listing.totalPosts != null && listing.totalPosts > 0 && (
                      <span className="font-dm text-[10px] text-muted-foreground">
                        {listing.totalPosts} post{listing.totalPosts > 1 ? 's' : ''}
                      </span>
                    )}
                    {!isSold && (
                      <span className="font-dm text-[10px] text-muted-foreground capitalize">{listing.taskType}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {listing.messagesReceived > 0 && (
                    <div className="flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5 text-green-500" />
                      <span className="font-dm text-xs">{listing.messagesReceived}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    {statusIcon(listing.status)}
                    <span className={cn('font-dm text-[10px] px-2 py-0.5 rounded border capitalize', statusBadge(listing.status))}>
                      {listing.status}
                    </span>
                  </div>
                  <span className="font-dm text-[10px] text-muted-foreground w-14 text-right">
                    {isSold && listing.soldAt
                      ? formatRelative(listing.soldAt)
                      : listing.completedAt
                        ? formatRelative(listing.completedAt)
                        : listing.scheduledFor
                          ? formatRelative(listing.scheduledFor)
                          : '—'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 0) return 'soon';
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
