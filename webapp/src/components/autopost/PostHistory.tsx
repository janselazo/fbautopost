import { useState } from 'react';
import { ExternalLink, Clock, FileText, Zap, Star, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { PostHistoryItem, PostStatus, PostTemplate } from './types';

interface PostHistoryProps {
  history: PostHistoryItem[];
}

const statusStyles: Record<PostStatus, string> = {
  Posted: 'bg-green-500/15 text-green-400 border-green-500/30',
  Scheduled: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  Draft: 'bg-secondary text-muted-foreground border-border',
};

const templateIcons: Record<PostTemplate, React.ComponentType<{ className?: string }>> = {
  premium: Star,
  quicksale: Zap,
  feature: Tag,
};

const templateLabels: Record<PostTemplate, string> = {
  premium: 'Premium Listing',
  quicksale: 'Quick Sale',
  feature: 'Feature Highlight',
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

export function PostHistory({ history }: PostHistoryProps) {
  const [statusFilter, setStatusFilter] = useState<PostStatus | 'All'>('All');

  const filtered = history.filter(
    (h) => statusFilter === 'All' || h.status === statusFilter
  );

  return (
    <div className="animate-slide-up">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="font-bebas text-3xl tracking-wider text-foreground">
            POST HISTORY
          </h1>
          <p className="font-dm text-sm text-muted-foreground mt-0.5">
            Track your published Facebook Marketplace listings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-dm text-sm text-muted-foreground">Filter:</span>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as PostStatus | 'All')}
          >
            <SelectTrigger className="w-36 bg-input border-border text-foreground font-dm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {(['All', 'Posted', 'Scheduled', 'Draft'] as const).map((s) => (
                <SelectItem key={s} value={s} className="text-foreground font-dm">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats summary */}
      <div className="flex gap-3 mb-6 flex-wrap">
        {(['Posted', 'Scheduled', 'Draft'] as PostStatus[]).map((status) => {
          const count = history.filter((h) => h.status === status).length;
          return (
            <div
              key={status}
              className="px-4 py-2.5 rounded border border-border bg-secondary flex items-center gap-2"
            >
              <Badge className={cn('text-xs border', statusStyles[status])}>
                {status}
              </Badge>
              <span className="font-bebas text-lg text-foreground tracking-wide">{count}</span>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <FileText className="w-12 h-12 mb-4 opacity-30" />
          <p className="font-dm text-lg">No posts yet</p>
          <p className="font-dm text-sm text-muted-foreground mt-1">Post from Inventory to Facebook Marketplace to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((item) => {
            const TemplateIcon = templateIcons[item.template];
            return (
              <div
                key={item.id}
                className="bg-card border border-border rounded-lg overflow-hidden hover:border-primary/40 transition-all duration-200 animate-scale-in"
              >
                {/* Card header */}
                <div className="px-4 py-3 border-b border-border bg-secondary/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded bg-muted flex items-center justify-center">
                      <TemplateIcon className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <span className="font-dm text-xs text-muted-foreground">
                      {templateLabels[item.template]}
                    </span>
                  </div>
                  <Badge className={cn('text-xs border', statusStyles[item.status])}>
                    {item.status}
                  </Badge>
                </div>

                {/* Card body */}
                <div className="px-4 py-3 flex flex-col gap-2">
                  <div className="font-dm font-medium text-foreground text-sm leading-snug">
                    {item.vehicleName}
                  </div>

                  {/* Post text preview */}
                  <p className="font-dm text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                    {item.postText}
                  </p>

                  {/* Time */}
                  <div className="flex items-center gap-1.5 mt-1">
                    <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="font-dm text-xs text-muted-foreground">
                      {item.status === 'Scheduled' && item.scheduledFor
                        ? `Scheduled for ${formatDate(item.scheduledFor)}`
                        : `${timeAgo(item.postedAt)} — ${formatDate(item.postedAt)}`}
                    </span>
                  </div>
                </div>

                {/* Card footer */}
                <div className="px-4 py-3 border-t border-border flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#1877F2' }} />
                    <span className="font-dm text-xs text-muted-foreground">Facebook Marketplace</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={item.status !== 'Posted'}
                    className="font-dm text-xs border-border h-7 px-2.5 gap-1.5 disabled:opacity-40"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View on FB
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
