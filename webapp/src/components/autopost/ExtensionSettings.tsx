import { useState, useEffect } from 'react';
import { Download, Puzzle, Copy, Check, RefreshCw, Chrome, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

interface PairingCode {
  code: string;
  expiresAt: string;
}

export function ExtensionSettings() {
  const [pairingCode, setPairingCode] = useState<PairingCode | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  // Countdown timer
  useEffect(() => {
    if (!pairingCode) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(pairingCode.expiresAt).getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        setPairingCode(null);
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [pairingCode]);

  async function generateCode() {
    setIsGenerating(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/extension/pairing-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setPairingCode(json.data);
      setTimeLeft(600);
      toast.success('Pairing code generated! Enter it in the extension popup.');
    } catch (e) {
      console.error('[generateCode]', e);
      toast.error('Failed to generate pairing code.');
    } finally {
      setIsGenerating(false);
    }
  }

  function copyCode() {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const steps = [
    {
      n: 1,
      title: 'Click "Post to FB" on any vehicle in your inventory',
      sub: 'Web app creates a posting session and sends draft data to the extension',
    },
    {
      n: 2,
      title: 'Extension opens FB Marketplace listing form',
      sub: 'A new tab opens at facebook.com/marketplace/create/vehicle',
    },
    {
      n: 3,
      title: 'Auto-fill all fields with one click',
      sub: 'Extension fills title, price, description, category, location, and attaches photos',
    },
    {
      n: 4,
      title: 'Review and click Publish yourself',
      sub: 'You always have final control — the extension never auto-publishes',
    },
    {
      n: 5,
      title: 'Success detected → marked as posted',
      sub: 'Extension detects the confirmation screen and updates your dashboard',
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center">
              <Puzzle className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bebas text-xl tracking-wider text-foreground">CHROME EXTENSION</h2>
              <p className="font-dm text-xs text-muted-foreground">
                The DealerPost Pro extension auto-fills Facebook Marketplace listing forms from your browser. It runs locally and never stores your Facebook password.
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Step 1: Install */}
          <div className="bg-secondary rounded-lg p-4 space-y-3">
            <p className="font-bebas text-base tracking-wider text-foreground">STEP 1: INSTALL EXTENSION</p>
            <p className="font-dm text-xs text-muted-foreground">
              Download and load the extension in Chrome's developer mode. No Chrome Web Store needed.
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href="/chrome-extension.zip"
                download="dealerpost-pro-extension.zip"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-dm font-semibold hover:bg-primary/90 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Extension (.zip)
              </a>
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card text-xs font-dm text-muted-foreground">
                <Chrome className="w-3.5 h-3.5" />
                Then: chrome://extensions → Developer mode → Load unpacked
              </div>
            </div>
          </div>

          {/* Step 2: Pair */}
          <div className="bg-secondary rounded-lg p-4 space-y-4">
            <p className="font-bebas text-base tracking-wider text-foreground">STEP 2: PAIR EXTENSION</p>

            {/* Step 2.1: Copy Backend URL */}
            <div className="space-y-1.5">
              <p className="font-dm text-xs font-semibold text-foreground">Copy Your Backend URL</p>
              <p className="font-dm text-xs text-muted-foreground">
                Enter this URL in the extension popup so it knows where to connect.
              </p>
              <div className="flex items-center gap-2 bg-background border border-border rounded-lg p-2.5">
                <code className="font-mono text-xs text-primary flex-1 break-all select-all">
                  {BACKEND_URL || window.location.origin.replace(':8000', ':3000')}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const url = BACKEND_URL || window.location.origin.replace(':8000', ':3000');
                    navigator.clipboard.writeText(url);
                    toast.success('Backend URL copied!');
                  }}
                  className="shrink-0 font-dm text-xs gap-1 h-7 px-2"
                >
                  <Copy className="w-3 h-3" />
                  Copy
                </Button>
              </div>
            </div>

            {/* Step 2.2: Generate Pairing Code */}
            <div className="space-y-2">
              <p className="font-dm text-xs font-semibold text-foreground">Generate Pairing Code</p>
              <p className="font-dm text-xs text-muted-foreground">
                Generate a one-time code, then enter it in the extension popup to link your account.
              </p>
              {pairingCode ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-background border border-border rounded-lg px-6 py-4 text-center">
                      <div className="font-bebas text-5xl tracking-[0.4em] text-primary leading-none">
                        {pairingCode.code}
                      </div>
                      <div className="font-dm text-xs text-muted-foreground mt-2">
                        Expires in{' '}
                        <span className={timeLeft < 60 ? 'text-destructive' : 'text-foreground'}>
                          {formatTime(timeLeft)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={copyCode}
                        className="font-dm text-xs border-border gap-1.5"
                      >
                        {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        {copied ? 'Copied!' : 'Copy'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={generateCode}
                        disabled={isGenerating}
                        className="font-dm text-xs gap-1.5"
                      >
                        <RefreshCw className="w-3 h-3" />
                        New Code
                      </Button>
                    </div>
                  </div>
                  <p className="font-dm text-xs text-muted-foreground">
                    Open the DealerPost Pro extension popup in Chrome, enter your server URL, then type this code and click{' '}
                    <strong className="text-foreground">Pair Extension</strong>.
                  </p>
                </div>
              ) : (
                <Button
                  onClick={generateCode}
                  disabled={isGenerating}
                  className="bg-primary text-primary-foreground font-dm font-semibold text-sm gap-2 hover:bg-primary/90"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>Generate Pairing Code</>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-bebas text-xl tracking-wider text-foreground">HOW THE POSTING FLOW WORKS</h2>
        </div>
        <div className="p-5 space-y-4">
          {steps.map((step, i) => (
            <div key={step.n} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center shrink-0">
                  <span className="font-bebas text-sm text-primary">{step.n}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className="w-px flex-1 bg-border mt-2" />
                )}
              </div>
              <div className="pb-4">
                <p className="font-dm text-sm font-semibold text-foreground leading-snug">{step.title}</p>
                <p className="font-dm text-xs text-muted-foreground mt-0.5">{step.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
