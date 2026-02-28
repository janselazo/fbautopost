import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Sparkles,
  MessageSquare,
  Loader2,
  Bot,
  X,
  CalendarDays,
  Car,
  UserPlus,
  TrendingUp,
  Phone,
  Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { AppointmentModal } from './AppointmentModal';
import { getBackendUrl } from '@/lib/backend-url';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  conversationId: string;
  direction: 'incoming' | 'outgoing';
  body: string;
  source: string;
  intentScore: number;
  createdAt: string;
}

type CrmStatus =
  | 'new_lead'
  | 'contacted'
  | 'follow_up'
  | 'negotiation'
  | 'appointment_scheduled'
  | 'appointment_attended'
  | 'closed_won'
  | 'closed_lost';

interface Conversation {
  id: string;
  buyerName: string;
  buyerFbId?: string;
  buyerPhone?: string;
  buyerEmail?: string;
  vehicle: string;
  vehiclePrice?: string;
  listingUrl?: string;
  intentScore: number;
  status: 'new' | 'contacted' | 'converted' | 'closed';
  crmStatus: CrmStatus;
  lastMessageAt: string;
  createdAt: string;
  messages?: Message[];
}

// ─── CRM Columns ──────────────────────────────────────────────────────────────

const CRM_COLUMNS: {
  id: CrmStatus;
  label: string;
  topBorder: string;
  accent: string;
  countAccent: string;
}[] = [
  {
    id: 'new_lead',
    label: 'New Lead',
    topBorder: 'border-t-blue-500',
    accent: 'bg-blue-500/10 text-blue-400',
    countAccent: 'bg-blue-500/15 text-blue-400',
  },
  {
    id: 'contacted',
    label: 'Contacted',
    topBorder: 'border-t-yellow-500',
    accent: 'bg-yellow-500/10 text-yellow-400',
    countAccent: 'bg-yellow-500/15 text-yellow-400',
  },
  {
    id: 'follow_up',
    label: 'Follow-Up',
    topBorder: 'border-t-orange-500',
    accent: 'bg-orange-500/10 text-orange-400',
    countAccent: 'bg-orange-500/15 text-orange-400',
  },
  {
    id: 'negotiation',
    label: 'Negotiation',
    topBorder: 'border-t-purple-500',
    accent: 'bg-purple-500/10 text-purple-400',
    countAccent: 'bg-purple-500/15 text-purple-400',
  },
  {
    id: 'appointment_scheduled',
    label: 'Appt. Scheduled',
    topBorder: 'border-t-cyan-500',
    accent: 'bg-cyan-500/10 text-cyan-400',
    countAccent: 'bg-cyan-500/15 text-cyan-400',
  },
  {
    id: 'appointment_attended',
    label: 'Appt. Attended',
    topBorder: 'border-t-teal-500',
    accent: 'bg-teal-500/10 text-teal-400',
    countAccent: 'bg-teal-500/15 text-teal-400',
  },
  {
    id: 'closed_won',
    label: 'Closed – Won',
    topBorder: 'border-t-green-500',
    accent: 'bg-green-500/10 text-green-400',
    countAccent: 'bg-green-500/15 text-green-400',
  },
  {
    id: 'closed_lost',
    label: 'Closed – Lost',
    topBorder: 'border-t-red-500',
    accent: 'bg-red-500/10 text-red-400',
    countAccent: 'bg-red-500/15 text-red-400',
  },
];

// ─── Demo Data ────────────────────────────────────────────────────────────────

const DEMO_CONVERSATIONS: Conversation[] = [
  {
    id: 'demo-1',
    buyerName: 'Marcus Johnson',
    vehicle: '2021 Toyota Camry XSE',
    vehiclePrice: '$27,500',
    intentScore: 72,
    status: 'new',
    crmStatus: 'new_lead',
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    messages: [
      { id: 'm1', conversationId: 'demo-1', direction: 'incoming', body: 'Is this still available?', source: 'fb_marketplace', intentScore: 10, createdAt: new Date(Date.now() - 1000 * 60 * 8).toISOString() },
      { id: 'm2', conversationId: 'demo-1', direction: 'outgoing', body: 'Yes! The 2021 Camry XSE is still available and in excellent condition. Would you like to schedule a test drive?', source: 'manual', intentScore: 0, createdAt: new Date(Date.now() - 1000 * 60 * 6).toISOString() },
      { id: 'm3', conversationId: 'demo-1', direction: 'incoming', body: "What's your best price on it? I saw similar ones for around $25k", source: 'fb_marketplace', intentScore: 40, createdAt: new Date(Date.now() - 1000 * 60 * 3).toISOString() },
    ],
  },
  {
    id: 'demo-2',
    buyerName: 'Sarah Williams',
    vehicle: '2022 Honda CR-V EX-L',
    vehiclePrice: '$31,200',
    intentScore: 88,
    status: 'contacted',
    crmStatus: 'follow_up',
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 32).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    messages: [
      { id: 'm4', conversationId: 'demo-2', direction: 'incoming', body: 'Hi! Is the CR-V still for sale?', source: 'fb_marketplace', intentScore: 10, createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString() },
      { id: 'm5', conversationId: 'demo-2', direction: 'outgoing', body: 'Yes it is! This CR-V EX-L only has 15,600 miles and is in pristine condition. One owner, clean Carfax.', source: 'manual', intentScore: 0, createdAt: new Date(Date.now() - 1000 * 60 * 55).toISOString() },
      { id: 'm6', conversationId: 'demo-2', direction: 'incoming', body: 'Does it have a sunroof? Also can I come see it tomorrow morning?', source: 'fb_marketplace', intentScore: 60, createdAt: new Date(Date.now() - 1000 * 60 * 40).toISOString() },
      { id: 'm7', conversationId: 'demo-2', direction: 'outgoing', body: 'Absolutely — it has a panoramic sunroof! Tomorrow morning works great. What time works for you?', source: 'manual', intentScore: 0, createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString() },
      { id: 'm8', conversationId: 'demo-2', direction: 'incoming', body: 'Can we do 10am? Also do you offer financing?', source: 'fb_marketplace', intentScore: 80, createdAt: new Date(Date.now() - 1000 * 60 * 32).toISOString() },
    ],
  },
  {
    id: 'demo-3',
    buyerName: 'Derek Okafor',
    vehicle: '2020 Ford F-150 XLT',
    vehiclePrice: '$34,900',
    intentScore: 95,
    status: 'converted',
    crmStatus: 'closed_won',
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    messages: [
      { id: 'm9', conversationId: 'demo-3', direction: 'incoming', body: "Hey! I'm really interested in the F-150. Can I get your number to call?", source: 'fb_marketplace', intentScore: 70, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString() },
      { id: 'm10', conversationId: 'demo-3', direction: 'outgoing', body: "Of course! Give us a call at (305) 555-0192 — ask for Mike. We're open until 8pm today.", source: 'manual', intentScore: 0, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4.5).toISOString() },
      { id: 'm11', conversationId: 'demo-3', direction: 'incoming', body: 'Just bought it! Thanks for the quick response 🙌', source: 'fb_marketplace', intentScore: 95, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString() },
    ],
  },
  {
    id: 'demo-4',
    buyerName: 'Priya Patel',
    vehicle: '2023 BMW 3 Series 330i',
    vehiclePrice: '$44,800',
    intentScore: 45,
    status: 'new',
    crmStatus: 'contacted',
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    messages: [
      { id: 'm12', conversationId: 'demo-4', direction: 'incoming', body: 'How many miles does this have? And what color is the interior?', source: 'fb_marketplace', intentScore: 30, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString() },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function intentLabel(score: number) {
  if (score >= 70) return 'Hot';
  if (score >= 40) return 'Warm';
  return 'Cold';
}

function intentBg(score: number) {
  if (score >= 70) return 'bg-red-500/10 border-red-500/20 text-red-400';
  if (score >= 40) return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400';
  return 'bg-secondary border-border text-muted-foreground';
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── EditableField ────────────────────────────────────────────────────────────

function EditableField({
  value,
  onChange,
  placeholder,
  icon: Icon,
}: {
  value?: string;
  onChange: (val: string) => void;
  placeholder: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commit() {
    setEditing(false);
    onChange(draft.trim());
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setDraft(value || ''); setEditing(false); }
        }}
        placeholder={placeholder}
        className="font-dm text-[11px] text-foreground bg-secondary border border-border rounded px-1.5 py-0.5 outline-none w-36 focus:border-primary/50"
      />
    );
  }

  if (value) {
    return (
      <button
        onClick={() => { setDraft(value); setEditing(true); }}
        className="font-dm text-[11px] text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
      >
        <Icon className="w-3 h-3 shrink-0" />
        {value}
      </button>
    );
  }

  return (
    <button
      onClick={() => { setDraft(''); setEditing(true); }}
      className="font-dm text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
    >
      {placeholder}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CrmView() {
  const BACKEND_URL = getBackendUrl();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [drawerConv, setDrawerConv] = useState<Conversation | null>(null);
  const [drawerMessages, setDrawerMessages] = useState<Message[]>([]);
  const [drawerDraft, setDrawerDraft] = useState('');
  const [drawerAiLoading, setDrawerAiLoading] = useState(false);
  const [drawerSending, setDrawerSending] = useState(false);
  const [dragOverCol, setDragOverCol] = useState<CrmStatus | null>(null);
  const [showApptModal, setShowApptModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [drawerMessages]);

  async function loadConversations() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/conversations`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      const real: Conversation[] = data.data;
      if (real) setConversations(real);
    } catch {
      // Keep empty state on error
    }
  }

  async function openDrawer(conv: Conversation) {
    setDrawerConv(conv);
    setDrawerDraft('');
    setShowApptModal(false);
    if (conv.messages) {
      setDrawerMessages(conv.messages);
      return;
    }
    try {
      const res = await fetch(`${BACKEND_URL}/api/conversations/${conv.id}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setDrawerMessages(data.data.messages || []);
        setConversations(cs => cs.map(c => c.id === conv.id ? { ...c, messages: data.data.messages } : c));
        return;
      }
    } catch { /* fall through */ }
    setDrawerMessages(conv.messages || []);
  }

  async function updateCrmStatus(id: string, status: CrmStatus) {
    setConversations(cs => cs.map(c => c.id === id ? { ...c, crmStatus: status } : c));
    if (drawerConv?.id === id) setDrawerConv(prev => prev ? { ...prev, crmStatus: status } : prev);
    try {
      await fetch(`${BACKEND_URL}/api/conversations/${id}/crm-status`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crmStatus: status }),
      });
    } catch { /* silent */ }
  }

  function handleDragStart(e: React.DragEvent, convId: string) {
    e.dataTransfer.setData('convId', convId);
  }

  function handleDragOver(e: React.DragEvent, colId: CrmStatus) {
    e.preventDefault();
    setDragOverCol(colId);
  }

  function handleDrop(e: React.DragEvent, colId: CrmStatus) {
    e.preventDefault();
    setDragOverCol(null);
    const convId = e.dataTransfer.getData('convId');
    if (convId) updateCrmStatus(convId, colId);
  }

  async function sendDrawerMessage() {
    if (!drawerDraft.trim() || !drawerConv) return;
    setDrawerSending(true);
    const body = drawerDraft.trim();
    setDrawerDraft('');
    const newMsg: Message = {
      id: `local-${Date.now()}`,
      conversationId: drawerConv.id,
      direction: 'outgoing',
      body,
      source: 'manual',
      intentScore: 0,
      createdAt: new Date().toISOString(),
    };
    setDrawerMessages(prev => [...prev, newMsg]);
    setConversations(cs => cs.map(c => c.id === drawerConv.id ? { ...c, lastMessageAt: new Date().toISOString() } : c));
    try {
      await fetch(`${BACKEND_URL}/api/conversations/${drawerConv.id}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction: 'outgoing', body, source: 'manual' }),
      });
    } catch { /* silent */ }
    setDrawerSending(false);
  }

  async function getDrawerAiReply() {
    if (!drawerConv) return;
    setDrawerAiLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/conversations/${drawerConv.id}/ai-reply`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setDrawerDraft(data.data.reply);
      toast.success('AI reply generated — review and send!');
    } catch {
      const conv = drawerConv;
      const lastMsg = drawerMessages[drawerMessages.length - 1];
      let reply = '';
      if (lastMsg?.body.toLowerCase().includes('price') || lastMsg?.body.toLowerCase().includes('best')) {
        reply = `The ${conv.vehicle} is listed at ${conv.vehiclePrice ?? 'a competitive price'} — already priced below market. Happy to walk you through the value when you come in!`;
      } else if (lastMsg?.body.toLowerCase().includes('financing') || lastMsg?.body.toLowerCase().includes('finance')) {
        reply = `Yes, we work with multiple lenders to find the best rate for you!`;
      } else if (lastMsg?.body.toLowerCase().includes('available')) {
        reply = `Yes, the ${conv.vehicle} is still available and ready to go! Want to schedule a time to come take a look?`;
      } else {
        reply = `Great question! The ${conv.vehicle} is in ${conv.vehiclePrice ? `excellent shape at ${conv.vehiclePrice}` : 'great condition'}. I'd love to get you behind the wheel — when's a good time to come in?`;
      }
      setDrawerDraft(reply);
      toast.success('AI reply ready — review and send!');
    } finally {
      setDrawerAiLoading(false);
    }
  }

  const totalLeads = conversations.length;
  const hotLeads = conversations.filter(c => c.intentScore >= 70).length;
  const wonLeads = conversations.filter(c => c.crmStatus === 'closed_won').length;

  // Suppress unused import warning — DEMO_CONVERSATIONS available for future use
  void DEMO_CONVERSATIONS;

  return (
    <div className="space-y-5">
      {/* Page heading */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-bebas text-4xl tracking-wider text-foreground leading-none">OPPORTUNITIES</h1>
          <p className="font-dm text-sm text-muted-foreground mt-1">
            Drag leads across columns or click a card to move it through your pipeline.
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-lg px-3 py-2.5 flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-blue-500/10 flex items-center justify-center shrink-0">
            <UserPlus className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="min-w-0">
            <div className="font-bebas text-2xl tracking-wider text-foreground leading-none">{totalLeads}</div>
            <div className="font-dm text-[10px] text-muted-foreground uppercase tracking-wide leading-none mt-0.5">Total Leads</div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg px-3 py-2.5 flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-red-500/10 flex items-center justify-center shrink-0">
            <TrendingUp className="w-3.5 h-3.5 text-red-400" />
          </div>
          <div className="min-w-0">
            <div className="font-bebas text-2xl tracking-wider text-red-400 leading-none">{hotLeads}</div>
            <div className="font-dm text-[10px] text-muted-foreground uppercase tracking-wide leading-none mt-0.5">Hot Leads</div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg px-3 py-2.5 flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-green-500/10 flex items-center justify-center shrink-0">
            <TrendingUp className="w-3.5 h-3.5 text-green-400" />
          </div>
          <div className="min-w-0">
            <div className="font-bebas text-2xl tracking-wider text-green-400 leading-none">{wonLeads}</div>
            <div className="font-dm text-[10px] text-muted-foreground uppercase tracking-wide leading-none mt-0.5">Closed Won</div>
          </div>
        </div>
      </div>

      {/* Kanban board */}
      <div className="-mx-6 px-6 overflow-x-auto pb-4" style={{ scrollbarWidth: 'thin' }}>
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4 bg-card border border-border rounded-lg">
            <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-3">
              <MessageSquare className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="font-dm font-semibold text-foreground text-sm mb-1">No opportunities yet</p>
            <p className="font-dm text-xs text-muted-foreground max-w-xs">
              Convert a lead from the Leads page to start tracking opportunities in your sales pipeline.
            </p>
          </div>
        ) : (
          <div className="flex gap-2.5" style={{ minWidth: `${CRM_COLUMNS.length * 216}px` }}>
            {CRM_COLUMNS.map(col => {
              const colConvs = conversations.filter(c => c.crmStatus === col.id);
              const isDragOver = dragOverCol === col.id;
              return (
                <div
                  key={col.id}
                  className={`flex-1 min-w-[200px] flex flex-col bg-card border border-t-[3px] border-border rounded-lg transition-all ${col.topBorder} ${
                    isDragOver ? 'ring-2 ring-primary/30 bg-primary/5' : ''
                  }`}
                  onDragOver={e => handleDragOver(e, col.id)}
                  onDragLeave={() => setDragOverCol(null)}
                  onDrop={e => handleDrop(e, col.id)}
                >
                  {/* Column header */}
                  <div className="px-3 py-2 flex items-center justify-between">
                    <span className="font-dm text-[11px] font-semibold text-foreground">{col.label}</span>
                    <span className={`font-dm text-[10px] font-bold px-1.5 py-0.5 rounded-full ${col.countAccent}`}>
                      {colConvs.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 px-2 pb-2 space-y-1.5 min-h-[100px]">
                    {colConvs.map(conv => (
                      <div
                        key={conv.id}
                        draggable
                        onDragStart={e => handleDragStart(e, conv.id)}
                        onClick={() => openDrawer(conv)}
                        className="bg-background border border-border rounded-md p-2.5 cursor-pointer hover:border-primary/40 hover:bg-secondary/40 transition-all select-none"
                      >
                        <div className="font-dm text-xs font-semibold text-foreground mb-1 truncate">
                          {conv.buyerName}
                        </div>
                        <div className="font-dm text-[10px] text-muted-foreground truncate mb-2 flex items-center gap-1">
                          <Car className="w-2.5 h-2.5 shrink-0" />
                          {conv.vehicle}
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <span className={`font-dm text-[10px] font-semibold px-1.5 py-0.5 rounded border ${intentBg(conv.intentScore)}`}>
                            {intentLabel(conv.intentScore)}
                          </span>
                          <span className="font-dm text-[10px] text-muted-foreground/60">{timeAgo(conv.lastMessageAt)}</span>
                        </div>
                      </div>
                    ))}
                    {colConvs.length === 0 ? (
                      <div className="h-14 rounded-md border border-dashed border-border/50" />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Drawer backdrop */}
      {drawerConv ? (
        <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setDrawerConv(null)} />
      ) : null}

      {/* Chat drawer */}
      {drawerConv ? (
        <div className="fixed right-0 top-0 h-full w-[420px] bg-card border-l border-border z-50 flex flex-col shadow-2xl">
          {/* Drawer header */}
          <div className="px-5 py-4 border-b border-border shrink-0">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-dm text-base font-semibold text-foreground">{drawerConv.buyerName}</span>
                  <span className={`font-dm text-[10px] font-semibold px-1.5 py-0.5 rounded border ${intentBg(drawerConv.intentScore)}`}>
                    {drawerConv.intentScore}% intent
                  </span>
                </div>
                <div className="font-dm text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                  <Car className="w-3 h-3 shrink-0" />
                  {drawerConv.vehicle}{drawerConv.vehiclePrice ? ` · ${drawerConv.vehiclePrice}` : ''}
                </div>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  <EditableField
                    value={drawerConv.buyerPhone}
                    placeholder="+ Add phone"
                    icon={Phone}
                    onChange={val => {
                      setConversations(cs => cs.map(c => c.id === drawerConv.id ? { ...c, buyerPhone: val || undefined } : c));
                      setDrawerConv(prev => prev ? { ...prev, buyerPhone: val || undefined } : prev);
                      fetch(`${BACKEND_URL}/api/conversations/${drawerConv.id}`, {
                        method: 'PATCH',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ buyerPhone: val || null }),
                      }).catch(() => {});
                    }}
                  />
                  <EditableField
                    value={drawerConv.buyerEmail}
                    placeholder="+ Add email"
                    icon={Mail}
                    onChange={val => {
                      setConversations(cs => cs.map(c => c.id === drawerConv.id ? { ...c, buyerEmail: val || undefined } : c));
                      setDrawerConv(prev => prev ? { ...prev, buyerEmail: val || undefined } : prev);
                      fetch(`${BACKEND_URL}/api/conversations/${drawerConv.id}`, {
                        method: 'PATCH',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ buyerEmail: val || null }),
                      }).catch(() => {});
                    }}
                  />
                </div>
              </div>
              <button
                onClick={() => setDrawerConv(null)}
                className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Stage pill selector */}
            <div
              className="flex gap-1.5 overflow-x-auto pb-1 mb-3"
              style={{ scrollbarWidth: 'none' }}
            >
              {CRM_COLUMNS.map((col, idx) => {
                const currentIdx = CRM_COLUMNS.findIndex(c => c.id === drawerConv.crmStatus);
                const isActive = col.id === drawerConv.crmStatus;
                const isPast = idx < currentIdx;
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => updateCrmStatus(drawerConv.id, col.id)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-dm font-medium whitespace-nowrap cursor-pointer transition-all shrink-0 ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : isPast
                          ? 'bg-secondary text-muted-foreground border border-border hover:border-primary/40 hover:text-foreground'
                          : 'text-muted-foreground/40 border border-border/40 hover:text-muted-foreground hover:border-border'
                    }`}
                  >
                    {col.label}
                  </button>
                );
              })}
            </div>

            {/* Schedule appointment */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowApptModal(true)}
              className="font-dm text-xs gap-1.5 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 w-full"
            >
              <CalendarDays className="w-3 h-3" />
              Schedule Appointment
            </Button>
          </div>

          {/* Messages thread */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {drawerMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <MessageSquare className="w-8 h-8 text-muted-foreground mb-2 opacity-40" />
                <p className="font-dm text-sm text-muted-foreground">No messages yet</p>
              </div>
            ) : null}
            {drawerMessages.map(msg => (
              <div key={msg.id} className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[82%] flex flex-col gap-1 ${msg.direction === 'outgoing' ? 'items-end' : 'items-start'}`}>
                  <div className={`rounded-2xl px-4 py-2.5 font-dm text-sm leading-relaxed ${
                    msg.direction === 'outgoing'
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-secondary text-foreground border border-border rounded-bl-sm'
                  }`}>
                    {msg.body}
                  </div>
                  <div className="flex items-center gap-1.5 px-1">
                    <span className="font-dm text-[10px] text-muted-foreground">{timeAgo(msg.createdAt)}</span>
                    {msg.source === 'ai_auto' ? (
                      <span className="font-dm text-[10px] text-primary flex items-center gap-0.5">
                        <Bot className="w-2.5 h-2.5" /> AI
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply composer */}
          <div className="p-4 border-t border-border space-y-2 shrink-0">
            <Textarea
              value={drawerDraft}
              onChange={e => setDrawerDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendDrawerMessage(); }}
              placeholder="Type a reply... (Ctrl+Enter to send)"
              className="bg-secondary border-border font-dm text-sm resize-none min-h-[72px] max-h-[120px]"
              rows={3}
            />
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={getDrawerAiReply}
                disabled={drawerAiLoading}
                className="font-dm text-xs border-primary/30 text-primary hover:bg-primary/10 gap-1.5"
              >
                {drawerAiLoading ? (
                  <><Loader2 className="w-3 h-3 animate-spin" />Generating...</>
                ) : (
                  <><Sparkles className="w-3 h-3" />AI Reply</>
                )}
              </Button>
              <Button
                size="sm"
                onClick={sendDrawerMessage}
                disabled={!drawerDraft.trim() || drawerSending}
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-dm text-xs gap-1.5"
              >
                {drawerSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Send className="w-3 h-3" />Send</>}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Appointment Modal */}
      <AppointmentModal
        open={showApptModal}
        onClose={() => setShowApptModal(false)}
        conversationId={drawerConv?.id ?? ''}
        buyerName={drawerConv?.buyerName ?? ''}
        vehicle={drawerConv?.vehicle ?? ''}
        buyerPhone={drawerConv?.buyerPhone}
        onScheduled={() => {
          setShowApptModal(false);
          if (drawerConv) updateCrmStatus(drawerConv.id, 'appointment_scheduled');
        }}
      />
    </div>
  );
}
