import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send,
  Sparkles,
  Loader2,
  Bot,
  TrendingUp,
  Phone,
  Mail,
  MessageSquare,
  Flame,
  Calendar,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { AppointmentModal } from './AppointmentModal';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

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
  lastMessageAt: string;
  createdAt: string;
  messages?: Message[];
  unread?: number;
}

// ─── Demo Data ────────────────────────────────────────────────────────────────

const DEMO: Conversation[] = [
  {
    id: 'demo-1',
    buyerName: 'Maria Gonzalez',
    vehicle: '2024 Acura RDX A-Spec',
    vehiclePrice: '$35,656',
    intentScore: 82,
    status: 'new',
    unread: 2,
    lastMessageAt: new Date(Date.now() - 120000).toISOString(),
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    messages: [
      { id: 'm1', conversationId: 'demo-1', direction: 'incoming', body: 'Hi! Is this still available?', source: 'fb_marketplace', intentScore: 10, createdAt: new Date(Date.now() - 3600000).toISOString() },
      { id: 'm2', conversationId: 'demo-1', direction: 'outgoing', body: 'Yes it is! The RDX A-Spec is on the lot right now. Would you like to schedule a test drive?', source: 'ai_auto', intentScore: 0, createdAt: new Date(Date.now() - 3400000).toISOString() },
      { id: 'm3', conversationId: 'demo-1', direction: 'incoming', body: "What's the lowest you can do on price? Also do you offer financing?", source: 'fb_marketplace', intentScore: 40, createdAt: new Date(Date.now() - 1800000).toISOString() },
      { id: 'm4', conversationId: 'demo-1', direction: 'incoming', body: "I can come in tomorrow afternoon if the price works", source: 'fb_marketplace', intentScore: 60, createdAt: new Date(Date.now() - 120000).toISOString() },
    ],
  },
  {
    id: 'demo-2',
    buyerName: 'James Wilson',
    vehicle: '2024 Acura RDX A-Spec',
    vehiclePrice: '$35,656',
    intentScore: 95,
    status: 'contacted',
    unread: 0,
    lastMessageAt: new Date(Date.now() - 5400000).toISOString(),
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    messages: [
      { id: 'm5', conversationId: 'demo-2', direction: 'incoming', body: "I'd like to schedule a test drive this weekend. Is Saturday open?", source: 'fb_marketplace', intentScore: 60, createdAt: new Date(Date.now() - 172800000).toISOString() },
      { id: 'm6', conversationId: 'demo-2', direction: 'outgoing', body: 'Absolutely! Saturday is wide open. What time works best for you?', source: 'ai_auto', intentScore: 0, createdAt: new Date(Date.now() - 172000000).toISOString() },
      { id: 'm7', conversationId: 'demo-2', direction: 'incoming', body: "10am? I'm pre-approved through my credit union at 4.9% — can you beat it?", source: 'fb_marketplace', intentScore: 80, createdAt: new Date(Date.now() - 86400000).toISOString() },
      { id: 'm8', conversationId: 'demo-2', direction: 'outgoing', body: "10am Saturday is perfect! Being pre-approved is great — we'll check if we can beat that rate. See you then!", source: 'manual', intentScore: 0, createdAt: new Date(Date.now() - 85000000).toISOString() },
      { id: 'm9', conversationId: 'demo-2', direction: 'incoming', body: 'Sounds good. My number is 215-555-0147 if you need to reach me', source: 'fb_marketplace', intentScore: 95, createdAt: new Date(Date.now() - 5400000).toISOString() },
    ],
  },
  {
    id: 'demo-3',
    buyerName: 'Ashley Turner',
    vehicle: '2021 Toyota Corolla Nightshade',
    vehiclePrice: '$19,800',
    intentScore: 91,
    status: 'converted',
    unread: 0,
    lastMessageAt: new Date(Date.now() - 10800000).toISOString(),
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    messages: [
      { id: 'm10', conversationId: 'demo-3', direction: 'incoming', body: "Does it come with warranty? I'm very interested!", source: 'fb_marketplace', intentScore: 40, createdAt: new Date(Date.now() - 86400000).toISOString() },
      { id: 'm11', conversationId: 'demo-3', direction: 'outgoing', body: "Great question! Yes, it comes with the remaining factory warranty. Would you like to come see it?", source: 'ai_auto', intentScore: 0, createdAt: new Date(Date.now() - 86000000).toISOString() },
      { id: 'm12', conversationId: 'demo-3', direction: 'incoming', body: 'Yes! Can I come Saturday at 2pm?', source: 'fb_marketplace', intentScore: 70, createdAt: new Date(Date.now() - 43200000).toISOString() },
      { id: 'm13', conversationId: 'demo-3', direction: 'outgoing', body: "Saturday at 2pm works perfectly! I'll have it pulled up front for you. See you then!", source: 'manual', intentScore: 0, createdAt: new Date(Date.now() - 42000000).toISOString() },
      { id: 'm14', conversationId: 'demo-3', direction: 'incoming', body: "Perfect, see you then! I'll bring my trade-in too", source: 'fb_marketplace', intentScore: 91, createdAt: new Date(Date.now() - 10800000).toISOString() },
    ],
  },
  {
    id: 'demo-4',
    buyerName: 'Carlos Reyes',
    vehicle: '2021 Dodge Challenger SXT',
    vehiclePrice: '$24,900',
    intentScore: 65,
    status: 'new',
    unread: 1,
    lastMessageAt: new Date(Date.now() - 900000).toISOString(),
    createdAt: new Date(Date.now() - 14400000).toISOString(),
    messages: [
      { id: 'm15', conversationId: 'demo-4', direction: 'incoming', body: "What's the lowest you'll take? I can come tomorrow.", source: 'fb_marketplace', intentScore: 40, createdAt: new Date(Date.now() - 14400000).toISOString() },
      { id: 'm16', conversationId: 'demo-4', direction: 'outgoing', body: "Thanks for your interest! The Challenger is priced competitively at $24,900. Happy to discuss in person — when works for you?", source: 'ai_auto', intentScore: 0, createdAt: new Date(Date.now() - 14000000).toISOString() },
      { id: 'm17', conversationId: 'demo-4', direction: 'incoming', body: "I was thinking more around 22k. Is that doable?", source: 'fb_marketplace', intentScore: 65, createdAt: new Date(Date.now() - 900000).toISOString() },
    ],
  },
  {
    id: 'demo-5',
    buyerName: 'Priya Patel',
    vehicle: '2023 BMW 3 Series 330i',
    vehiclePrice: '$44,800',
    intentScore: 28,
    status: 'new',
    unread: 1,
    lastMessageAt: new Date(Date.now() - 21600000).toISOString(),
    createdAt: new Date(Date.now() - 21600000).toISOString(),
    messages: [
      { id: 'm18', conversationId: 'demo-5', direction: 'incoming', body: 'How many miles does this have? And what color is the interior?', source: 'fb_marketplace', intentScore: 28, createdAt: new Date(Date.now() - 21600000).toISOString() },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function intentConfig(score: number) {
  if (score >= 80) return { label: 'Hot Lead', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', dot: 'bg-red-400', barColor: 'bg-red-400' };
  if (score >= 60) return { label: 'Interested', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', dot: 'bg-amber-400', barColor: 'bg-amber-400' };
  if (score >= 35) return { label: 'Browsing', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', dot: 'bg-blue-400', barColor: 'bg-blue-400' };
  return { label: 'Low Intent', color: 'text-muted-foreground', bg: 'bg-secondary border-border', dot: 'bg-muted-foreground', barColor: 'bg-muted-foreground' };
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function genQuickReply(vehicle: string, price: string | undefined, lastMsg: string): string {
  const t = lastMsg.toLowerCase();
  if (/available|still for sale/.test(t)) return `Yes, the ${vehicle} is available and on the lot! Would you like to schedule a test drive?`;
  if (/price|lowest|deal|offer|best/.test(t)) return `The ${vehicle} is competitively priced at ${price ?? 'a great value'}. I'd love to discuss in person — when can you come in?`;
  if (/financ|loan|payment|pre.?approv/.test(t)) return `We work with multiple lenders and usually find great rates. Come in and our finance team will run numbers for you!`;
  if (/test drive|come in|schedule|appoint|visit/.test(t)) return `Absolutely! I'd love to set up a test drive. What day and time works best for you?`;
  if (/warranty|carfax|history|accident/.test(t)) return `Great question! This vehicle has a clean history. I can have the full Carfax ready when you visit. Want to come in?`;
  if (/miles|mileage|color|interior|spec/.test(t)) return `Happy to share all the details! Would you also like to come see it in person?`;
  if (/deliver|ship/.test(t)) return `We can discuss delivery options! What's your zip code so I can give you an accurate estimate?`;
  if (/trade/.test(t)) return `We'd love to look at your trade-in! Bring it when you visit and we'll give you a fair appraisal on the spot.`;
  if (/phone|number|call/.test(t)) return `Thanks! I've noted your number and will reach out shortly. Looking forward to connecting!`;
  return `Thanks for reaching out about the ${vehicle}! When would be a good time to come see it in person?`;
}

type FilterTab = 'all' | 'unread' | 'hot' | 'appt';

// ─── EditableField ────────────────────────────────────────────────────────────

function EditableField({
  value, onChange, placeholder, icon: Icon,
}: {
  value?: string;
  onChange: (val: string) => void;
  placeholder: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
  useEffect(() => { setDraft(value || ''); }, [value]);

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
        className="font-dm text-[11px] text-foreground bg-secondary border border-primary/40 rounded px-1.5 py-0.5 outline-none w-36"
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
      className="font-dm text-[11px] text-muted-foreground/40 hover:text-muted-foreground transition-colors"
    >
      {placeholder}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function LeadsView() {
  const [conversations, setConversations] = useState<Conversation[]>(DEMO);
  const [selected, setSelected] = useState<Conversation | null>(DEMO[0]);
  const [messages, setMessages] = useState<Message[]>(DEMO[0].messages || []);
  const [draft, setDraft] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [typingId, setTypingId] = useState<string | null>(null);
  const [showApptModal, setShowApptModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load real conversations on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/conversations`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        const real: Conversation[] = data.data;
        if (real && real.length > 0) {
          const withUnread = real.map(c => ({ ...c, unread: c.status === 'new' ? 1 : 0 }));
          setConversations(withUnread);
          setSelected(withUnread[0]);
          setMessages(withUnread[0].messages || []);
        }
      } catch { /* keep demo */ }
    })();
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Generate AI suggestion when selecting a conversation with unread
  useEffect(() => {
    if (!selected) { setAiSuggestion(null); return; }
    const lastIncoming = [...(selected.messages || [])].reverse().find(m => m.direction === 'incoming');
    if (lastIncoming && (selected.unread ?? 0) > 0) {
      setAiSuggestion(genQuickReply(selected.vehicle, selected.vehiclePrice, lastIncoming.body));
    } else {
      setAiSuggestion(null);
    }
  }, [selected?.id]);

  async function selectConversation(conv: Conversation) {
    setSelected(conv);
    setDraft('');
    // Mark as read
    setConversations(cs => cs.map(c => c.id === conv.id ? { ...c, unread: 0 } : c));

    if (conv.messages && conv.messages.length > 0) {
      setMessages(conv.messages);
      return;
    }
    if (!conv.id.startsWith('demo-')) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/conversations/${conv.id}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          const msgs: Message[] = data.data.messages || [];
          setMessages(msgs);
          setConversations(cs => cs.map(c => c.id === conv.id ? { ...c, messages: msgs } : c));
          return;
        }
      } catch { /* fall through */ }
    }
    setMessages(conv.messages || []);
  }

  const sendMessage = useCallback(async (text?: string, src = 'manual') => {
    const body = (text ?? draft).trim();
    if (!body || !selected) return;
    setSending(true);
    setDraft('');
    setAiSuggestion(null);

    const newMsg: Message = {
      id: `local-${Date.now()}`,
      conversationId: selected.id,
      direction: 'outgoing',
      body,
      source: src,
      intentScore: 0,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, newMsg]);
    setConversations(cs => cs.map(c =>
      c.id === selected.id
        ? { ...c, messages: [...(c.messages || []), newMsg], lastMessageAt: new Date().toISOString(), status: c.status === 'new' ? 'contacted' : c.status }
        : c
    ));

    if (!selected.id.startsWith('demo-')) {
      try {
        await fetch(`${BACKEND_URL}/api/conversations/${selected.id}/messages`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ direction: 'outgoing', body, source: src }),
        });
      } catch { /* silent */ }
    }
    setSending(false);
  }, [selected, draft]);

  async function getAiReply() {
    if (!selected) return;
    setAiLoading(true);
    try {
      if (!selected.id.startsWith('demo-')) {
        const res = await fetch(`${BACKEND_URL}/api/conversations/${selected.id}/ai-reply`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        if (res.ok) {
          const data = await res.json();
          setDraft(data.data.reply);
          toast.success('AI reply ready — review and send!');
          return;
        }
      }
      // Fallback local generation
      const lastMsg = messages[messages.length - 1];
      const reply = genQuickReply(selected.vehicle, selected.vehiclePrice, lastMsg?.body ?? '');
      setDraft(reply);
      toast.success('AI reply ready — review and send!');
    } finally {
      setAiLoading(false);
    }
  }

  // Filtered & sorted conversation list
  const filtered = conversations.filter(c => {
    if (filter === 'unread') return (c.unread ?? 0) > 0;
    if (filter === 'hot') return c.intentScore >= 70;
    if (filter === 'appt') return c.status === 'converted';
    return true;
  }).sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

  const totalUnread = conversations.reduce((s, c) => s + (c.unread ?? 0), 0);
  const hotCount = conversations.filter(c => c.intentScore >= 70).length;
  const totalCount = conversations.length;

  const QUICK_REPLIES = [
    "Yes, it's still available!",
    "When can you come in?",
    "We offer financing!",
    "What's your phone number?",
  ];

  return (
    <div className="flex flex-col h-full space-y-0 -mx-6 -mt-6" style={{ height: 'calc(100vh - 64px)' }}>

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card shrink-0">
        <div>
          <h1 className="font-bebas text-3xl tracking-wider text-foreground leading-none">CONVERSATIONS</h1>
          <p className="font-dm text-xs text-muted-foreground mt-0.5">Facebook Marketplace inbox — replies route back to Messenger via extension</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Stats chips */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-secondary border border-border rounded-md px-2.5 py-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="font-dm text-xs text-muted-foreground">Extension live</span>
            </div>
            {totalUnread > 0 && (
              <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-md px-2.5 py-1.5">
                <span className="font-dm text-xs font-semibold text-primary">{totalUnread} unread</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-md px-2.5 py-1.5">
              <Flame className="w-3 h-3 text-red-400" />
              <span className="font-dm text-xs font-semibold text-red-400">{hotCount} hot</span>
            </div>
            <div className="flex items-center gap-1.5 bg-secondary border border-border rounded-md px-2.5 py-1.5">
              <MessageSquare className="w-3 h-3 text-muted-foreground" />
              <span className="font-dm text-xs text-muted-foreground">{totalCount} total</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main split panel ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT: Conversation list ── */}
        <div className="w-[280px] shrink-0 border-r border-border flex flex-col bg-card">

          {/* Filter tabs */}
          <div className="flex items-center gap-0.5 p-2 border-b border-border">
            {([['all', 'All'], ['unread', 'Unread'], ['hot', '🔥 Hot'], ['appt', 'Appt']] as [FilterTab, string][]).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`flex-1 font-dm text-[11px] font-semibold py-1.5 rounded transition-colors ${
                  filter === k
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center h-32 text-center px-4">
                <p className="font-dm text-xs text-muted-foreground">No conversations</p>
              </div>
            )}
            {filtered.map(conv => {
              const isActive = selected?.id === conv.id;
              const ic = intentConfig(conv.intentScore);
              const lastMsg = conv.messages?.[conv.messages.length - 1];
              const isTyping = typingId === conv.id;

              return (
                <button
                  key={conv.id}
                  onClick={() => selectConversation(conv)}
                  className={`w-full text-left px-3 py-3 border-b border-border/40 transition-all hover:bg-secondary/40 ${
                    isActive ? 'bg-primary/5 border-l-2 border-l-primary' : 'border-l-2 border-l-transparent'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Avatar */}
                    <div className={`w-9 h-9 rounded-lg shrink-0 flex items-center justify-center font-dm text-xs font-bold ${
                      conv.intentScore >= 70 ? 'bg-red-500/15 text-red-400' :
                      conv.intentScore >= 50 ? 'bg-amber-500/15 text-amber-400' :
                      'bg-secondary text-muted-foreground'
                    }`}>
                      {getInitials(conv.buyerName)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className={`font-dm text-sm truncate ${(conv.unread ?? 0) > 0 ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'}`}>
                          {conv.buyerName}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="font-dm text-[10px] text-muted-foreground">{timeAgo(conv.lastMessageAt)}</span>
                          {(conv.unread ?? 0) > 0 && (
                            <span className="w-4 h-4 rounded-full bg-primary flex items-center justify-center font-dm text-[9px] font-bold text-primary-foreground">
                              {conv.unread}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="font-dm text-[11px] text-muted-foreground truncate mb-1">{conv.vehicle}</div>

                      <div className="flex items-center justify-between gap-1">
                        <div className="font-dm text-[10px] text-muted-foreground/60 truncate flex-1">
                          {isTyping ? (
                            <span className="text-blue-400 flex items-center gap-1">
                              <span className="inline-flex gap-0.5">
                                {[0,1,2].map(i => <span key={i} className="w-1 h-1 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                              </span>
                              typing...
                            </span>
                          ) : lastMsg ? (
                            lastMsg.direction === 'outgoing'
                              ? <span className="text-muted-foreground/50">You: {lastMsg.body}</span>
                              : lastMsg.body
                          ) : null}
                        </div>
                        <span className={`font-dm text-[10px] font-bold shrink-0 ${ic.color}`}>{conv.intentScore}</span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT: Chat panel ── */}
        {!selected ? (
          <div className="flex-1 flex items-center justify-center bg-background">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-20" />
              <p className="font-dm text-sm text-muted-foreground">Select a conversation</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-w-0 bg-background">

            {/* ── Chat header ── */}
            <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-4 shrink-0 bg-card">
              <div className="flex items-center gap-3 min-w-0">
                {/* Avatar */}
                <div className={`w-10 h-10 rounded-lg shrink-0 flex items-center justify-center font-dm text-sm font-bold ${
                  selected.intentScore >= 70 ? 'bg-red-500/15 text-red-400' :
                  selected.intentScore >= 50 ? 'bg-amber-500/15 text-amber-400' :
                  'bg-secondary text-muted-foreground'
                }`}>
                  {getInitials(selected.buyerName)}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-dm text-sm font-semibold text-foreground">{selected.buyerName}</span>
                    {/* Intent badge */}
                    <span className={`font-dm text-[10px] font-semibold px-2 py-0.5 rounded-full border ${intentConfig(selected.intentScore).bg} ${intentConfig(selected.intentScore).color}`}>
                      {intentConfig(selected.intentScore).label} · {selected.intentScore}
                    </span>
                  </div>
                  <div className="font-dm text-xs text-muted-foreground truncate">
                    {selected.vehicle}{selected.vehiclePrice ? ` · ${selected.vehiclePrice}` : ''}
                  </div>
                  {/* Editable contact fields */}
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <EditableField
                      value={selected.buyerPhone}
                      placeholder="+ phone"
                      icon={Phone}
                      onChange={val => {
                        setConversations(cs => cs.map(c => c.id === selected.id ? { ...c, buyerPhone: val || undefined } : c));
                        setSelected(prev => prev ? { ...prev, buyerPhone: val || undefined } : prev);
                        if (!selected.id.startsWith('demo-')) {
                          fetch(`${BACKEND_URL}/api/conversations/${selected.id}`, {
                            method: 'PATCH', credentials: 'include',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ buyerPhone: val || null }),
                          }).catch(() => {});
                        }
                      }}
                    />
                    <EditableField
                      value={selected.buyerEmail}
                      placeholder="+ email"
                      icon={Mail}
                      onChange={val => {
                        setConversations(cs => cs.map(c => c.id === selected.id ? { ...c, buyerEmail: val || undefined } : c));
                        setSelected(prev => prev ? { ...prev, buyerEmail: val || undefined } : prev);
                        if (!selected.id.startsWith('demo-')) {
                          fetch(`${BACKEND_URL}/api/conversations/${selected.id}`, {
                            method: 'PATCH', credentials: 'include',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ buyerEmail: val || null }),
                          }).catch(() => {});
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Right actions */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Intent bar */}
                <div className="hidden lg:flex flex-col items-end gap-1">
                  <span className="font-dm text-[10px] text-muted-foreground">Intent</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-24 h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${intentConfig(selected.intentScore).barColor}`}
                        style={{ width: `${selected.intentScore}%` }}
                      />
                    </div>
                    <span className={`font-dm text-xs font-bold ${intentConfig(selected.intentScore).color}`}>{selected.intentScore}%</span>
                  </div>
                </div>

                <button
                  onClick={() => setShowApptModal(true)}
                  className="flex items-center gap-1.5 bg-secondary border border-border rounded-md px-3 py-1.5 font-dm text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <Calendar className="w-3.5 h-3.5" />
                  Schedule
                </button>

                <div className="flex items-center gap-1.5 bg-secondary border border-border rounded-md px-2.5 py-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="font-dm text-xs text-green-500">FB Live</span>
                </div>
              </div>
            </div>

            {/* ── Listing context bar ── */}
            <div className="px-5 py-2 border-b border-border/50 bg-blue-500/5 flex items-center gap-3 shrink-0">
              <div className="w-6 h-6 rounded bg-blue-500/20 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" fill="#1877F2" className="w-3.5 h-3.5">
                  <path d="M12 2.04C6.5 2.04 2 6.53 2 12.06C2 17.06 5.66 21.21 10.44 21.96V14.96H7.9V12.06H10.44V9.85C10.44 7.34 11.93 5.96 14.22 5.96C15.31 5.96 16.45 6.15 16.45 6.15V8.62H15.19C13.95 8.62 13.56 9.39 13.56 10.18V12.06H16.34L15.89 14.96H13.56V21.96A10 10 0 0 0 22 12.06C22 6.53 17.5 2.04 12 2.04Z"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-dm text-xs text-foreground font-medium">{selected.vehicle}</span>
                {selected.vehiclePrice && <span className="font-dm text-xs text-muted-foreground ml-2">{selected.vehiclePrice}</span>}
                {selected.listingUrl && <span className="font-dm text-[10px] text-blue-400 ml-2">· FB Marketplace listing</span>}
              </div>
              <span className="font-dm text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full shrink-0">Imported</span>
            </div>

            {/* ── Messages ── */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <MessageSquare className="w-10 h-10 text-muted-foreground mb-3 opacity-20" />
                  <p className="font-dm text-sm text-muted-foreground">No messages yet</p>
                </div>
              )}

              {messages.map((msg, idx) => {
                const isOut = msg.direction === 'outgoing';
                const showName = !isOut && (idx === 0 || messages[idx - 1]?.direction !== 'incoming');
                return (
                  <div key={msg.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] flex flex-col gap-1 ${isOut ? 'items-end' : 'items-start'}`}>
                      {showName && (
                        <span className="font-dm text-[10px] text-muted-foreground px-1">{selected.buyerName.split(' ')[0]}</span>
                      )}
                      <div className={`rounded-2xl px-4 py-2.5 font-dm text-sm leading-relaxed ${
                        isOut
                          ? msg.source === 'ai_auto' || msg.source === 'ai_suggested'
                            ? 'bg-blue-500/15 border border-blue-500/20 text-foreground rounded-br-sm'
                            : 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-secondary text-foreground border border-border rounded-bl-sm'
                      }`}>
                        {msg.body}
                      </div>
                      <div className="flex items-center gap-1.5 px-1">
                        <span className="font-dm text-[10px] text-muted-foreground/50">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {(msg.source === 'ai_auto' || msg.source === 'ai_suggested') && (
                          <span className="font-dm text-[9px] font-semibold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <Bot className="w-2.5 h-2.5" /> AI
                          </span>
                        )}
                        {msg.source === 'manual' && isOut && (
                          <span className="font-dm text-[9px] font-semibold text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">
                            YOU
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Typing indicator */}
              {typingId === selected.id && (
                <div className="flex justify-start">
                  <div className="bg-secondary border border-border rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
                    {[0, 1, 2].map(i => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* ── AI Suggestion banner ── */}
            {aiSuggestion && (
              <div className="px-4 py-2.5 border-t border-blue-500/20 bg-blue-500/5 flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1.5 shrink-0">
                  <Zap className="w-3 h-3 text-blue-400" />
                  <span className="font-dm text-[10px] font-semibold text-blue-400 uppercase tracking-wide">AI Suggestion</span>
                </div>
                <div className="font-dm text-xs text-muted-foreground flex-1 truncate">{aiSuggestion}</div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => sendMessage(aiSuggestion, 'ai_suggested')}
                    className="font-dm text-[11px] font-semibold bg-blue-500 hover:bg-blue-600 text-white px-2.5 py-1 rounded transition-colors"
                  >
                    Send
                  </button>
                  <button
                    onClick={() => { setDraft(aiSuggestion); setAiSuggestion(null); }}
                    className="font-dm text-[11px] font-semibold bg-secondary border border-border hover:border-border/80 text-muted-foreground px-2.5 py-1 rounded transition-colors"
                  >
                    Edit
                  </button>
                  <button onClick={() => setAiSuggestion(null)} className="text-muted-foreground hover:text-foreground transition-colors font-dm text-base leading-none px-1">×</button>
                </div>
              </div>
            )}

            {/* ── Composer ── */}
            <div className="p-4 border-t border-border space-y-2.5 shrink-0 bg-card">
              <Textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                }}
                placeholder="Type a reply... (Enter to send, Shift+Enter for new line)"
                className="bg-secondary border-border font-dm text-sm resize-none min-h-[60px] max-h-[120px]"
                rows={2}
              />

              {/* Quick replies */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {QUICK_REPLIES.map(q => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="font-dm text-[10px] text-muted-foreground bg-secondary hover:bg-secondary/80 border border-border hover:border-border/60 rounded px-2 py-1 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={getAiReply}
                    disabled={aiLoading}
                    className="font-dm text-xs border-primary/30 text-primary hover:bg-primary/10 gap-1.5 h-8"
                  >
                    {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    AI Reply
                  </Button>

                  <div className="font-dm text-[9px] text-muted-foreground/40 flex items-center gap-1 ml-1">
                    <TrendingUp className="w-2.5 h-2.5" />
                    Replies route to Facebook via extension
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={() => sendMessage()}
                  disabled={!draft.trim() || sending}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 font-dm text-xs gap-1.5 h-8"
                >
                  {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Send className="w-3 h-3" />Send</>}
                </Button>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Appointment Modal */}
      <AppointmentModal
        open={showApptModal}
        onClose={() => setShowApptModal(false)}
        conversationId={selected?.id ?? ''}
        buyerName={selected?.buyerName ?? ''}
        vehicle={selected?.vehicle ?? ''}
        buyerPhone={selected?.buyerPhone}
        onScheduled={() => setShowApptModal(false)}
      />
    </div>
  );
}
