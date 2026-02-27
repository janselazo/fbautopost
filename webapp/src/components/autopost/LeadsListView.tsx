import React, { useState, useEffect, useCallback } from 'react';
import {
  UserPlus,
  Search,
  Pencil,
  Trash2,
  Phone,
  Mail,
  Car,
  Tag,
  ChevronDown,
  Loader2,
  Users,
  Flame,
  ThermometerSun,
  CheckCircle2,
  ArrowUpRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  vehicle: string | null;
  tag: string;
  notes: string | null;
  createdAt: string;
}

type LeadTag = 'new' | 'hot' | 'warm' | 'cold' | 'converted' | 'lost';

interface FormState {
  name: string;
  email: string;
  phone: string;
  vehicle: string;
  tag: LeadTag;
  notes: string;
}

// ─── Tag Config ───────────────────────────────────────────────────────────────

const TAG_CONFIG: Record<string, { label: string; classes: string; dot: string }> = {
  new:       { label: 'New',       classes: 'bg-blue-500/15 text-blue-400 border-blue-500/25',     dot: 'bg-blue-400' },
  hot:       { label: 'Hot',       classes: 'bg-red-500/15 text-red-400 border-red-500/25',        dot: 'bg-red-400' },
  warm:      { label: 'Warm',      classes: 'bg-amber-500/15 text-amber-400 border-amber-500/25',  dot: 'bg-amber-400' },
  cold:      { label: 'Cold',      classes: 'bg-slate-500/15 text-slate-400 border-slate-500/25',  dot: 'bg-slate-400' },
  converted: { label: 'Converted', classes: 'bg-green-500/15 text-green-400 border-green-500/25',  dot: 'bg-green-400' },
  lost:      { label: 'Lost',      classes: 'bg-rose-900/30 text-rose-500 border-rose-900/40',     dot: 'bg-rose-500' },
};

const TAG_OPTIONS: LeadTag[] = ['new', 'hot', 'warm', 'cold', 'converted', 'lost'];

const EMPTY_FORM: FormState = {
  name: '',
  email: '',
  phone: '',
  vehicle: '',
  tag: 'new',
  notes: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function TagBadge({ tag }: { tag: string }) {
  const cfg = TAG_CONFIG[tag] ?? TAG_CONFIG['new'];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-dm font-semibold border ${cfg.classes}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  valueClass = 'text-foreground',
  sub,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  valueClass?: string;
  sub: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-1">
      <div className="flex items-start justify-between mb-1">
        <span className="font-dm text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
        <Icon className="w-4 h-4 text-muted-foreground/60" />
      </div>
      <div className={`font-bebas text-3xl tracking-wider leading-none ${valueClass}`}>{value}</div>
      <div className="font-dm text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface LeadsListViewProps {
  onNavigate?: (view: string) => void;
}

export function LeadsListView({ onNavigate }: LeadsListViewProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<{ name?: string }>({});
  const [saving, setSaving] = useState(false);

  // Delete confirm state — stores id of lead being confirmed
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Convert state
  const [convertingId, setConvertingId] = useState<string | null>(null);

  // ─── Fetch leads ───────────────────────────────────────────────────────────

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/leads`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setLeads(json.data ?? []);
    } catch (err) {
      console.error('Failed to fetch leads', err);
      toast.error('Could not load leads.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // ─── Filtered leads ────────────────────────────────────────────────────────

  const filteredLeads = leads.filter(lead => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      lead.name.toLowerCase().includes(q) ||
      (lead.email ?? '').toLowerCase().includes(q) ||
      (lead.phone ?? '').toLowerCase().includes(q) ||
      (lead.vehicle ?? '').toLowerCase().includes(q);
    const matchesTag = tagFilter === 'all' || lead.tag === tagFilter;
    return matchesSearch && matchesTag;
  });

  // ─── Stats ─────────────────────────────────────────────────────────────────

  const totalLeads = leads.length;
  const hotLeads = leads.filter(l => l.tag === 'hot').length;
  const warmLeads = leads.filter(l => l.tag === 'warm').length;
  const convertedLeads = leads.filter(l => l.tag === 'converted').length;

  // ─── Modal helpers ─────────────────────────────────────────────────────────

  function openAddModal() {
    setEditingLead(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setModalOpen(true);
  }

  function openEditModal(lead: Lead) {
    setEditingLead(lead);
    setForm({
      name: lead.name,
      email: lead.email ?? '',
      phone: lead.phone ?? '',
      vehicle: lead.vehicle ?? '',
      tag: (lead.tag as LeadTag) ?? 'new',
      notes: lead.notes ?? '',
    });
    setFormErrors({});
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingLead(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
  }

  function validateForm(): boolean {
    const errors: { name?: string } = {};
    if (!form.name.trim()) errors.name = 'Name is required.';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSave() {
    if (!validateForm()) return;
    setSaving(true);
    const body = {
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      vehicle: form.vehicle.trim() || null,
      tag: form.tag,
      notes: form.notes.trim() || null,
    };
    try {
      if (editingLead) {
        const res = await fetch(`${BACKEND_URL}/api/leads/${editingLead.id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setLeads(prev => prev.map(l => l.id === editingLead.id ? json.data : l));
        toast.success('Lead updated.');
      } else {
        const res = await fetch(`${BACKEND_URL}/api/leads`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setLeads(prev => [json.data, ...prev]);
        toast.success('Lead added.');
      }
      closeModal();
    } catch (err) {
      console.error('Failed to save lead', err);
      toast.error('Could not save lead. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  async function handleDeleteConfirm() {
    if (!confirmDeleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/leads/${confirmDeleteId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
      setLeads(prev => prev.filter(l => l.id !== confirmDeleteId));
      toast.success('Lead deleted.');
    } catch (err) {
      console.error('Failed to delete lead', err);
      toast.error('Could not delete lead.');
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  }

  // ─── Convert to Opportunity ────────────────────────────────────────────────

  async function handleConvert(lead: Lead) {
    setConvertingId(lead.id);
    try {
      const res = await fetch(`${BACKEND_URL}/api/conversations/from-lead`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          name: lead.name,
          vehicle: lead.vehicle || 'Unknown Vehicle',
          phone: lead.phone || null,
          email: lead.email || null,
          notes: lead.notes || null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Update local lead tag to 'converted'
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, tag: 'converted' } : l));
      toast.success('Lead converted to opportunity!');
      // Navigate to Opportunities (CRM) view
      onNavigate?.('crm');
    } catch (err) {
      console.error('Failed to convert lead', err);
      toast.error('Could not convert lead to opportunity.');
    } finally {
      setConvertingId(null);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-bebas text-4xl tracking-wider text-foreground leading-none">LEADS</h1>
          <p className="font-dm text-sm text-muted-foreground mt-1">
            Track and manage your sales prospects.
          </p>
        </div>
        <Button
          onClick={openAddModal}
          className="bg-primary text-primary-foreground hover:bg-primary/90 font-dm text-sm gap-2 shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          Add Lead
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total Leads"
          value={totalLeads}
          icon={Users}
          sub="in pipeline"
        />
        <StatCard
          label="Hot Leads"
          value={hotLeads}
          icon={Flame}
          valueClass="text-red-400"
          sub="ready to buy"
        />
        <StatCard
          label="Warm Leads"
          value={warmLeads}
          icon={ThermometerSun}
          valueClass="text-amber-400"
          sub="in progress"
        />
        <StatCard
          label="Converted"
          value={convertedLeads}
          icon={CheckCircle2}
          valueClass="text-green-400"
          sub="deals closed"
        />
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, vehicle, email, phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-card border border-border rounded-lg font-dm text-sm text-foreground pl-9 pr-3 py-2 outline-none placeholder:text-muted-foreground focus:border-primary/50 transition-colors"
          />
        </div>

        {/* Tag filter dropdown */}
        <div className="relative">
          <button
            onClick={() => setTagDropdownOpen(v => !v)}
            className="flex items-center gap-2 bg-card border border-border rounded-lg font-dm text-sm text-foreground px-3 py-2 hover:border-border/80 transition-colors outline-none"
          >
            <Tag className="w-4 h-4 text-muted-foreground" />
            <span className="min-w-[64px]">
              {tagFilter === 'all' ? 'All Tags' : TAG_CONFIG[tagFilter]?.label ?? tagFilter}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${tagDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          {tagDropdownOpen ? (
            <div className="absolute right-0 top-full mt-1 z-20 bg-popover border border-border rounded-lg shadow-xl overflow-hidden min-w-[140px]">
              <button
                className={`w-full text-left px-3 py-2 font-dm text-sm transition-colors hover:bg-secondary ${tagFilter === 'all' ? 'text-foreground' : 'text-muted-foreground'}`}
                onClick={() => { setTagFilter('all'); setTagDropdownOpen(false); }}
              >
                All Tags
              </button>
              {TAG_OPTIONS.map(t => (
                <button
                  key={t}
                  className={`w-full text-left px-3 py-2 font-dm text-sm transition-colors hover:bg-secondary flex items-center gap-2 ${tagFilter === t ? 'text-foreground' : 'text-muted-foreground'}`}
                  onClick={() => { setTagFilter(t); setTagDropdownOpen(false); }}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${TAG_CONFIG[t].dot}`} />
                  {TAG_CONFIG[t].label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="font-dm text-sm">Loading leads...</span>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="font-dm font-semibold text-foreground text-base mb-1">
              {search || tagFilter !== 'all' ? 'No leads match your filters' : 'No leads yet'}
            </p>
            <p className="font-dm text-sm text-muted-foreground max-w-xs">
              {search || tagFilter !== 'all'
                ? 'Try adjusting your search or filter.'
                : 'Add your first lead to start tracking your sales prospects.'}
            </p>
            {!search && tagFilter === 'all' ? (
              <Button
                onClick={openAddModal}
                className="mt-5 bg-primary text-primary-foreground hover:bg-primary/90 font-dm text-sm gap-2"
              >
                <UserPlus className="w-4 h-4" />
                Add First Lead
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 font-dm text-xs text-muted-foreground uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 font-dm text-xs text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Contact</th>
                  <th className="text-left px-4 py-3 font-dm text-xs text-muted-foreground uppercase tracking-wider hidden md:table-cell">Vehicle</th>
                  <th className="text-left px-4 py-3 font-dm text-xs text-muted-foreground uppercase tracking-wider">Tag</th>
                  <th className="text-left px-4 py-3 font-dm text-xs text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Date Added</th>
                  <th className="text-right px-4 py-3 font-dm text-xs text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead, idx) => {
                  const isConfirmingDelete = confirmDeleteId === lead.id;
                  const isLast = idx === filteredLeads.length - 1;
                  return (
                    <tr
                      key={lead.id}
                      className={`group transition-colors hover:bg-secondary/40 ${!isLast ? 'border-b border-border' : ''}`}
                    >
                      {/* Name */}
                      <td className="px-4 py-3.5">
                        <div className="font-dm text-sm font-semibold text-foreground leading-tight">{lead.name}</div>
                        {lead.notes ? (
                          <div className="font-dm text-xs text-muted-foreground/70 mt-0.5 max-w-[180px] truncate">{lead.notes}</div>
                        ) : null}
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-3.5 hidden sm:table-cell">
                        <div className="flex flex-col gap-0.5">
                          {lead.email ? (
                            <div className="font-dm text-xs text-muted-foreground flex items-center gap-1.5">
                              <Mail className="w-3 h-3 shrink-0 text-muted-foreground/50" />
                              <span className="truncate max-w-[160px]">{lead.email}</span>
                            </div>
                          ) : null}
                          {lead.phone ? (
                            <div className="font-dm text-xs text-muted-foreground flex items-center gap-1.5">
                              <Phone className="w-3 h-3 shrink-0 text-muted-foreground/50" />
                              {lead.phone}
                            </div>
                          ) : null}
                          {!lead.email && !lead.phone ? (
                            <span className="font-dm text-xs text-muted-foreground/40">—</span>
                          ) : null}
                        </div>
                      </td>

                      {/* Vehicle */}
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        {lead.vehicle ? (
                          <div className="font-dm text-xs text-muted-foreground flex items-center gap-1.5">
                            <Car className="w-3 h-3 shrink-0 text-muted-foreground/50" />
                            <span className="truncate max-w-[160px]">{lead.vehicle}</span>
                          </div>
                        ) : (
                          <span className="font-dm text-xs text-muted-foreground/40">—</span>
                        )}
                      </td>

                      {/* Tag */}
                      <td className="px-4 py-3.5">
                        <TagBadge tag={lead.tag} />
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        <span className="font-dm text-xs text-muted-foreground">{formatDate(lead.createdAt)}</span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        {isConfirmingDelete ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="font-dm text-xs text-muted-foreground">Delete?</span>
                            <button
                              onClick={handleDeleteConfirm}
                              disabled={deleting}
                              className="font-dm text-xs text-red-400 hover:text-red-300 font-semibold transition-colors disabled:opacity-50"
                            >
                              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Yes'}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              disabled={deleting}
                              className="font-dm text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {lead.tag !== 'converted' && lead.tag !== 'lost' ? (
                              <button
                                onClick={() => handleConvert(lead)}
                                disabled={convertingId === lead.id}
                                className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                                title="Convert to Opportunity"
                              >
                                {convertingId === lead.id
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  : <ArrowUpRight className="w-3.5 h-3.5" />
                                }
                              </button>
                            ) : null}
                            <button
                              onClick={() => openEditModal(lead)}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                              title="Edit lead"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(lead.id)}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title="Delete lead"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={open => { if (!open) closeModal(); }}>
        <DialogContent className="bg-card border-border max-w-[480px] w-full">
          <DialogHeader>
            <DialogTitle className="font-bebas text-2xl tracking-wider text-foreground">
              {editingLead ? 'EDIT LEAD' : 'ADD LEAD'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="font-dm text-xs text-muted-foreground uppercase tracking-wider">
                Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder="Full name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className={`w-full bg-secondary border rounded-lg font-dm text-sm text-foreground px-3 py-2 outline-none placeholder:text-muted-foreground transition-colors focus:border-primary/50 ${formErrors.name ? 'border-red-500/60' : 'border-border'}`}
              />
              {formErrors.name ? (
                <p className="font-dm text-xs text-red-400">{formErrors.name}</p>
              ) : null}
            </div>

            {/* Email + Phone row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-dm text-xs text-muted-foreground uppercase tracking-wider">Email</label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
                  <input
                    type="email"
                    placeholder="email@example.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full bg-secondary border border-border rounded-lg font-dm text-sm text-foreground pl-8 pr-3 py-2 outline-none placeholder:text-muted-foreground focus:border-primary/50 transition-colors"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="font-dm text-xs text-muted-foreground uppercase tracking-wider">Phone</label>
                <div className="relative">
                  <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
                  <input
                    type="tel"
                    placeholder="(555) 000-0000"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full bg-secondary border border-border rounded-lg font-dm text-sm text-foreground pl-8 pr-3 py-2 outline-none placeholder:text-muted-foreground focus:border-primary/50 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Vehicle */}
            <div className="space-y-1.5">
              <label className="font-dm text-xs text-muted-foreground uppercase tracking-wider">Vehicle</label>
              <div className="relative">
                <Car className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
                <input
                  type="text"
                  placeholder="e.g. 2022 Toyota Camry"
                  value={form.vehicle}
                  onChange={e => setForm(f => ({ ...f, vehicle: e.target.value }))}
                  className="w-full bg-secondary border border-border rounded-lg font-dm text-sm text-foreground pl-8 pr-3 py-2 outline-none placeholder:text-muted-foreground focus:border-primary/50 transition-colors"
                />
              </div>
            </div>

            {/* Tag */}
            <div className="space-y-1.5">
              <label className="font-dm text-xs text-muted-foreground uppercase tracking-wider">Tag</label>
              <div className="relative">
                <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
                <select
                  value={form.tag}
                  onChange={e => setForm(f => ({ ...f, tag: e.target.value as LeadTag }))}
                  className="w-full bg-secondary border border-border rounded-lg font-dm text-sm text-foreground pl-8 pr-3 py-2 outline-none cursor-pointer appearance-none focus:border-primary/50 transition-colors"
                >
                  {TAG_OPTIONS.map(t => (
                    <option key={t} value={t}>{TAG_CONFIG[t].label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="font-dm text-xs text-muted-foreground uppercase tracking-wider">Notes</label>
              <textarea
                placeholder="Any additional notes about this lead..."
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={3}
                className="w-full bg-secondary border border-border rounded-lg font-dm text-sm text-foreground px-3 py-2 outline-none placeholder:text-muted-foreground focus:border-primary/50 transition-colors resize-none"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button
              variant="outline"
              onClick={closeModal}
              disabled={saving}
              className="font-dm text-sm border-border"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-dm text-sm gap-2"
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
              ) : (
                editingLead ? 'Save Changes' : 'Add Lead'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
