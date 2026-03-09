import { useState, useEffect } from 'react';
import {
  Clock,
  MessageSquare,
  MapPin,
  RefreshCw,
  Save,
  Loader2,
  Zap,
  Facebook,
  ChevronLeft,
  Car,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { getBackendUrl } from '@/lib/backend-url';
import { cn } from '@/lib/utils';
import type { ActiveView } from './types';

interface DealerLogicSettingsProps {
  onNavigate: (view: ActiveView) => void;
}

interface Config {
  enabled: boolean;
  postingEnabled: boolean;
  replyEnabled: boolean;
  postsPerDay: number;
  postingStartHour: number;
  postingEndHour: number;
  replyTone: string;
  replyHoursOnly: boolean;
  geoZipCodes: string | null;
  inventorySyncMins: number;
  dealerWebsite: string | null;
}

export function DealerLogicSettings({ onNavigate }: DealerLogicSettingsProps) {
  const [config, setConfig] = useState<Config>({
    enabled: false,
    postingEnabled: true,
    replyEnabled: true,
    postsPerDay: 10,
    postingStartHour: 8,
    postingEndHour: 20,
    replyTone: 'friendly',
    replyHoursOnly: false,
    geoZipCodes: null,
    inventorySyncMins: 240,
    dealerWebsite: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${getBackendUrl()}/api/automation/config`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        if (j.data) setConfig(j.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${getBackendUrl()}/api/automation/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(config),
      });
      const j = await r.json();
      if (j.data) {
        setConfig(j.data);
        toast.success('Settings saved');
      }
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <button
          onClick={() => onNavigate('dashboard')}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground font-dm"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="font-bebas text-3xl tracking-wider text-foreground">Dealer Logic</h1>
          <p className="font-dm text-xs text-muted-foreground mt-0.5">
            Configure how your automation runs
          </p>
        </div>
      </div>

      {/* Master toggle */}
      <div className={cn(
        'flex items-center justify-between p-5 rounded-xl border',
        config.enabled ? 'bg-green-500/5 border-green-500/20' : 'bg-card border-border'
      )}>
        <div className="flex items-center gap-3">
          <Zap className={cn('w-5 h-5', config.enabled ? 'text-green-500' : 'text-muted-foreground')} />
          <div>
            <p className="font-dm text-sm font-medium">{config.enabled ? 'Automation Active' : 'Automation Paused'}</p>
            <p className="font-dm text-xs text-muted-foreground">Master switch for all automation</p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => setConfig((p) => ({ ...p, enabled: e.target.checked }))}
            className="sr-only"
          />
          <div className={cn(
            'w-11 h-6 rounded-full transition-colors',
            config.enabled ? 'bg-green-500' : 'bg-muted'
          )}>
            <div className={cn(
              'w-5 h-5 rounded-full bg-white shadow transition-transform mt-0.5',
              config.enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
            )} />
          </div>
        </label>
      </div>

      {/* Posting settings */}
      <section className="bg-card border border-border rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <Car className="w-5 h-5 text-[#1877F2]" />
          <h2 className="font-bebas text-xl tracking-wider">Marketplace Posting</h2>
          <label className="ml-auto relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.postingEnabled}
              onChange={(e) => setConfig((p) => ({ ...p, postingEnabled: e.target.checked }))}
              className="sr-only"
            />
            <div className={cn('w-9 h-5 rounded-full transition-colors', config.postingEnabled ? 'bg-primary' : 'bg-muted')}>
              <div className={cn('w-4 h-4 rounded-full bg-white shadow transition-transform mt-0.5', config.postingEnabled ? 'translate-x-[18px]' : 'translate-x-0.5')} />
            </div>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="font-dm text-xs text-muted-foreground mb-1.5 block">
              <Clock className="w-3 h-3 inline mr-1" />Posting hours
            </label>
            <div className="flex items-center gap-2">
              <select
                value={config.postingStartHour}
                onChange={(e) => setConfig((p) => ({ ...p, postingStartHour: Number(e.target.value) }))}
                className="flex-1 h-9 rounded-md border border-border bg-background px-2 font-dm text-sm"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}
                  </option>
                ))}
              </select>
              <span className="text-xs text-muted-foreground">to</span>
              <select
                value={config.postingEndHour}
                onChange={(e) => setConfig((p) => ({ ...p, postingEndHour: Number(e.target.value) }))}
                className="flex-1 h-9 rounded-md border border-border bg-background px-2 font-dm text-sm"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="font-dm text-xs text-muted-foreground mb-1.5 block">Posts per day</label>
            <select
              value={config.postsPerDay}
              onChange={(e) => setConfig((p) => ({ ...p, postsPerDay: Number(e.target.value) }))}
              className="w-full h-9 rounded-md border border-border bg-background px-2 font-dm text-sm"
            >
              {[5, 10, 15, 20, 25, 30].map((n) => (
                <option key={n} value={n}>{n} vehicles/day</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="font-dm text-xs text-muted-foreground mb-1.5 block">
            <MapPin className="w-3 h-3 inline mr-1" />Geo-targeting (zip codes, comma-separated)
          </label>
          <Input
            placeholder="e.g. 33178, 33126, 33172"
            value={config.geoZipCodes || ''}
            onChange={(e) => setConfig((p) => ({ ...p, geoZipCodes: e.target.value || null }))}
            className="font-dm text-sm bg-background"
          />
          <p className="font-dm text-[10px] text-muted-foreground mt-1">
            Leave empty to use your dealer's default location.
          </p>
        </div>
      </section>

      {/* Reply settings */}
      <section className="bg-card border border-border rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-5 h-5 text-green-500" />
          <h2 className="font-bebas text-xl tracking-wider">Messenger Auto-Reply</h2>
          <label className="ml-auto relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.replyEnabled}
              onChange={(e) => setConfig((p) => ({ ...p, replyEnabled: e.target.checked }))}
              className="sr-only"
            />
            <div className={cn('w-9 h-5 rounded-full transition-colors', config.replyEnabled ? 'bg-green-500' : 'bg-muted')}>
              <div className={cn('w-4 h-4 rounded-full bg-white shadow transition-transform mt-0.5', config.replyEnabled ? 'translate-x-[18px]' : 'translate-x-0.5')} />
            </div>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="font-dm text-xs text-muted-foreground mb-1.5 block">Reply tone</label>
            <select
              value={config.replyTone}
              onChange={(e) => setConfig((p) => ({ ...p, replyTone: e.target.value }))}
              className="w-full h-9 rounded-md border border-border bg-background px-2 font-dm text-sm"
            >
              <option value="friendly">Friendly — warm and approachable</option>
              <option value="professional">Professional — polished and business-like</option>
              <option value="casual">Casual — relaxed and conversational</option>
            </select>
          </div>
          <div className="flex flex-col justify-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.replyHoursOnly}
                onChange={(e) => setConfig((p) => ({ ...p, replyHoursOnly: e.target.checked }))}
                className="rounded border-border"
              />
              <span className="font-dm text-sm">Only reply during business hours</span>
            </label>
          </div>
        </div>
      </section>

      {/* Inventory sync */}
      <section className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-5 h-5 text-primary" />
          <h2 className="font-bebas text-xl tracking-wider">Inventory Sync</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="font-dm text-xs text-muted-foreground mb-1.5 block">Sync frequency</label>
            <select
              value={config.inventorySyncMins}
              onChange={(e) => setConfig((p) => ({ ...p, inventorySyncMins: Number(e.target.value) }))}
              className="w-full h-9 rounded-md border border-border bg-background px-2 font-dm text-sm"
            >
              <option value={60}>Every hour</option>
              <option value={120}>Every 2 hours</option>
              <option value={240}>Every 4 hours</option>
              <option value={480}>Every 8 hours</option>
              <option value={1440}>Once a day</option>
            </select>
          </div>
          <div>
            <label className="font-dm text-xs text-muted-foreground mb-1.5 block">Dealer website</label>
            <Input
              value={config.dealerWebsite || ''}
              onChange={(e) => setConfig((p) => ({ ...p, dealerWebsite: e.target.value || null }))}
              placeholder="e.g. doralacura.com"
              className="font-dm text-sm bg-background"
            />
          </div>
        </div>
      </section>

      {/* Facebook connection */}
      <section className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Facebook className="w-5 h-5 text-[#1877F2]" />
          <h2 className="font-bebas text-xl tracking-wider">Facebook Session</h2>
        </div>
        <p className="font-dm text-xs text-muted-foreground">
          Transfer your Facebook cookies from the Chrome extension for server-side automation.
          Make sure you're logged into Facebook in Chrome and the extension is paired.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="font-dm gap-2"
          onClick={async () => {
            if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
              chrome.runtime.sendMessage(
                { type: 'TRANSFER_FB_COOKIES' },
                (response: { success?: boolean; error?: string }) => {
                  if (response?.success) toast.success('Facebook session updated!');
                  else toast.error(response?.error || 'Transfer failed');
                }
              );
            } else {
              toast.error('Chrome extension not detected');
            }
          }}
        >
          <Facebook className="w-4 h-4" /> Refresh Facebook Session
        </Button>
      </section>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="font-dm font-bold gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
