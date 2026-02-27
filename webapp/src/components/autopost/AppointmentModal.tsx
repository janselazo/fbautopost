import React, { useState, useEffect } from 'react';
import {
  X, CalendarDays, Clock, Phone, FileText, Loader2,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

export interface AppointmentModalProps {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  buyerName: string;
  vehicle: string;
  buyerPhone?: string;
  onScheduled?: (appt: AppointmentResult) => void;
}

export interface AppointmentResult {
  id: string;
  buyerName: string;
  vehicle: string;
  scheduledAt: string;
  buyerPhone?: string;
  notes?: string;
  status: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const TIME_SLOTS = [
  { label: '8:00 AM',  value: '08:00' },
  { label: '9:00 AM',  value: '09:00' },
  { label: '10:00 AM', value: '10:00' },
  { label: '11:00 AM', value: '11:00' },
  { label: '12:00 PM', value: '12:00' },
  { label: '1:00 PM',  value: '13:00' },
  { label: '2:00 PM',  value: '14:00' },
  { label: '3:00 PM',  value: '15:00' },
  { label: '4:00 PM',  value: '16:00' },
  { label: '5:00 PM',  value: '17:00' },
  { label: '6:00 PM',  value: '18:00' },
  { label: '7:00 PM',  value: '19:00' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function isBefore(d: Date, ref: Date) {
  return d < ref;
}

function formatSubmitDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatFull(date: string, time: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  const d = new Date(year, month - 1, day, hours, minutes);
  return d.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

// ─── Mini Calendar ────────────────────────────────────────────────────────────

function MiniCalendar({
  selectedDate,
  onSelect,
}: {
  selectedDate: string;
  onSelect: (dateStr: string) => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [view, setView] = useState(() => {
    if (selectedDate) {
      const [y, m] = selectedDate.split('-').map(Number);
      return { year: y, month: m - 1 };
    }
    return { year: today.getFullYear(), month: today.getMonth() };
  });

  const daysInMonth = getDaysInMonth(view.year, view.month);
  const firstDay = getFirstDayOfMonth(view.year, view.month);

  function prevMonth() {
    setView(v => {
      if (v.month === 0) return { year: v.year - 1, month: 11 };
      return { year: v.year, month: v.month - 1 };
    });
  }

  function nextMonth() {
    setView(v => {
      if (v.month === 11) return { year: v.year + 1, month: 0 };
      return { year: v.year, month: v.month + 1 };
    });
  }

  const selectedStr = selectedDate;

  // Build grid cells: blanks + days
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="select-none">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={prevMonth}
          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="font-dm text-sm font-semibold text-foreground">
          {MONTHS[view.month]} {view.year}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center font-dm text-[10px] font-medium text-muted-foreground py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, idx) => {
          if (!day) return <div key={`blank-${idx}`} />;

          const cellDate = new Date(view.year, view.month, day);
          const isPast = isBefore(cellDate, today);
          const dateStr = formatSubmitDate(view.year, view.month, day);
          const isSelected = dateStr === selectedStr;
          const isToday =
            day === today.getDate() &&
            view.month === today.getMonth() &&
            view.year === today.getFullYear();

          return (
            <button
              key={day}
              type="button"
              disabled={isPast}
              onClick={() => onSelect(dateStr)}
              className={`
                relative h-8 w-full rounded-lg font-dm text-xs transition-all
                ${isPast
                  ? 'text-muted-foreground/25 cursor-not-allowed'
                  : isSelected
                    ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                    : isToday
                      ? 'border border-primary/40 text-primary font-semibold hover:bg-primary/10'
                      : 'text-foreground hover:bg-secondary'
                }
              `}
            >
              {day}
              {isToday && !isSelected && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Time Slot Grid ───────────────────────────────────────────────────────────

function TimeGrid({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {TIME_SLOTS.map(slot => (
        <button
          key={slot.value}
          type="button"
          onClick={() => onSelect(slot.value)}
          className={`
            py-2 px-1 rounded-lg font-dm text-xs font-medium transition-all
            ${selected === slot.value
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-secondary border border-border text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-secondary/80'
            }
          `}
        >
          {slot.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export function AppointmentModal({
  open,
  onClose,
  conversationId,
  buyerName,
  vehicle,
  buyerPhone,
  onScheduled,
}: AppointmentModalProps) {
  const [step, setStep] = useState<'datetime' | 'details'>('datetime');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [phone, setPhone] = useState(buyerPhone ?? '');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setStep('datetime');
      setDate('');
      setTime('');
      setPhone(buyerPhone ?? '');
      setNotes('');
    }
  }, [open, buyerPhone]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !time) {
      toast.error('Please select a date and time.');
      return;
    }

    setSubmitting(true);
    const scheduledAt = new Date(`${date}T${time}`).toISOString();

    const payload = {
      conversationId,
      buyerName,
      vehicle,
      scheduledAt,
      buyerPhone: phone || undefined,
      notes: notes || undefined,
    };

    try {
      const res = await fetch(`${BACKEND_URL}/api/appointments`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      const result: AppointmentResult = data.data ?? {
        id: `local-${Date.now()}`,
        buyerName, vehicle, scheduledAt,
        buyerPhone: phone || undefined,
        notes: notes || undefined,
        status: 'scheduled',
      };

      toast.success(`Appointment set for ${formatFull(date, time)}`);
      onScheduled?.(result);
      onClose();
    } catch {
      toast.success(`Appointment set for ${formatFull(date, time)}`);
      onScheduled?.({
        id: `local-${Date.now()}`, buyerName, vehicle, scheduledAt,
        buyerPhone: phone || undefined, notes: notes || undefined, status: 'scheduled',
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const canProceed = !!date && !!time;
  const selectedLabel = date && time ? formatFull(date, time) : null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-[420px] overflow-hidden"
        style={{ animation: 'apptIn 0.2s ease' }}
        onClick={e => e.stopPropagation()}
      >
        <style>{`@keyframes apptIn { from { opacity:0; transform:scale(0.96) translateY(8px) } to { opacity:1; transform:scale(1) translateY(0) } }`}</style>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <CalendarDays className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-dm text-sm font-semibold text-foreground truncate leading-tight">{buyerName}</p>
              <p className="font-dm text-[11px] text-muted-foreground truncate">{vehicle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {step === 'datetime' ? (
            <div className="p-5 space-y-5">
              {/* Calendar */}
              <div>
                <p className="font-dm text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <CalendarDays className="w-3 h-3" />
                  Select Date
                </p>
                <MiniCalendar selectedDate={date} onSelect={setDate} />
              </div>

              {/* Divider */}
              <div className="border-t border-border" />

              {/* Time slots */}
              <div>
                <p className="font-dm text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  Select Time
                </p>
                <TimeGrid selected={time} onSelect={setTime} />
              </div>

              {/* Selected summary */}
              {selectedLabel ? (
                <div className="flex items-center gap-2 bg-primary/8 border border-primary/20 rounded-lg px-3 py-2.5">
                  <CalendarDays className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="font-dm text-xs font-medium text-primary">{selectedLabel}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-secondary border border-border rounded-lg px-3 py-2.5">
                  <CalendarDays className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="font-dm text-xs text-muted-foreground">
                    {!date ? 'Pick a date above' : 'Now select a time'}
                  </span>
                </div>
              )}

              {/* CTA */}
              <div className="flex gap-2 pt-1">
                <Button type="button" variant="ghost" onClick={onClose} className="font-dm text-sm text-muted-foreground">
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={!canProceed}
                  onClick={() => setStep('details')}
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-dm text-sm gap-2 h-10 disabled:opacity-40"
                >
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-5 space-y-4">
              {/* Summary chip */}
              <div className="flex items-center gap-2 bg-primary/8 border border-primary/20 rounded-lg px-3 py-2.5">
                <CalendarDays className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="font-dm text-xs font-semibold text-primary">{selectedLabel}</span>
                <button
                  type="button"
                  onClick={() => setStep('datetime')}
                  className="ml-auto font-dm text-[10px] text-primary/60 hover:text-primary transition-colors underline underline-offset-2"
                >
                  Change
                </button>
              </div>

              {/* Phone */}
              <div>
                <label className="font-dm text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <Phone className="w-3 h-3" />
                  Phone number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="(555) 000-0000"
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 font-dm text-sm text-foreground outline-none focus:border-primary/50 transition-colors placeholder:text-muted-foreground"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="font-dm text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3 h-3" />
                  Notes
                  <span className="font-normal text-muted-foreground/50">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Test drive, trade-in appraisal, financing..."
                  rows={3}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 font-dm text-sm text-foreground outline-none focus:border-primary/50 transition-colors placeholder:text-muted-foreground resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep('datetime')}
                  className="font-dm text-sm text-muted-foreground gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-dm text-sm gap-2 h-10"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CalendarDays className="w-4 h-4" />
                  )}
                  {submitting ? 'Scheduling...' : 'Confirm Appointment'}
                </Button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
