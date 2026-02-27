import { useState, useEffect } from 'react';
import {
  Copy,
  Check,
  Facebook,
  Zap,
  Star,
  Tag,
  Calendar,
  ChevronDown,
  Send,
  Users,
  MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Vehicle, PostTemplate, PriceDisplay, PostHistoryItem, MarketplacePlatform } from './types';
import { generatePostText, sampleFacebookGroups } from './types';
import { toast } from 'sonner';

interface PostComposerProps {
  vehicles: Vehicle[];
  selectedVehicleId?: number | null;
  onPosted: (item: PostHistoryItem) => void;
}

const HASHTAG_OPTIONS = [
  'CarSales',
  'UsedCars',
  'AutoDealer',
  'DealAlert',
  'CarForSale',
  'DrivesGreat',
  'CleanTitle',
  'PriceReduced',
];

const templates: {
  id: PostTemplate;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'premium', label: 'PREMIUM LISTING', description: 'Full detailed specs — ideal for quality vehicles', icon: Star },
  { id: 'quicksale', label: 'QUICK SALE', description: 'Urgency-focused — move inventory fast', icon: Zap },
  { id: 'feature', label: 'FEATURE HIGHLIGHT', description: 'Lead with the best feature of this vehicle', icon: Tag },
];

const platformOptions: {
  id: MarketplacePlatform;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  connected: boolean;
}[] = [
  { id: 'facebook_marketplace', label: 'Facebook Marketplace', description: 'Post to FB Marketplace', icon: Facebook, color: '#1877F2', connected: true },
  { id: 'facebook_groups', label: 'Facebook Groups', description: 'Post to selected groups', icon: Users, color: '#3B82F6', connected: true },
  { id: 'craigslist', label: 'Craigslist', description: 'Post to your local CL', icon: MapPin, color: '#9333EA', connected: true },
];

export function PostComposer({ vehicles, selectedVehicleId, onPosted }: PostComposerProps) {
  const [vehicleId, setVehicleId] = useState<string>(
    selectedVehicleId ? String(selectedVehicleId) : ''
  );
  const [template, setTemplate] = useState<PostTemplate>('premium');
  const [priceDisplay, setPriceDisplay] = useState<PriceDisplay>('show');
  const [hashtags, setHashtags] = useState<string[]>(['CarSales', 'UsedCars', 'AutoDealer']);
  const [customMessage, setCustomMessage] = useState('');
  const [schedule, setSchedule] = useState(false);
  const [scheduledFor, setScheduledFor] = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [copied, setCopied] = useState(false);
  const [posted, setPosted] = useState(false);

  // Platform selection state
  const [selectedPlatforms, setSelectedPlatforms] = useState<MarketplacePlatform[]>(['facebook_marketplace']);
  const [selectedGroups, setSelectedGroups] = useState<string[]>(
    sampleFacebookGroups.filter(g => g.selected).map(g => g.id)
  );

  const selectedVehicle = vehicles.find((v) => String(v.id) === vehicleId) ?? null;

  // Auto-generate when a vehicle is selected or template changes
  useEffect(() => {
    if (selectedVehicleId) {
      setVehicleId(String(selectedVehicleId));
    }
  }, [selectedVehicleId]);

  useEffect(() => {
    if (selectedVehicle) {
      setGeneratedText(
        generatePostText(selectedVehicle, template, priceDisplay, hashtags, customMessage)
      );
    }
  }, [selectedVehicle, template, priceDisplay, hashtags, customMessage]);

  const handleGenerate = () => {
    if (!selectedVehicle) return;
    setGeneratedText(
      generatePostText(selectedVehicle, template, priceDisplay, hashtags, customMessage)
    );
    setPosted(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePost = () => {
    if (!selectedVehicle || !generatedText) return;
    if (selectedPlatforms.length === 0) {
      toast.error('Please select at least one platform to post to');
      return;
    }
    const item: PostHistoryItem = {
      id: Date.now(),
      vehicleId: selectedVehicle.id,
      vehicleName: `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model} ${selectedVehicle.trim}`,
      postedAt: new Date().toISOString(),
      template,
      status: schedule ? 'Scheduled' : 'Posted',
      postText: generatedText,
      scheduledFor: schedule ? scheduledFor : undefined,
      platforms: selectedPlatforms,
    };
    onPosted(item);
    setPosted(true);

    // Send to extension if Facebook Marketplace is selected
    if (selectedPlatforms.includes('facebook_marketplace') && selectedVehicle && generatedText) {
      fetch('/api/extension/posting-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId: selectedVehicle.id,
          postText: generatedText,
          vehicleData: selectedVehicle,
        }),
      }).then(() => {
        toast.success('Sent to Chrome Extension — click the extension to auto-fill FB Marketplace!');
      }).catch(() => {
        // Silently fail — extension feature is optional
      });
    }

    const platformNames = selectedPlatforms.map(p =>
      platformOptions.find(opt => opt.id === p)?.label || p
    ).join(', ');
    toast.success(`Posted to ${platformNames}!`);

    setTimeout(() => setPosted(false), 3000);
  };

  const toggleHashtag = (tag: string) => {
    setHashtags((prev) =>
      prev.includes(tag) ? prev.filter((h) => h !== tag) : [...prev, tag]
    );
  };

  const togglePlatform = (platform: MarketplacePlatform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  };

  const toggleGroup = (groupId: string) => {
    setSelectedGroups((prev) =>
      prev.includes(groupId) ? prev.filter((g) => g !== groupId) : [...prev, groupId]
    );
  };

  return (
    <div className="animate-slide-up">
      <div className="mb-6">
        <h1 className="font-bebas text-3xl tracking-wider text-foreground">POST COMPOSER</h1>
        <p className="font-dm text-sm text-muted-foreground mt-0.5">
          Generate and publish your listing across multiple platforms
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Form */}
        <div className="flex flex-col gap-5">
          {/* Vehicle selector */}
          <div className="flex flex-col gap-2">
            <Label className="font-bebas text-base tracking-wider text-foreground">
              SELECT VEHICLE
            </Label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger className="bg-input border-border text-foreground font-dm">
                <SelectValue placeholder="Choose a vehicle from inventory..." />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {vehicles
                  .filter((v) => v.status !== 'Sold')
                  .map((v) => (
                    <SelectItem key={v.id} value={String(v.id)} className="text-foreground font-dm">
                      {v.year} {v.make} {v.model} {v.trim} — ${v.price.toLocaleString()}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Platform selector */}
          <div className="flex flex-col gap-2">
            <Label className="font-bebas text-base tracking-wider text-foreground">
              POST TO PLATFORMS
            </Label>
            <div className="grid grid-cols-1 gap-2">
              {platformOptions.map(({ id, label, description, icon: Icon, color }) => (
                <button
                  key={id}
                  onClick={() => togglePlatform(id)}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded border text-left transition-all duration-200',
                    selectedPlatforms.includes(id)
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-secondary hover:border-primary/50'
                  )}
                >
                  <div
                    className="w-8 h-8 rounded flex items-center justify-center shrink-0"
                    style={{ backgroundColor: selectedPlatforms.includes(id) ? color : undefined }}
                  >
                    <Icon
                      className={cn(
                        'w-4 h-4',
                        selectedPlatforms.includes(id) ? 'text-white' : 'text-muted-foreground'
                      )}
                    />
                  </div>
                  <div className="flex-1">
                    <div
                      className={cn(
                        'font-dm text-sm font-medium',
                        selectedPlatforms.includes(id) ? 'text-foreground' : 'text-foreground'
                      )}
                    >
                      {label}
                    </div>
                    <div className="font-dm text-xs text-muted-foreground">{description}</div>
                  </div>
                  <Checkbox
                    checked={selectedPlatforms.includes(id)}
                    onCheckedChange={() => togglePlatform(id)}
                    className="shrink-0"
                  />
                </button>
              ))}
            </div>

            {/* Facebook Groups sub-selection */}
            {selectedPlatforms.includes('facebook_groups') && (
              <div className="ml-11 mt-2 p-3 bg-secondary/50 rounded border border-border">
                <p className="font-dm text-xs text-muted-foreground mb-2">Select groups to post to:</p>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {sampleFacebookGroups.map((group) => (
                    <label
                      key={group.id}
                      className="flex items-center gap-2 p-1.5 rounded hover:bg-background/50 cursor-pointer text-sm"
                    >
                      <Checkbox
                        checked={selectedGroups.includes(group.id)}
                        onCheckedChange={() => toggleGroup(group.id)}
                      />
                      <span className="font-dm text-xs text-foreground truncate">{group.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Template selector */}
          <div className="flex flex-col gap-2">
            <Label className="font-bebas text-base tracking-wider text-foreground">
              POST TEMPLATE
            </Label>
            <div className="grid grid-cols-1 gap-2">
              {templates.map(({ id, label, description, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTemplate(id)}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded border text-left transition-all duration-200',
                    template === id
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-secondary hover:border-primary/50'
                  )}
                >
                  <div
                    className={cn(
                      'w-8 h-8 rounded flex items-center justify-center shrink-0',
                      template === id ? 'bg-primary' : 'bg-muted'
                    )}
                  >
                    <Icon
                      className={cn(
                        'w-4 h-4',
                        template === id ? 'text-primary-foreground' : 'text-muted-foreground'
                      )}
                    />
                  </div>
                  <div>
                    <div
                      className={cn(
                        'font-bebas tracking-wider text-sm',
                        template === id ? 'text-primary' : 'text-foreground'
                      )}
                    >
                      {label}
                    </div>
                    <div className="font-dm text-xs text-muted-foreground">{description}</div>
                  </div>
                  {template === id && (
                    <div className="ml-auto w-2 h-2 rounded-full bg-primary shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Hashtags */}
          <div className="flex flex-col gap-2">
            <Label className="font-bebas text-base tracking-wider text-foreground">
              HASHTAGS
            </Label>
            <div className="flex flex-wrap gap-2">
              {HASHTAG_OPTIONS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleHashtag(tag)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-dm font-medium border transition-all duration-150',
                    hashtags.includes(tag)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-secondary text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                  )}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>

          {/* Price display */}
          <div className="flex flex-col gap-2">
            <Label className="font-bebas text-base tracking-wider text-foreground">
              PRICE DISPLAY
            </Label>
            <div className="flex gap-2">
              {(['show', 'call', 'offer'] as PriceDisplay[]).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setPriceDisplay(opt)}
                  className={cn(
                    'flex-1 py-2 rounded text-xs font-dm font-medium border transition-all duration-150',
                    priceDisplay === opt
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-secondary text-muted-foreground border-border hover:border-primary/50'
                  )}
                >
                  {opt === 'show' ? 'Show Price' : opt === 'call' ? 'Call for Price' : 'Make Offer'}
                </button>
              ))}
            </div>
          </div>

          {/* Custom override */}
          <div className="flex flex-col gap-2">
            <Label className="font-bebas text-base tracking-wider text-foreground">
              CUSTOM MESSAGE OVERRIDE
            </Label>
            <Textarea
              placeholder="Optional: Write your own post text instead of using the template..."
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="bg-input border-border text-foreground font-dm text-sm min-h-[80px]"
            />
          </div>

          {/* Schedule toggle */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <Label className="font-bebas text-base tracking-wider text-foreground">
                SCHEDULE POST
              </Label>
              <Switch
                checked={schedule}
                onCheckedChange={setSchedule}
                className="ml-auto"
              />
            </div>
            {schedule && (
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="bg-input border border-border text-foreground rounded px-3 py-2 text-sm font-dm w-full"
              />
            )}
          </div>

          {/* Generate button */}
          <Button
            onClick={handleGenerate}
            disabled={!selectedVehicle}
            size="lg"
            className="bg-primary text-primary-foreground font-bebas text-xl tracking-widest hover:bg-primary/90 disabled:opacity-40 gap-2"
          >
            <Send className="w-5 h-5" />
            GENERATE POST
          </Button>
        </div>

        {/* Right: Preview */}
        <div className="flex flex-col gap-4">
          <Label className="font-bebas text-base tracking-wider text-foreground">
            POST PREVIEW
          </Label>

          {/* Platform badges */}
          {selectedPlatforms.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedPlatforms.map((platform) => {
                const opt = platformOptions.find(p => p.id === platform);
                if (!opt) return null;
                const Icon = opt.icon;
                return (
                  <div
                    key={platform}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-dm text-white"
                    style={{ backgroundColor: opt.color }}
                  >
                    <Icon className="w-3 h-3" />
                    {opt.label}
                  </div>
                );
              })}
            </div>
          )}

          {/* Preview card mockup */}
          <div className="rounded-lg overflow-hidden border border-border shadow-lg">
            {/* Header - shows primary platform */}
            <div className="px-4 py-3 flex items-center gap-3" style={{ backgroundColor: platformOptions.find(p => p.id === selectedPlatforms[0])?.color || '#1877F2' }}>
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                {(() => {
                  const Icon = platformOptions.find(p => p.id === selectedPlatforms[0])?.icon || Facebook;
                  return <Icon className="w-4 h-4 text-white" />;
                })()}
              </div>
              <div>
                <div className="text-white font-medium text-sm font-dm">
                  {platformOptions.find(p => p.id === selectedPlatforms[0])?.label || 'Select Platform'}
                </div>
                <div className="text-white/70 text-xs font-dm">
                  {selectedVehicle
                    ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`
                    : 'Vehicle Listing'}
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-white/70 ml-auto" />
            </div>

            {/* Listing image placeholder */}
            {selectedVehicle && (
              <div className="bg-secondary border-b border-border px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-10 rounded bg-muted flex items-center justify-center text-xl">
                    🚗
                  </div>
                  <div>
                    <div className="font-medium text-sm text-foreground font-dm">
                      {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
                    </div>
                    <div className="text-xs text-muted-foreground font-dm">
                      {selectedVehicle.mileage.toLocaleString()} miles •{' '}
                      {selectedVehicle.color}
                    </div>
                  </div>
                </div>
                <div className="font-bebas text-xl text-primary tracking-wide">
                  ${selectedVehicle.price.toLocaleString()}
                </div>
              </div>
            )}

            {/* Post text area */}
            <div className="bg-white p-4 min-h-48">
              {generatedText ? (
                <pre className="font-dm text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {generatedText}
                </pre>
              ) : (
                <div className="flex flex-col items-center justify-center h-32 text-gray-400 gap-2">
                  <span className="text-3xl">📝</span>
                  <span className="text-sm font-dm">Select a vehicle and click Generate</span>
                </div>
              )}
            </div>

            {/* FB action bar */}
            <div className="bg-gray-50 border-t border-gray-200 px-4 py-2 flex gap-4">
              <button className="text-gray-500 text-xs font-medium font-dm hover:text-blue-600 transition-colors">
                👍 Like
              </button>
              <button className="text-gray-500 text-xs font-medium font-dm hover:text-blue-600 transition-colors">
                💬 Comment
              </button>
              <button className="text-gray-500 text-xs font-medium font-dm hover:text-blue-600 transition-colors">
                ↗️ Share
              </button>
            </div>
          </div>

          {/* Character count */}
          {generatedText && (
            <div className="flex items-center justify-between px-1">
              <span className="font-dm text-xs text-muted-foreground">
                {generatedText.length} characters
              </span>
              <span
                className={cn(
                  'font-dm text-xs',
                  generatedText.length > 3000 ? 'text-destructive' : 'text-muted-foreground'
                )}
              >
                {generatedText.length > 3000 ? 'May be truncated on Facebook' : 'Good length'}
              </span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleCopy}
              disabled={!generatedText}
              className="flex-1 border-border font-dm gap-2 disabled:opacity-40"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-green-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy Post Text
                </>
              )}
            </Button>
            <Button
              onClick={handlePost}
              disabled={!generatedText || !selectedVehicle || selectedPlatforms.length === 0}
              className={cn(
                'flex-1 font-dm gap-2 font-semibold transition-all duration-300',
                posted
                  ? 'bg-green-600 hover:bg-green-500 text-white'
                  : 'bg-primary hover:bg-primary/90 text-primary-foreground'
              )}
            >
              {posted ? (
                <>
                  <Check className="w-4 h-4" />
                  Posted!
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  POST TO {selectedPlatforms.length} PLATFORM{selectedPlatforms.length !== 1 ? 'S' : ''}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
