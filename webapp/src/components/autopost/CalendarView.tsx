import { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Clock,
  Phone,
  CheckCircle2,
  Plus,
  Car,
  Loader2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

interface Appointment {
  id: string;
  conversationId?: string;
  buyerName: string;
  buyerPhone?: string;
  vehicle: string;
  scheduledAt: string;
  notes?: string;
  status: 'scheduled' | 'attended' | 'cancelled' | 'no_show';
}

const DEMO_APPOINTMENTS: Appointment[] = [
  {
    id: 'appt-1',
    buyerName: 'Sarah Williams',
    buyerPhone: '(305) 555-0123',
    vehicle: '2022 Honda CR-V EX-L',
    scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 14).toISOString(),
    notes: 'Wants to see sunroof feature. Coming with husband.',
    status: 'scheduled',
  },
  {
    id: 'appt-2',
    buyerName: 'Robert Chen',
    vehicle: '2021 Toyota Camry XSE',
    scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 38).toISOString(),
    notes: 'Pre-approved financing.',
    status: 'scheduled',
  },
];

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function apptStatusBadge(status: Appointment['status']) {
  if (status === 'scheduled') return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
  if (status === 'attended') return 'bg-green-500/10 text-green-400 border-green-500/20';
  if (status === 'cancelled') return 'bg-red-500/10 text-red-400 border-red-500/20';
  return 'bg-secondary text-muted-foreground border-border';
}

export function CalendarView() {
  const [appointments, setAppointments] = useState<Appointment[]>(DEMO_APPOINTMENTS);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [newApptModal, setNewApptModal] = useState(false);
  const [newApptForm, setNewApptForm] = useState({ buyerName: '', vehicle: '', scheduledAt: '', buyerPhone: '', notes: '' });
  const [newApptLoading, setNewApptLoading] = useState(false);

  useEffect(() => {
    loadAppointments();
  }, []);

  async function loadAppointments() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/appointments`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      const real: Appointment[] = data.data;
      if (real && real.length > 0) setAppointments(real);
    } catch {
      // Use demo data
    }
  }

  async function markAttended(apptId: string) {
    setAppointments(prev => prev.map(a => a.id === apptId ? { ...a, status: 'attended' } : a));
    try {
      await fetch(`${BACKEND_URL}/api/appointments/${apptId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'attended' }),
      });
    } catch { /* silent */ }
  }

  async function submitNewAppt() {
    if (!newApptForm.buyerName || !newApptForm.vehicle || !newApptForm.scheduledAt) return;
    setNewApptLoading(true);
    const payload = {
      buyerName: newApptForm.buyerName,
      vehicle: newApptForm.vehicle,
      scheduledAt: new Date(newApptForm.scheduledAt).toISOString(),
      buyerPhone: newApptForm.buyerPhone || undefined,
      notes: newApptForm.notes || undefined,
    };
    const newAppt: Appointment = {
      id: `appt-local-${Date.now()}`,
      ...payload,
      status: 'scheduled',
    };
    setAppointments(prev => [...prev, newAppt]);
    setNewApptModal(false);
    setNewApptForm({ buyerName: '', vehicle: '', scheduledAt: '', buyerPhone: '', notes: '' });
    toast.success('Appointment created!');
    try {
      await fetch(`${BACKEND_URL}/api/appointments`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch { /* silent */ }
    setNewApptLoading(false);
  }

  function getCalendarDays(): Date[] {
    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const startSunday = new Date(firstDay);
    startSunday.setDate(firstDay.getDate() - firstDay.getDay());
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(startSunday);
      d.setDate(startSunday.getDate() + i);
      days.push(d);
    }
    return days;
  }

  function getApptsForDay(day: Date) {
    return appointments.filter(a => {
      const d = new Date(a.scheduledAt);
      return d.getFullYear() === day.getFullYear() &&
        d.getMonth() === day.getMonth() &&
        d.getDate() === day.getDate();
    });
  }

  function isSameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  const calendarDays = getCalendarDays();
  const selectedDayAppts = selectedDay ? getApptsForDay(selectedDay) : [];
  const monthLabel = currentMonth.toLocaleDateString([], { month: 'long', year: 'numeric' });

  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const apptThisWeek = appointments.filter(a => {
    const d = new Date(a.scheduledAt);
    return d >= now && d <= weekFromNow;
  }).length;
  const totalScheduled = appointments.filter(a => a.status === 'scheduled').length;
  const totalAttended = appointments.filter(a => a.status === 'attended').length;

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div>
        <h1 className="font-bebas text-4xl tracking-wider text-foreground leading-none">CALENDAR</h1>
        <p className="font-dm text-sm text-muted-foreground mt-1">
          Manage test drive appointments and buyer meetups.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-start justify-between mb-2">
            <span className="font-dm text-xs text-muted-foreground uppercase tracking-wider">This Week</span>
            <CalendarDays className="w-4 h-4 text-primary" />
          </div>
          <div className="font-bebas text-3xl tracking-wider text-primary leading-none">{apptThisWeek}</div>
          <div className="font-dm text-xs text-muted-foreground mt-0.5">upcoming appointments</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-start justify-between mb-2">
            <span className="font-dm text-xs text-muted-foreground uppercase tracking-wider">Scheduled</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="font-bebas text-3xl tracking-wider text-cyan-400 leading-none">{totalScheduled}</div>
          <div className="font-dm text-xs text-muted-foreground mt-0.5">pending appointments</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-start justify-between mb-2">
            <span className="font-dm text-xs text-muted-foreground uppercase tracking-wider">Attended</span>
            <CheckCircle2 className="w-4 h-4 text-green-400" />
          </div>
          <div className="font-bebas text-3xl tracking-wider text-green-400 leading-none">{totalAttended}</div>
          <div className="font-dm text-xs text-muted-foreground mt-0.5">completed visits</div>
        </div>
      </div>

      {/* Calendar header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            className="p-2 rounded-md border border-border bg-card hover:bg-secondary transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-foreground" />
          </button>
          <h2 className="font-bebas text-2xl tracking-wider text-foreground min-w-[200px] text-center">
            {monthLabel.toUpperCase()}
          </h2>
          <button
            onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            className="p-2 rounded-md border border-border bg-card hover:bg-secondary transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-foreground" />
          </button>
          <button
            onClick={() => {
              const d = new Date();
              setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
            }}
            className="ml-2 px-3 py-1.5 rounded-md border border-border bg-card hover:bg-secondary font-dm text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Today
          </button>
        </div>
        <Button
          size="sm"
          onClick={() => setNewApptModal(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90 font-dm text-xs gap-1.5"
        >
          <Plus className="w-3 h-3" />
          New Appointment
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="px-2 py-2 text-center">
              <span className="font-dm text-xs font-semibold text-muted-foreground">{d}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {calendarDays.map((day, idx) => {
            const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
            const isToday = isSameDay(day, new Date());
            const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
            const dayAppts = getApptsForDay(day);
            return (
              <div
                key={idx}
                onClick={() => setSelectedDay(isSelected ? null : day)}
                className={`min-h-[80px] p-2 border-b border-r border-border cursor-pointer transition-colors hover:bg-secondary/40 ${
                  isSelected ? 'bg-primary/5' : ''
                } ${!isCurrentMonth ? 'opacity-40' : ''} ${idx % 7 === 6 ? 'border-r-0' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-dm text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                    isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'
                  }`}>
                    {day.getDate()}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {dayAppts.slice(0, 2).map(appt => (
                    <div key={appt.id} className="bg-primary/10 text-primary rounded px-1 py-0.5 font-dm text-[10px] truncate">
                      {formatTime(appt.scheduledAt)} {appt.buyerName.split(' ')[0]}
                    </div>
                  ))}
                  {dayAppts.length > 2 ? (
                    <div className="font-dm text-[10px] text-muted-foreground pl-1">+{dayAppts.length - 2} more</div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected day detail */}
      {selectedDay ? (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bebas text-xl tracking-wider text-foreground">
              {selectedDay.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}
            </h3>
            <button onClick={() => setSelectedDay(null)} className="p-1 rounded text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          {selectedDayAppts.length === 0 ? (
            <div className="text-center py-6">
              <CalendarDays className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
              <p className="font-dm text-sm text-muted-foreground">No appointments this day</p>
            </div>
          ) : null}
          {selectedDayAppts.map(appt => (
            <div key={appt.id} className="bg-background border border-border rounded-lg p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-dm text-sm font-semibold text-foreground">{appt.buyerName}</span>
                    <span className={`font-dm text-[10px] font-semibold px-1.5 py-0.5 rounded border capitalize ${apptStatusBadge(appt.status)}`}>
                      {appt.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 font-dm text-xs text-muted-foreground mb-1">
                    <Car className="w-3 h-3 shrink-0" />
                    {appt.vehicle}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-dm text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(appt.scheduledAt)}
                    </span>
                    {appt.buyerPhone ? (
                      <span className="font-dm text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {appt.buyerPhone}
                      </span>
                    ) : null}
                  </div>
                  {appt.notes ? (
                    <p className="font-dm text-xs text-muted-foreground mt-2 italic">{appt.notes}</p>
                  ) : null}
                </div>
                {appt.status === 'scheduled' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => markAttended(appt.id)}
                    className="font-dm text-xs gap-1.5 border-green-500/30 text-green-400 hover:bg-green-500/10 shrink-0"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    Mark Attended
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* New appointment modal */}
      {newApptModal ? (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setNewApptModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bebas text-2xl tracking-wider text-foreground">NEW APPOINTMENT</h2>
                <button onClick={() => setNewApptModal(false)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="font-dm text-xs text-muted-foreground mb-1 block">Buyer Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. John Smith"
                    value={newApptForm.buyerName}
                    onChange={e => setNewApptForm(f => ({ ...f, buyerName: e.target.value }))}
                    className="w-full bg-secondary border border-border rounded-md font-dm text-sm text-foreground px-3 py-2 outline-none placeholder:text-muted-foreground focus:border-primary/50"
                  />
                </div>
                <div>
                  <label className="font-dm text-xs text-muted-foreground mb-1 block">Vehicle *</label>
                  <input
                    type="text"
                    placeholder="e.g. 2022 Honda CR-V EX-L"
                    value={newApptForm.vehicle}
                    onChange={e => setNewApptForm(f => ({ ...f, vehicle: e.target.value }))}
                    className="w-full bg-secondary border border-border rounded-md font-dm text-sm text-foreground px-3 py-2 outline-none placeholder:text-muted-foreground focus:border-primary/50"
                  />
                </div>
                <div>
                  <label className="font-dm text-xs text-muted-foreground mb-1 block">Date & Time *</label>
                  <input
                    type="datetime-local"
                    value={newApptForm.scheduledAt}
                    onChange={e => setNewApptForm(f => ({ ...f, scheduledAt: e.target.value }))}
                    className="w-full bg-secondary border border-border rounded-md font-dm text-sm text-foreground px-3 py-2 outline-none focus:border-primary/50"
                  />
                </div>
                <div>
                  <label className="font-dm text-xs text-muted-foreground mb-1 block">Phone</label>
                  <input
                    type="tel"
                    placeholder="(305) 555-0123"
                    value={newApptForm.buyerPhone}
                    onChange={e => setNewApptForm(f => ({ ...f, buyerPhone: e.target.value }))}
                    className="w-full bg-secondary border border-border rounded-md font-dm text-sm text-foreground px-3 py-2 outline-none placeholder:text-muted-foreground focus:border-primary/50"
                  />
                </div>
                <div>
                  <label className="font-dm text-xs text-muted-foreground mb-1 block">Notes</label>
                  <Textarea
                    value={newApptForm.notes}
                    onChange={e => setNewApptForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Any notes about this appointment..."
                    className="bg-secondary border-border font-dm text-sm resize-none min-h-[72px]"
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  onClick={submitNewAppt}
                  disabled={newApptLoading || !newApptForm.buyerName || !newApptForm.vehicle || !newApptForm.scheduledAt}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 font-dm text-sm flex-1 gap-1.5"
                >
                  {newApptLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <><CheckCircle2 className="w-4 h-4" />Create Appointment</>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setNewApptModal(false)} className="font-dm text-sm border-border">
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
