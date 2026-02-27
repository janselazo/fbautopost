import {
  LayoutDashboard,
  Car,
  Send,
  Clock,
  BadgeDollarSign,
  Users,
  BarChart3,
  HelpCircle,
  Settings,
  ChevronRight,
  LogOut,
  Kanban,
  CalendarDays,
  UserPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ActiveView } from './types';
import { useDealer } from '../../context/DealerContext';
import { useSupabaseSession, signOut } from '@/lib/supabase-auth';

interface SidebarProps {
  activeView: ActiveView;
  onViewChange: (view: ActiveView) => void;
}

type NavGroup = {
  label: string;
  items: {
    view: ActiveView;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }[];
};

const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { view: 'connect-inventory', label: 'Inventory', icon: Car },
      { view: 'sold', label: 'Sold Vehicles', icon: BadgeDollarSign },
      { view: 'analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { view: 'composer', label: 'Post Vehicle', icon: Send },
      { view: 'history', label: 'Post History', icon: Clock },
    ],
  },
  {
    label: 'Sales',
    items: [
      { view: 'leads-list', label: 'Leads', icon: UserPlus },
      { view: 'leads', label: 'Conversations', icon: Users, badge: 'New' },
      { view: 'crm', label: 'Opportunities', icon: Kanban },
      { view: 'calendar', label: 'Appointments', icon: CalendarDays },
    ],
  },
  {
    label: 'Account',
    items: [
      { view: 'settings', label: 'Settings', icon: Settings },
      { view: 'support', label: 'Support', icon: HelpCircle },
    ],
  },
];

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const { dealer } = useDealer();
  const { data: session } = useSupabaseSession();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (e) {
      console.error('Sign out error', e);
    }
    // Force redirect regardless — ProtectedRoute will also redirect on auth change
    window.location.href = '/login';
  };

  return (
    <aside className="hidden md:flex flex-col w-64 shrink-0 bg-card border-r border-border h-screen sticky top-0 overflow-y-auto">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-3">
          {dealer.logoUrl ? (
            <img
              src={dealer.logoUrl}
              alt={dealer.name}
              className="w-10 h-10 rounded object-cover shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded bg-primary flex items-center justify-center shrink-0 text-primary-foreground font-bebas text-lg">
              {dealer.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="font-bebas text-lg leading-tight text-foreground tracking-wide truncate">
              {dealer.name}
            </div>
            <div className="font-dm text-xs text-muted-foreground truncate">
              {session?.user?.user_metadata?.name || session?.user?.user_metadata?.full_name || session?.user?.email || 'DealerPost Pro'}
            </div>
          </div>
        </div>
      </div>

      {/* Accent line */}
      <div className="h-px bg-gradient-to-r from-primary via-primary/40 to-transparent mx-5 mt-4 mb-1" />

      {/* Nav groups */}
      <nav className="flex-1 px-3 py-3 space-y-5">
        {navGroups.map((group) => (
          <div key={group.label}>
            <div className="font-dm text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-[0.12em] px-3 mb-1.5">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map(({ view, label, icon: Icon, badge }) => {
                const isActive = activeView === view;
                return (
                  <button
                    key={view}
                    onClick={() => onViewChange(view)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-dm font-medium transition-all duration-150 group',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    )}
                  >
                    <Icon
                      className={cn(
                        'w-4 h-4 shrink-0 transition-colors',
                        isActive
                          ? 'text-primary-foreground'
                          : 'text-muted-foreground group-hover:text-foreground'
                      )}
                    />
                    <span className="flex-1 text-left">{label}</span>
                    {badge && !isActive && (
                      <span className="text-[10px] font-semibold bg-primary/20 text-primary px-1.5 py-0.5 rounded-full leading-none">
                        {badge}
                      </span>
                    )}
                    {isActive ? (
                      <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground/70 shrink-0" />
                    ) : (
                      <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="px-4 pb-5 pt-2 space-y-3 border-t border-border mt-2">
        {/* User info */}
        {session?.user && (
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-md bg-secondary/50 mt-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
              {session.user.user_metadata?.avatar_url ? (
                <img
                  src={session.user.user_metadata.avatar_url}
                  alt={session.user.user_metadata?.name || session.user.email || ''}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="font-bebas text-sm text-primary">
                  {(session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.email)?.charAt(0).toUpperCase() || 'U'}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-dm text-xs font-medium text-foreground truncate">
                {session.user.user_metadata?.name || session.user.email}
              </div>
              <div className="font-dm text-[10px] text-muted-foreground truncate">
                {session.user.email}
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Version */}
        <div className="px-3 text-center">
          <span className="font-dm text-[10px] text-muted-foreground/40 tracking-wider">
            v1.0 — DealerPost Pro
          </span>
        </div>
      </div>
    </aside>
  );
}
