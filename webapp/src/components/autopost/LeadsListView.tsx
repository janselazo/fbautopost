import { useState, useEffect, useCallback } from 'react';
import {
  UserPlus,
  Search,
  Loader2,
  Phone,
  Mail,
  Car,
  Trash2,
  MoreHorizontal,
  Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { getBackendUrl } from '@/lib/backend-url';
import { cn } from '@/lib/utils';

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  vehicle: string | null;
  tag: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

const TAG_OPTIONS = ['new', 'hot', 'warm', 'cold', 'converted', 'lost'] as const;

const TAG_COLORS: Record<string, string> = {
  new: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  hot: 'bg-red-500/15 text-red-400 border-red-500/30',
  warm: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  cold: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  converted: 'bg-green-500/15 text-green-400 border-green-500/30',
  lost: 'bg-zinc-500/15 text-zinc-500 border-zinc-500/30',
};

export function LeadsListView() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    try {
      const r = await fetch(`${getBackendUrl()}/api/leads`, { credentials: 'include' });
      const j = await r.json();
      if (j.data) setLeads(j.data);
    } catch {
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const updateTag = async (id: string, tag: string) => {
    try {
      const r = await fetch(`${getBackendUrl()}/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tag }),
      });
      const j = await r.json();
      if (j.data) {
        setLeads(prev => prev.map(l => l.id === id ? j.data : l));
        toast.success('Tag updated');
      }
    } catch {
      toast.error('Failed to update lead');
    }
    setEditingId(null);
  };

  const deleteLead = async (id: string) => {
    try {
      await fetch(`${getBackendUrl()}/api/leads/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      setLeads(prev => prev.filter(l => l.id !== id));
      toast.success('Lead deleted');
    } catch {
      toast.error('Failed to delete lead');
    }
  };

  const filtered = leads.filter(l => {
    const q = search.toLowerCase();
    const matchesSearch = !q ||
      l.name.toLowerCase().includes(q) ||
      (l.vehicle?.toLowerCase().includes(q)) ||
      (l.email?.toLowerCase().includes(q)) ||
      (l.phone?.includes(q));
    const matchesTag = !filterTag || l.tag === filterTag;
    return matchesSearch && matchesTag;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-bebas text-3xl tracking-wider text-foreground">Leads</h1>
        <p className="font-dm text-xs text-muted-foreground mt-0.5">
          People interested in your vehicles — captured from conversations
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 font-dm text-sm bg-card border-border"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterTag(null)}
            className={cn(
              'px-2.5 py-1 rounded-md text-xs font-dm border transition-colors',
              !filterTag
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:text-foreground'
            )}
          >
            All ({leads.length})
          </button>
          {TAG_OPTIONS.map(t => {
            const count = leads.filter(l => l.tag === t).length;
            if (count === 0) return null;
            return (
              <button
                key={t}
                onClick={() => setFilterTag(filterTag === t ? null : t)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-dm border transition-colors capitalize',
                  filterTag === t
                    ? TAG_COLORS[t]
                    : 'bg-card text-muted-foreground border-border hover:text-foreground'
                )}
              >
                {t} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <UserPlus className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="font-dm text-lg">No leads yet</p>
          <p className="font-dm text-sm text-muted-foreground mt-1">
            Leads are auto-captured from Messenger conversations.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(lead => (
            <div
              key={lead.id}
              className="group bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                {/* Left */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-1">
                    <h3 className="font-dm font-medium text-sm text-foreground truncate">
                      {lead.name}
                    </h3>

                    {/* Tag badge — click to change */}
                    <div className="relative">
                      <button
                        onClick={() => setEditingId(editingId === lead.id ? null : lead.id)}
                        className={cn(
                          'px-2 py-0.5 rounded text-[11px] font-dm border capitalize cursor-pointer hover:opacity-80 transition-opacity',
                          TAG_COLORS[lead.tag] || TAG_COLORS.new,
                        )}
                      >
                        {lead.tag}
                      </button>
                      {editingId === lead.id && (
                        <div className="absolute top-full left-0 mt-1 z-20 bg-card border border-border rounded-lg shadow-lg p-1 flex flex-col min-w-[100px]">
                          {TAG_OPTIONS.map(t => (
                            <button
                              key={t}
                              onClick={() => updateTag(lead.id, t)}
                              className={cn(
                                'px-3 py-1.5 text-xs font-dm text-left rounded capitalize hover:bg-muted/50 transition-colors',
                                lead.tag === t && 'font-semibold',
                              )}
                            >
                              <Tag className="w-3 h-3 inline mr-1.5" />{t}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Details row */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground font-dm">
                    {lead.vehicle && (
                      <span className="flex items-center gap-1">
                        <Car className="w-3.5 h-3.5" />{lead.vehicle}
                      </span>
                    )}
                    {lead.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" />{lead.phone}
                      </span>
                    )}
                    {lead.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5" />{lead.email}
                      </span>
                    )}
                  </div>

                  {lead.notes && (
                    <p className="text-xs text-muted-foreground/70 font-dm mt-1.5 line-clamp-1">{lead.notes}</p>
                  )}
                </div>

                {/* Right — actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => { if (confirm('Delete this lead?')) deleteLead(lead.id); }}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
