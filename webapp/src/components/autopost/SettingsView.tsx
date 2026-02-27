import { useState, useRef, useEffect } from 'react';
import { Facebook, CheckCircle2, AlertCircle, Car, Users, MapPin, ExternalLink, Loader2, RefreshCw, Shield, Puzzle, Bell, Settings2, Building2, CreditCard, Check, Zap, Star, Crown, UserCircle, Camera } from 'lucide-react';
import { ExtensionSettings } from './ExtensionSettings';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDealer } from '../../context/DealerContext';
import { useFacebook } from './FacebookContext';
import { toast } from 'sonner';
import { sampleFacebookGroups, craigslistRegions, type FacebookGroup } from './types';
import { useSupabaseSession } from '@/lib/supabase-auth';
import { supabase } from '@/lib/supabase';

type SettingsTab = 'profile' | 'dealership' | 'integrations' | 'extension' | 'posting' | 'notifications' | 'plan';

const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: 'profile', label: 'Profile', icon: <UserCircle className="w-4 h-4" /> },
  { id: 'dealership', label: 'Dealership', icon: <Building2 className="w-4 h-4" /> },
  { id: 'integrations', label: 'Integrations', icon: <Settings2 className="w-4 h-4" /> },
  { id: 'extension', label: 'Extension', icon: <Puzzle className="w-4 h-4" /> },
  { id: 'posting', label: 'Posting', icon: <Settings2 className="w-4 h-4" /> },
  { id: 'notifications', label: 'Alerts', icon: <Bell className="w-4 h-4" /> },
  { id: 'plan', label: 'Plan', icon: <CreditCard className="w-4 h-4" /> },
];

export function SettingsView() {
  const { dealer, setDealer } = useDealer();
  const { connected: fbConnected, accountName: fbAccountName, pageName: fbPageName, profilePicture: fbProfilePicture, isLoading: fbLoading, connect: connectFacebook, disconnect: disconnectFacebook, refreshToken: refreshFacebookToken } = useFacebook();
  const { data: session } = useSupabaseSession();
  const [draft, setDraft] = useState({ ...dealer });
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  // Profile state
  const [profileName, setProfileName] = useState(session?.user?.user_metadata?.name || session?.user?.user_metadata?.full_name || '');
  const [profileEmail, setProfileEmail] = useState(session?.user?.email || '');
  const [profilePhone, setProfilePhone] = useState(session?.user?.user_metadata?.phone || '');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(session?.user?.user_metadata?.avatar_url || null);
  const [savingProfile, setSavingProfile] = useState(false);
  const profilePhotoRef = useRef<HTMLInputElement>(null);

  // Keep profile in sync when session loads
  useEffect(() => {
    if (session?.user) {
      setProfileName(session.user.user_metadata?.name || session.user.user_metadata?.full_name || '');
      setProfileEmail(session.user.email || '');
      setProfilePhone(session.user.user_metadata?.phone || '');
      setProfilePhoto(session.user.user_metadata?.avatar_url || null);
    }
  }, [session?.user?.id]);

  async function handleSaveProfile() {
    setSavingProfile(true);
    try {
      const { error } = await supabase.auth.updateUser({
        email: profileEmail !== session?.user?.email ? profileEmail : undefined,
        data: {
          name: profileName,
          full_name: profileName,
          phone: profilePhone,
          avatar_url: profilePhoto,
        },
      });
      if (error) throw error;
      toast.success('Profile saved!');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save profile');
    } finally {
      setSavingProfile(false);
    }
  }

  function handleProfilePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === 'string') setProfilePhoto(ev.target.result);
    };
    reader.readAsDataURL(file);
  }

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fbGroupsConnected, setFbGroupsConnected] = useState(false);
  const [facebookGroups, setFacebookGroups] = useState<FacebookGroup[]>(sampleFacebookGroups);
  const [craigslistConnected, setCraigslistConnected] = useState(false);
  const [selectedCraigslistRegion, setSelectedCraigslistRegion] = useState('');
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [leadNotifications, setLeadNotifications] = useState(true);
  const [defaultTemplate, setDefaultTemplate] = useState('premium');
  const [autoHashtags, setAutoHashtags] = useState(true);

  function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === 'string') setDraft((d) => ({ ...d, logoUrl: result }));
    };
    reader.readAsDataURL(file);
  }

  function handleSave() {
    setDealer(draft);
    toast.success('Dealership info saved!');
  }

  function toggleGroupSelection(groupId: string) {
    setFacebookGroups(groups => groups.map(g => g.id === groupId ? { ...g, selected: !g.selected } : g));
  }

  function handleConnectFbGroups() {
    setFbGroupsConnected(true);
    toast.success('Facebook Groups connected!');
  }

  function handleConnectCraigslist() {
    if (!selectedCraigslistRegion) { toast.error('Please select a region first'); return; }
    setCraigslistConnected(true);
    toast.success('Craigslist connected for your region!');
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="font-bebas text-4xl tracking-wider text-foreground leading-none">SETTINGS</h1>
        <p className="font-dm text-sm text-muted-foreground mt-1">Configure your dealership profile and posting preferences.</p>
      </div>

      {/* Horizontal tab bar */}
      <div className="flex items-center gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-dm font-medium transition-all duration-150 border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            <span className={activeTab === tab.id ? 'text-primary' : ''}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div>
          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="space-y-5 max-w-lg">
              {/* Profile Photo */}
              <div className="space-y-2">
                <Label className="font-dm text-xs text-muted-foreground uppercase tracking-wider">Profile Photo</Label>
                <div className="flex items-center gap-4">
                  <div className="relative w-20 h-20 shrink-0">
                    <div className="w-20 h-20 rounded-full border border-border bg-secondary flex items-center justify-center overflow-hidden">
                      {profilePhoto
                        ? <img src={profilePhoto} className="w-full h-full object-cover" alt="Profile" />
                        : <UserCircle className="w-10 h-10 text-muted-foreground" />}
                    </div>
                    <button
                      type="button"
                      onClick={() => profilePhotoRef.current?.click()}
                      className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow border-2 border-background hover:bg-primary/90 transition-colors"
                    >
                      <Camera className="w-3 h-3 text-primary-foreground" />
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    <input ref={profilePhotoRef} type="file" accept="image/*" className="hidden" onChange={handleProfilePhotoChange} />
                    <Button type="button" variant="outline" size="sm" className="font-dm text-xs" onClick={() => profilePhotoRef.current?.click()}>
                      Upload Photo
                    </Button>
                    {profilePhoto && (
                      <Button type="button" variant="ghost" size="sm" className="font-dm text-xs text-destructive hover:text-destructive" onClick={() => setProfilePhoto(null)}>
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="font-dm text-xs text-muted-foreground uppercase tracking-wider">Full Name</Label>
                <Input
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="bg-secondary border-border font-dm text-sm"
                  placeholder="Your full name"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="font-dm text-xs text-muted-foreground uppercase tracking-wider">Email</Label>
                <Input
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  className="bg-secondary border-border font-dm text-sm"
                  placeholder="you@example.com"
                  type="email"
                />
                {profileEmail !== session?.user?.email && (
                  <p className="font-dm text-xs text-yellow-400">Changing your email will require confirmation.</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="font-dm text-xs text-muted-foreground uppercase tracking-wider">Phone Number</Label>
                <Input
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  className="bg-secondary border-border font-dm text-sm"
                  placeholder="(555) 000-0000"
                  type="tel"
                />
              </div>

              <Button
                className="font-dm text-sm bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                onClick={handleSaveProfile}
                disabled={savingProfile}
              >
                {savingProfile ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : 'Save Profile'}
              </Button>
            </div>
          )}

          {/* DEALERSHIP TAB */}
          {activeTab === 'dealership' && (
            <div className="space-y-5 max-w-lg">
              {/* Logo */}
              <div className="space-y-2">
                <Label className="font-dm text-xs text-muted-foreground uppercase tracking-wider">Dealer Logo</Label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-lg border border-border bg-secondary flex items-center justify-center overflow-hidden shrink-0">
                    {draft.logoUrl
                      ? <img src={draft.logoUrl} className="w-full h-full object-cover" alt="Dealer logo" />
                      : <Car className="w-8 h-8 text-muted-foreground" />}
                  </div>
                  <div className="flex flex-col gap-2">
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFileChange} />
                    <Button type="button" variant="outline" size="sm" className="font-dm text-xs" onClick={() => fileInputRef.current?.click()}>
                      Upload Logo
                    </Button>
                    {draft.logoUrl && (
                      <Button type="button" variant="ghost" size="sm" className="font-dm text-xs text-destructive hover:text-destructive" onClick={() => setDraft((d) => ({ ...d, logoUrl: null }))}>
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="font-dm text-xs text-muted-foreground uppercase tracking-wider">Dealership Name</Label>
                <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} className="bg-secondary border-border font-dm text-sm" placeholder="Your dealership name" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-dm text-xs text-muted-foreground uppercase tracking-wider">Address</Label>
                <Input value={draft.address} onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))} className="bg-secondary border-border font-dm text-sm" placeholder="123 Auto Blvd, City, State ZIP" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="font-dm text-xs text-muted-foreground uppercase tracking-wider">Phone</Label>
                  <Input value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} className="bg-secondary border-border font-dm text-sm" placeholder="(555) 000-0000" />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-dm text-xs text-muted-foreground uppercase tracking-wider">Website</Label>
                  <Input value={draft.website} onChange={(e) => setDraft((d) => ({ ...d, website: e.target.value }))} className="bg-secondary border-border font-dm text-sm" placeholder="https://yoursite.com" />
                </div>
              </div>
              <Button className="font-dm text-sm bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleSave}>
                Save Changes
              </Button>
            </div>
          )}

          {/* INTEGRATIONS TAB */}
          {activeTab === 'integrations' && (
            <div className="space-y-4 max-w-lg">
              {/* Facebook Marketplace */}
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#1877F2' }}>
                        <Facebook className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-dm text-sm font-medium text-foreground">Facebook Marketplace</p>
                        {fbConnected ? (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <CheckCircle2 className="w-3 h-3 text-green-500" />
                            <p className="font-dm text-xs text-green-500">Connected as {fbPageName || fbAccountName}</p>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <AlertCircle className="w-3 h-3 text-yellow-400" />
                            <p className="font-dm text-xs text-yellow-400">Not connected</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {fbConnected && (
                        <Button variant="ghost" size="sm" className="font-dm text-xs text-muted-foreground" onClick={() => refreshFacebookToken()} disabled={fbLoading}>
                          <RefreshCw className={`w-3 h-3 mr-1 ${fbLoading ? 'animate-spin' : ''}`} /> Refresh
                        </Button>
                      )}
                      <Button variant={fbConnected ? 'outline' : 'default'} size="sm"
                        className={fbConnected ? 'font-dm text-xs border-border' : 'font-dm text-xs bg-blue-600 hover:bg-blue-700 text-white'}
                        onClick={() => fbConnected ? disconnectFacebook() : connectFacebook()} disabled={fbLoading}>
                        {fbLoading ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Connecting...</> : fbConnected ? 'Disconnect' : 'Connect'}
                      </Button>
                    </div>
                  </div>
                  {fbConnected && (
                    <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-3">
                      {fbProfilePicture && <img src={fbProfilePicture} alt={fbAccountName || 'Profile'} className="w-8 h-8 rounded-full object-cover" />}
                      <div className="flex-1 min-w-0">
                        <p className="font-dm text-xs text-muted-foreground">Connected Account</p>
                        <p className="font-dm text-sm text-foreground truncate">{fbAccountName}</p>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-green-500/10">
                        <Shield className="w-3 h-3 text-green-500" />
                        <span className="font-dm text-[10px] text-green-500 font-medium">Active</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Facebook Groups */}
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
                        <Users className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-dm text-sm font-medium text-foreground">Facebook Groups</p>
                        {fbGroupsConnected ? (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <CheckCircle2 className="w-3 h-3 text-green-500" />
                            <p className="font-dm text-xs text-green-500">{facebookGroups.filter(g => g.selected).length} groups selected</p>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <AlertCircle className="w-3 h-3 text-yellow-400" />
                            <p className="font-dm text-xs text-yellow-400">Not connected</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <Button variant={fbGroupsConnected ? 'outline' : 'default'} size="sm"
                      className={fbGroupsConnected ? 'font-dm text-xs border-border' : 'font-dm text-xs bg-blue-500 hover:bg-blue-600 text-white'}
                      onClick={() => fbGroupsConnected ? setFbGroupsConnected(false) : handleConnectFbGroups()}>
                      {fbGroupsConnected ? 'Disconnect' : 'Connect'}
                    </Button>
                  </div>
                  {fbGroupsConnected && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <p className="font-dm text-xs text-muted-foreground mb-2">Select groups to post to:</p>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {facebookGroups.map((group) => (
                          <label key={group.id} className="flex items-center gap-3 p-2 rounded hover:bg-secondary cursor-pointer transition-colors">
                            <Checkbox checked={group.selected} onCheckedChange={() => toggleGroupSelection(group.id)} />
                            <div className="flex-1 min-w-0">
                              <p className="font-dm text-sm text-foreground truncate">{group.name}</p>
                              {group.memberCount && <p className="font-dm text-xs text-muted-foreground">{group.memberCount.toLocaleString()} members</p>}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Craigslist */}
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center shrink-0">
                        <MapPin className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-dm text-sm font-medium text-foreground">Craigslist</p>
                        {craigslistConnected ? (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <CheckCircle2 className="w-3 h-3 text-green-500" />
                            <p className="font-dm text-xs text-green-500">{craigslistRegions.find(r => r.id === selectedCraigslistRegion)?.name || 'Connected'}</p>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <AlertCircle className="w-3 h-3 text-yellow-400" />
                            <p className="font-dm text-xs text-yellow-400">Not connected</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <Button variant={craigslistConnected ? 'outline' : 'default'} size="sm"
                      className={craigslistConnected ? 'font-dm text-xs border-border' : 'font-dm text-xs bg-purple-600 hover:bg-purple-700 text-white'}
                      onClick={() => craigslistConnected ? setCraigslistConnected(false) : handleConnectCraigslist()}>
                      {craigslistConnected ? 'Disconnect' : 'Connect'}
                    </Button>
                  </div>
                  {!craigslistConnected && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <p className="font-dm text-xs text-muted-foreground mb-2">Select your region:</p>
                      <Select value={selectedCraigslistRegion} onValueChange={setSelectedCraigslistRegion}>
                        <SelectTrigger className="bg-secondary border-border font-dm text-sm">
                          <SelectValue placeholder="Choose your Craigslist region..." />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border max-h-60">
                          {craigslistRegions.map((region) => (
                            <SelectItem key={region.id} value={region.id} className="font-dm text-sm">{region.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {craigslistConnected && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <a href={craigslistRegions.find(r => r.id === selectedCraigslistRegion)?.url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 font-dm text-xs text-primary hover:underline">
                        <ExternalLink className="w-3 h-3" /> View your Craigslist region
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* EXTENSION TAB */}
          {activeTab === 'extension' && <ExtensionSettings />}

          {/* POSTING DEFAULTS TAB */}
          {activeTab === 'posting' && (
            <div className="space-y-5 max-w-lg">
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                  <p className="font-dm text-sm font-medium text-foreground">Default Template</p>
                  <p className="font-dm text-xs text-muted-foreground mt-0.5">Used when composing new posts.</p>
                </div>
                <div className="p-5">
                  <Select value={defaultTemplate} onValueChange={setDefaultTemplate}>
                    <SelectTrigger className="bg-secondary border-border font-dm text-sm">
                      <SelectValue placeholder="Select a template" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="premium" className="font-dm text-sm">Premium Listing</SelectItem>
                      <SelectItem value="quicksale" className="font-dm text-sm">Quick Sale</SelectItem>
                      <SelectItem value="feature" className="font-dm text-sm">Feature Spotlight</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="p-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-dm text-sm font-medium text-foreground">Auto-Hashtags</p>
                    <p className="font-dm text-xs text-muted-foreground mt-0.5">Automatically append relevant hashtags to every post.</p>
                  </div>
                  <Switch checked={autoHashtags} onCheckedChange={setAutoHashtags} />
                </div>
              </div>
            </div>
          )}

          {/* NOTIFICATIONS TAB */}
          {activeTab === 'notifications' && (
            <div className="space-y-4 max-w-lg">
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="p-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-dm text-sm font-medium text-foreground">Email Alerts</p>
                    <p className="font-dm text-xs text-muted-foreground mt-0.5">Receive a summary email when posts go live.</p>
                  </div>
                  <Switch checked={emailAlerts} onCheckedChange={setEmailAlerts} />
                </div>
                <div className="h-px bg-border mx-5" />
                <div className="p-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-dm text-sm font-medium text-foreground">Lead Notifications</p>
                    <p className="font-dm text-xs text-muted-foreground mt-0.5">Get notified when a buyer reaches out through Marketplace.</p>
                  </div>
                  <Switch checked={leadNotifications} onCheckedChange={setLeadNotifications} />
                </div>
              </div>
            </div>
          )}

          {/* PLAN TAB */}
          {activeTab === 'plan' && <PlanTab />}
      </div>
    </div>
  );
}

// ─── Pricing / Plan component ────────────────────────────────────────────────

type BillingCycle = 'monthly' | 'annual';

interface PlanFeature { text: string; included: boolean }

interface PlanDef {
  id: string;
  name: string;
  icon: React.ReactNode;
  monthlyPrice: number;
  annualPrice: number;
  description: string;
  badge?: string;
  badgeColor?: string;
  features: PlanFeature[];
  cta: string;
  current?: boolean;
}

const PLANS: PlanDef[] = [
  {
    id: 'starter',
    name: 'Starter',
    icon: <Zap className="w-5 h-5" />,
    monthlyPrice: 0,
    annualPrice: 0,
    description: 'For dealers just getting started with Marketplace.',
    features: [
      { text: 'Up to 10 active listings', included: true },
      { text: 'Basic post templates', included: true },
      { text: 'Facebook Marketplace posting', included: true },
      { text: 'Lead inbox (read-only)', included: true },
      { text: 'Market intelligence', included: false },
      { text: 'AI reply generation', included: false },
      { text: 'Chrome Extension auto-fill', included: false },
      { text: 'MarketCheck inventory sync', included: false },
      { text: 'Craigslist & FB Groups', included: false },
      { text: 'Priority support', included: false },
    ],
    cta: 'Current Plan',
    current: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    icon: <Star className="w-5 h-5" />,
    monthlyPrice: 99,
    annualPrice: 79,
    description: 'Everything a serious dealer needs to dominate Marketplace.',
    badge: 'Most Popular',
    badgeColor: 'bg-primary text-primary-foreground',
    features: [
      { text: 'Unlimited listings', included: true },
      { text: 'All post templates', included: true },
      { text: 'Facebook Marketplace posting', included: true },
      { text: 'Full lead inbox + AI chat', included: true },
      { text: 'Market intelligence (AI scoring)', included: true },
      { text: 'AI reply generation', included: true },
      { text: 'Chrome Extension auto-fill', included: true },
      { text: 'MarketCheck inventory sync', included: true },
      { text: 'Craigslist & FB Groups', included: true },
      { text: 'Priority support', included: false },
    ],
    cta: 'Upgrade to Pro',
  },
  {
    id: 'dealer',
    name: 'Dealer',
    icon: <Crown className="w-5 h-5" />,
    monthlyPrice: 249,
    annualPrice: 199,
    description: 'For high-volume dealerships and rooftop groups.',
    badge: 'Best Value',
    badgeColor: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    features: [
      { text: 'Unlimited listings', included: true },
      { text: 'All post templates', included: true },
      { text: 'Facebook Marketplace posting', included: true },
      { text: 'Full lead inbox + AI chat', included: true },
      { text: 'Market intelligence (AI scoring)', included: true },
      { text: 'AI reply generation', included: true },
      { text: 'Chrome Extension auto-fill', included: true },
      { text: 'MarketCheck inventory sync', included: true },
      { text: 'Craigslist & FB Groups', included: true },
      { text: 'Priority support + onboarding', included: true },
    ],
    cta: 'Upgrade to Dealer',
  },
];

function PlanTab() {
  const [billing, setBilling] = useState<BillingCycle>('monthly');
  const [sub, setSub] = useState<{ plan: string; billingCycle: string; status: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean } | null>(null);
  const [loadingUpgrade, setLoadingUpgrade] = useState<string | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/billing/subscription`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.data) setSub(d.data); })
      .catch(() => {});
  }, []);

  const activePlan = sub?.plan || 'starter';
  const activeStatus = sub?.status || 'active';

  function getPrice(plan: PlanDef) {
    return billing === 'annual' ? plan.annualPrice : plan.monthlyPrice;
  }

  function isCurrentPlan(plan: PlanDef) {
    return plan.id === activePlan;
  }

  async function handleUpgrade(plan: PlanDef) {
    if (isCurrentPlan(plan)) return;
    setLoadingUpgrade(plan.id);
    try {
      const res = await fetch(`${BACKEND_URL}/api/billing/checkout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: plan.id,
          cycle: billing,
          successUrl: window.location.origin + '/?checkout=success',
          cancelUrl: window.location.origin + '/?checkout=canceled',
        }),
      });
      const data = await res.json();
      if (data.error?.code === 'STRIPE_NOT_CONFIGURED' || data.error?.code === 'PRICE_NOT_CONFIGURED') {
        toast.error('Stripe is not configured yet. Add your Stripe keys in the ENV tab.');
        return;
      }
      if (!res.ok) throw new Error(data.error?.message || 'Checkout failed');
      if (data.data?.url) {
        window.location.href = data.data.url;
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not start checkout');
    } finally {
      setLoadingUpgrade(null);
    }
  }

  async function handlePortal() {
    setLoadingPortal(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/billing/portal`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnUrl: window.location.href }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Portal failed');
      if (data.data?.url) window.location.href = data.data.url;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not open billing portal');
    } finally {
      setLoadingPortal(false);
    }
  }

  const activePlanDef = PLANS.find(p => p.id === activePlan) || PLANS[0];
  const planStatusColor = activeStatus === 'active' ? 'bg-green-500' : activeStatus === 'past_due' ? 'bg-yellow-400' : 'bg-muted-foreground';
  const planStatusLabel = activeStatus === 'active' ? 'Active' : activeStatus === 'past_due' ? 'Past Due' : activeStatus === 'canceled' ? 'Canceled' : 'Inactive';

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Current plan banner */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
            {activePlanDef.icon}
          </div>
          <div>
            <p className="font-dm text-sm font-semibold text-foreground">
              You're on the <span className="text-primary capitalize">{activePlan}</span> plan
              {sub?.billingCycle && activePlan !== 'starter' && (
                <span className="text-muted-foreground font-normal"> · {sub.billingCycle}</span>
              )}
            </p>
            <p className="font-dm text-xs text-muted-foreground mt-0.5">
              {activePlan === 'starter'
                ? 'Upgrade to unlock AI replies, Chrome Extension, and unlimited listings.'
                : sub?.currentPeriodEnd
                ? `Renews ${new Date(sub.currentPeriodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                : 'Subscription active'}
              {sub?.cancelAtPeriodEnd && ' · Cancels at period end'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activePlan !== 'starter' && (
            <Button
              size="sm"
              variant="outline"
              onClick={handlePortal}
              disabled={loadingPortal}
              className="font-dm text-xs border-border gap-1.5"
            >
              {loadingPortal ? <Loader2 className="w-3 h-3 animate-spin" /> : <CreditCard className="w-3 h-3" />}
              Manage Billing
            </Button>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border border-border">
            <div className={`w-1.5 h-1.5 rounded-full ${planStatusColor}`} />
            <span className="font-dm text-xs text-foreground font-medium">{planStatusLabel}</span>
          </div>
        </div>
      </div>

      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-3">
        <span className={`font-dm text-sm ${billing === 'monthly' ? 'text-foreground' : 'text-muted-foreground'}`}>Monthly</span>
        <button
          onClick={() => setBilling(b => b === 'monthly' ? 'annual' : 'monthly')}
          className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${billing === 'annual' ? 'bg-primary' : 'bg-secondary border border-border'}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${billing === 'annual' ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
        </button>
        <div className="flex items-center gap-2">
          <span className={`font-dm text-sm ${billing === 'annual' ? 'text-foreground' : 'text-muted-foreground'}`}>Annual</span>
          <span className="font-dm text-[10px] font-semibold bg-green-500/15 text-green-500 border border-green-500/20 px-1.5 py-0.5 rounded-full">
            Save 20%
          </span>
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-3 gap-4">
        {PLANS.map((plan) => {
          const price = getPrice(plan);
          const isCurrent = isCurrentPlan(plan);
          const isPopular = plan.id === 'pro';
          const isLoading = loadingUpgrade === plan.id;
          return (
            <div
              key={plan.id}
              className={`relative rounded-xl border flex flex-col overflow-hidden transition-all duration-150 ${
                isCurrent
                  ? 'border-primary/40 bg-primary/5'
                  : isPopular
                  ? 'border-primary bg-card shadow-lg shadow-primary/10'
                  : 'border-border bg-card hover:border-primary/30'
              }`}
            >
              {plan.badge && (
                <div className={`absolute top-3 right-3 font-dm text-[10px] font-bold px-2 py-0.5 rounded-full ${plan.badgeColor}`}>
                  {plan.badge}
                </div>
              )}
              {isCurrent && (
                <div className="absolute top-3 right-3 font-dm text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                  Current
                </div>
              )}

              <div className="p-5 flex-1 flex flex-col">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isCurrent || isPopular ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                    {plan.icon}
                  </div>
                  <p className="font-bebas text-lg tracking-wider text-foreground leading-none">{plan.name.toUpperCase()}</p>
                </div>

                <div className="mb-3">
                  {price === 0 ? (
                    <div className="font-bebas text-4xl tracking-wider text-foreground leading-none">FREE</div>
                  ) : (
                    <div className="flex items-end gap-1">
                      <span className="font-bebas text-4xl tracking-wider text-foreground leading-none">${price}</span>
                      <span className="font-dm text-xs text-muted-foreground mb-1">/mo{billing === 'annual' ? ', billed annually' : ''}</span>
                    </div>
                  )}
                  {billing === 'annual' && plan.monthlyPrice > 0 && (
                    <p className="font-dm text-[10px] text-muted-foreground mt-0.5">
                      <span className="line-through">${plan.monthlyPrice}/mo</span> billed monthly
                    </p>
                  )}
                </div>

                <p className="font-dm text-xs text-muted-foreground mb-4 leading-relaxed">{plan.description}</p>

                <div className="space-y-2 flex-1 mb-5">
                  {plan.features.map((f, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className={`mt-0.5 shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center ${f.included ? 'bg-primary/20' : 'bg-secondary'}`}>
                        {f.included
                          ? <Check className="w-2 h-2 text-primary" />
                          : <span className="w-1 h-px bg-muted-foreground/40 block" />}
                      </div>
                      <span className={`font-dm text-xs leading-relaxed ${f.included ? 'text-foreground' : 'text-muted-foreground/50'}`}>{f.text}</span>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={() => handleUpgrade(plan)}
                  disabled={isCurrent || isLoading}
                  className={`w-full font-dm text-sm font-semibold gap-1.5 ${
                    isCurrent
                      ? 'bg-primary/10 text-primary border border-primary/20 cursor-default'
                      : isPopular
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'bg-secondary text-foreground border border-border hover:border-primary/40'
                  }`}
                  variant="ghost"
                >
                  {isLoading ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" />Redirecting...</>
                  ) : isCurrent ? (
                    <><CheckCircle2 className="w-3.5 h-3.5 text-primary" />{plan.cta}</>
                  ) : plan.cta}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* All plans include */}
      <div className="bg-card border border-border rounded-lg p-4">
        <p className="font-bebas text-sm tracking-wider text-foreground mb-3">ALL PLANS INCLUDE</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            'No contracts — cancel anytime',
            'Secure data — never stored on Facebook servers',
            '99.9% uptime SLA',
            'Chrome Extension (load unpacked)',
            'Dark theme dashboard',
            'Email support',
          ].map((item) => (
            <div key={item} className="flex items-center gap-2">
              <Check className="w-3 h-3 text-primary shrink-0" />
              <span className="font-dm text-xs text-muted-foreground">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Billing management */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-bebas text-base tracking-wider text-foreground">BILLING & INVOICES</h3>
            <p className="font-dm text-xs text-muted-foreground mt-0.5">
              Manage your payment method, download invoices, or cancel your subscription.
            </p>
          </div>
          {activePlan !== 'starter' && (
            <Button
              size="sm"
              variant="outline"
              onClick={handlePortal}
              disabled={loadingPortal}
              className="font-dm text-xs border-border gap-1.5 shrink-0"
            >
              {loadingPortal ? <Loader2 className="w-3 h-3 animate-spin" /> : <CreditCard className="w-3 h-3" />}
              Open Billing Portal
            </Button>
          )}
        </div>
        <div className="p-6 text-center">
          <CreditCard className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          {activePlan === 'starter' ? (
            <>
              <p className="font-dm text-sm text-muted-foreground">No invoices yet.</p>
              <p className="font-dm text-xs text-muted-foreground mt-1">Upgrade to a paid plan to manage billing here.</p>
            </>
          ) : (
            <>
              <p className="font-dm text-sm text-muted-foreground">Click "Open Billing Portal" to view invoices and manage your subscription.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
