import { useState } from 'react';
import {
  Globe,
  Facebook,
  Zap,
  Check,
  Loader2,
  ArrowRight,
  ChevronLeft,
  Settings2,
  Clock,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { getBackendUrl } from '@/lib/backend-url';
import { cn } from '@/lib/utils';
import type { ActiveView } from './types';

interface OnboardingFlowProps {
  onNavigate: (view: ActiveView) => void;
}

type Step = 1 | 2 | 3;

export function OnboardingFlow({ onNavigate }: OnboardingFlowProps) {
  const [step, setStep] = useState<Step>(1);
  const [website, setWebsite] = useState('');
  const [loading, setLoading] = useState(false);
  const [dealerInfo, setDealerInfo] = useState<{
    name: string;
    inventory_count: number;
    city: string;
    state: string;
  } | null>(null);
  const [fbConnected, setFbConnected] = useState(false);
  const [automationConfig, setAutomationConfig] = useState({
    postsPerDay: 10,
    postingStartHour: 8,
    postingEndHour: 20,
    replyTone: 'friendly' as 'friendly' | 'professional' | 'casual',
    replyEnabled: true,
    postingEnabled: true,
  });
  const [goingLive, setGoingLive] = useState(false);

  // Step 1: Connect website
  const handleConnectWebsite = async () => {
    if (!website.trim()) return;
    setLoading(true);
    try {
      const clean = website.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
      const r = await fetch(`${getBackendUrl()}/api/marketcheck/lookup?source=${encodeURIComponent(clean)}`, {
        credentials: 'include',
      });
      const j = await r.json();
      if (j.data) {
        setDealerInfo(j.data);
        // Save dealer website in automation config
        await fetch(`${getBackendUrl()}/api/automation/config`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ dealerWebsite: clean }),
        });
        toast.success(`Found ${j.data.name} with ${j.data.inventory_count} vehicles!`);
        setStep(2);
      } else {
        toast.error(j.error?.message || 'Could not find dealership. Check the URL.');
      }
    } catch {
      toast.error('Failed to connect. Check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Connect Facebook (via extension cookie transfer)
  const handleTransferCookies = async () => {
    setLoading(true);
    try {
      // This works when the extension is installed - sends message to capture FB cookies
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage(
          { type: 'TRANSFER_FB_COOKIES' },
          (response: { success?: boolean; error?: string; cookieCount?: number }) => {
            if (response?.success) {
              setFbConnected(true);
              toast.success(`Facebook connected! (${response.cookieCount} cookies transferred)`);
            } else {
              toast.error(response?.error || 'Could not transfer cookies. Is the extension paired?');
            }
            setLoading(false);
          }
        );
      } else {
        toast.error('Chrome extension not detected. Install and pair the extension first.');
        setLoading(false);
      }
    } catch {
      toast.error('Extension communication failed.');
      setLoading(false);
    }
  };

  // Step 3: Go live
  const handleGoLive = async () => {
    setGoingLive(true);
    try {
      await fetch(`${getBackendUrl()}/api/automation/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...automationConfig,
          enabled: true,
        }),
      });
      toast.success('Automation is now live! Your inventory will start posting automatically.');
      onNavigate('dashboard');
    } catch {
      toast.error('Failed to activate automation.');
    } finally {
      setGoingLive(false);
    }
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div className="text-center">
        <h1 className="font-bebas text-4xl tracking-wider text-foreground">Get Started</h1>
        <p className="font-dm text-sm text-muted-foreground mt-1">
          Three steps to fully automated Facebook Marketplace sales
        </p>
      </div>

      {/* Progress steps */}
      <div className="flex items-center justify-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center text-sm font-dm font-bold transition-colors',
                step > s ? 'bg-green-500 text-white' :
                step === s ? 'bg-primary text-primary-foreground' :
                'bg-muted text-muted-foreground'
              )}
            >
              {step > s ? <Check className="w-4 h-4" /> : s}
            </div>
            {s < 3 && (
              <div className={cn('w-16 h-0.5', step > s ? 'bg-green-500' : 'bg-border')} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Connect Website */}
      {step === 1 && (
        <div className="bg-card border border-border rounded-xl p-8 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-[#1877F2]/10 flex items-center justify-center shrink-0">
              <Globe className="w-7 h-7 text-[#1877F2]" />
            </div>
            <div>
              <h2 className="font-bebas text-2xl tracking-wider">Connect Your Website</h2>
              <p className="font-dm text-sm text-muted-foreground">
                Enter your dealer website URL. We'll pull your inventory automatically.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex gap-3">
              <Input
                placeholder="e.g. doralacura.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConnectWebsite()}
                className="font-dm text-sm bg-background"
              />
              <Button onClick={handleConnectWebsite} disabled={loading || !website.trim()}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect'}
              </Button>
            </div>
            <p className="font-dm text-xs text-muted-foreground">
              We use MarketCheck to automatically sync your used vehicle inventory. Zero manual entry required.
            </p>
          </div>
        </div>
      )}

      {/* Step 2: Connect Facebook + Set Rules */}
      {step === 2 && (
        <div className="space-y-6">
          {step > 1 && (
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground font-dm"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          )}

          <div className="bg-card border border-border rounded-xl p-8 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-[#1877F2]/10 flex items-center justify-center shrink-0">
                <Facebook className="w-7 h-7 text-[#1877F2]" />
              </div>
              <div>
                <h2 className="font-bebas text-2xl tracking-wider">Connect Facebook</h2>
                <p className="font-dm text-sm text-muted-foreground">
                  Transfer your Facebook session so we can post and reply on your behalf 24/7.
                </p>
              </div>
            </div>

            {fbConnected ? (
              <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <Check className="w-5 h-5 text-green-500" />
                <span className="font-dm text-sm text-green-400">Facebook connected</span>
              </div>
            ) : (
              <div className="space-y-3">
                <Button onClick={handleTransferCookies} disabled={loading} className="w-full">
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Facebook className="w-4 h-4 mr-2" />
                  )}
                  Transfer Facebook Session
                </Button>
                <p className="font-dm text-xs text-muted-foreground text-center">
                  Requires the Chrome extension to be installed and paired. Log into Facebook in Chrome first.
                </p>
              </div>
            )}
          </div>

          {/* Dealer Logic */}
          <div className="bg-card border border-border rounded-xl p-8 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Settings2 className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h2 className="font-bebas text-2xl tracking-wider">Set Your Rules</h2>
                <p className="font-dm text-sm text-muted-foreground">
                  Configure when and how we post and reply.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-dm text-xs text-muted-foreground mb-1.5 block">
                  <Clock className="w-3 h-3 inline mr-1" />Posting hours
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={automationConfig.postingStartHour}
                    onChange={(e) => setAutomationConfig(p => ({ ...p, postingStartHour: Number(e.target.value) }))}
                    className="flex-1 h-9 rounded-md border border-border bg-background px-2 font-dm text-sm"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}</option>
                    ))}
                  </select>
                  <span className="text-muted-foreground text-xs">to</span>
                  <select
                    value={automationConfig.postingEndHour}
                    onChange={(e) => setAutomationConfig(p => ({ ...p, postingEndHour: Number(e.target.value) }))}
                    className="flex-1 h-9 rounded-md border border-border bg-background px-2 font-dm text-sm"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="font-dm text-xs text-muted-foreground mb-1.5 block">Posts per day</label>
                <select
                  value={automationConfig.postsPerDay}
                  onChange={(e) => setAutomationConfig(p => ({ ...p, postsPerDay: Number(e.target.value) }))}
                  className="w-full h-9 rounded-md border border-border bg-background px-2 font-dm text-sm"
                >
                  {[5, 10, 15, 20, 25].map(n => <option key={n} value={n}>{n} vehicles/day</option>)}
                </select>
              </div>
              <div>
                <label className="font-dm text-xs text-muted-foreground mb-1.5 block">
                  <MessageSquare className="w-3 h-3 inline mr-1" />Reply tone
                </label>
                <select
                  value={automationConfig.replyTone}
                  onChange={(e) => setAutomationConfig(p => ({ ...p, replyTone: e.target.value as 'friendly' | 'professional' | 'casual' }))}
                  className="w-full h-9 rounded-md border border-border bg-background px-2 font-dm text-sm"
                >
                  <option value="friendly">Friendly</option>
                  <option value="professional">Professional</option>
                  <option value="casual">Casual</option>
                </select>
              </div>
              <div className="flex flex-col justify-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={automationConfig.replyEnabled}
                    onChange={(e) => setAutomationConfig(p => ({ ...p, replyEnabled: e.target.checked }))}
                    className="rounded border-border"
                  />
                  <span className="font-dm text-sm">Auto-reply to messages</span>
                </label>
              </div>
            </div>
          </div>

          {dealerInfo && (
            <div className="flex items-center justify-between bg-card border border-border rounded-xl p-4">
              <div>
                <p className="font-dm text-sm font-medium">{dealerInfo.name}</p>
                <p className="font-dm text-xs text-muted-foreground">{dealerInfo.inventory_count} vehicles ready</p>
              </div>
              <Button onClick={() => setStep(3)} className="gap-2">
                Continue <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Go Live */}
      {step === 3 && (
        <div className="space-y-6">
          <button
            onClick={() => setStep(2)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground font-dm"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>

          <div className="bg-card border border-primary/30 rounded-xl p-8 space-y-6 bg-primary/5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
                <Zap className="w-7 h-7 text-green-500" />
              </div>
              <div>
                <h2 className="font-bebas text-2xl tracking-wider">Go Live</h2>
                <p className="font-dm text-sm text-muted-foreground">
                  Everything is set. Flip the switch and let automation bring you sales.
                </p>
              </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-background border border-border">
                <Globe className="w-5 h-5 text-[#1877F2] mb-2" />
                <p className="font-dm text-sm font-medium">{dealerInfo?.name}</p>
                <p className="font-dm text-xs text-muted-foreground">{dealerInfo?.inventory_count} vehicles</p>
              </div>
              <div className="p-4 rounded-lg bg-background border border-border">
                <Facebook className="w-5 h-5 text-[#1877F2] mb-2" />
                <p className="font-dm text-sm font-medium">{fbConnected ? 'Connected' : 'Not connected'}</p>
                <p className="font-dm text-xs text-muted-foreground">Facebook session</p>
              </div>
              <div className="p-4 rounded-lg bg-background border border-border">
                <Clock className="w-5 h-5 text-primary mb-2" />
                <p className="font-dm text-sm font-medium">{automationConfig.postsPerDay}/day</p>
                <p className="font-dm text-xs text-muted-foreground">
                  {automationConfig.postingStartHour}:00 – {automationConfig.postingEndHour}:00
                </p>
              </div>
            </div>

            <Button
              onClick={handleGoLive}
              disabled={goingLive}
              size="lg"
              className="w-full bg-green-600 hover:bg-green-700 text-white font-dm font-bold text-base gap-2"
            >
              {goingLive ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Zap className="w-5 h-5" />
              )}
              Activate Automation
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
