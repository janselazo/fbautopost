import { useState } from 'react';
import {
  Car,
  Menu,
  X,
  LayoutDashboard,
  Users,
  UserPlus,
  Settings,
  CalendarDays,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sidebar } from '@/components/autopost/Sidebar';
import { DashboardView } from '@/components/autopost/DashboardView';
import { LeadsView } from '@/components/autopost/LeadsView';
import { LeadsListView } from '@/components/autopost/LeadsListView';
import { SettingsView } from '@/components/autopost/SettingsView';
import { ConnectInventory } from '@/components/autopost/ConnectInventory';
import { CalendarView } from '@/components/autopost/CalendarView';
import { OnboardingFlow } from '@/components/autopost/OnboardingFlow';
import { DealerLogicSettings } from '@/components/autopost/DealerLogicSettings';
import { ListingAnalyticsView } from '@/components/autopost/ListingAnalyticsView';
import { DealershipProvider, useDealership } from '@/components/autopost/DealershipContext';
import { FacebookProvider, useFacebook } from '@/components/autopost/FacebookContext';
import type { ActiveView } from '@/components/autopost/types';

const mobileNavItems: { view: ActiveView; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { view: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { view: 'connect-inventory', label: 'Inventory', icon: Car },
  { view: 'listing-analytics', label: 'Analytics', icon: BarChart3 },
  { view: 'leads', label: 'Conversations', icon: Users },
  { view: 'leads-list', label: 'Leads', icon: UserPlus },
  { view: 'calendar', label: 'Appointments', icon: CalendarDays },
  { view: 'settings', label: 'Settings', icon: Settings },
];

function IndexContent() {
  const { isConnected } = useDealership();
  const { connected: facebookConnected } = useFacebook();
  const [activeView, setActiveView] = useState<ActiveView>(isConnected ? 'dashboard' : 'connect-inventory');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleViewChange = (view: ActiveView) => {
    setActiveView(view);
    setMobileMenuOpen(false);
  };

  return (
    <div className="flex h-screen bg-background font-dm overflow-hidden">
      {/* Desktop Sidebar */}
      <Sidebar activeView={activeView} onViewChange={handleViewChange} />

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
            <Car className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bebas text-xl tracking-wider text-foreground">AUTOPOST</span>
          <span className="font-dm text-[10px] text-muted-foreground hidden sm:inline ml-1.5">Marketplace & Messenger</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen((o) => !o)}
          className="w-9 h-9 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile overlay menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-background/95 backdrop-blur-sm pt-16 overflow-y-auto">
          <nav className="flex flex-col gap-1 px-4 py-4">
            {mobileNavItems.map(({ view, label, icon: Icon }) => (
              <button
                key={view}
                onClick={() => handleViewChange(view)}
                className={cn(
                  'flex items-center gap-3 px-4 py-4 rounded text-base font-dm font-medium transition-all duration-200',
                  activeView === view
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                )}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {label}
              </button>
            ))}
            <div className="mt-6 flex items-center gap-2 px-4 py-3 rounded bg-secondary">
              <div className={cn('w-2 h-2 rounded-full', facebookConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500')} />
              <span className={cn('font-dm text-sm font-medium', facebookConnected ? 'text-green-500' : 'text-yellow-500')}>
                {facebookConnected ? 'Connected to Facebook' : 'Facebook not connected'}
              </span>
            </div>
          </nav>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
        {/* Geometric grid overlay */}
        <div
          className="fixed inset-0 pointer-events-none opacity-[0.015] z-0"
          style={{
            backgroundImage:
              'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative z-10 px-4 md:px-8 py-6 max-w-7xl mx-auto">
          {activeView === 'dashboard' && (
            <DashboardView onNavigate={handleViewChange} />
          )}
          {activeView === 'onboarding' && (
            <OnboardingFlow onNavigate={handleViewChange} />
          )}
          {activeView === 'listing-analytics' && (
            <ListingAnalyticsView onNavigate={handleViewChange} />
          )}
          {activeView === 'leads' && (
            <LeadsView />
          )}
          {activeView === 'leads-list' && (
            <LeadsListView />
          )}
          {activeView === 'calendar' && (
            <CalendarView />
          )}
          {activeView === 'dealer-logic' && (
            <DealerLogicSettings onNavigate={handleViewChange} />
          )}
          {activeView === 'settings' && (
            <SettingsView />
          )}
          {activeView === 'connect-inventory' && (
            <ConnectInventory onConnected={handleViewChange} />
          )}
        </div>
      </main>
    </div>
  );
}

export default function Index() {
  return (
    <FacebookProvider>
      <DealershipProvider>
        <IndexContent />
      </DealershipProvider>
    </FacebookProvider>
  );
}
