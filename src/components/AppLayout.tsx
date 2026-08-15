import React, { useState } from 'react';
import {
  Activity, Bot, Boxes, ClipboardCheck, Gauge, LayoutDashboard, Layers, LogOut, Menu,
  Radio, Receipt, RefreshCw, Settings as SettingsIcon, ShieldAlert, TerminalSquare,
  TrendingUp, Users, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PlatformProvider, usePlatform } from '@/contexts/PlatformContext';
import { NavProvider, useNav, type RouteKey } from '@/contexts/NavContext';
import AuthScreen from '@/components/AuthScreen';
import OverviewPage from '@/components/pages/OverviewPage';
import { AccountsPage, AccountDetailPage } from '@/components/pages/AccountsPage';
import { AccountGroupsPage, RiskProfilesPage } from '@/components/pages/GroupsRiskPage';
import { StrategiesPage, StrategyDetailPage, StrategyAssignmentsPage } from '@/components/pages/StrategiesPage';
import SignalsPage from '@/components/pages/SignalsPage';
import { TradeSequencesPage, TradeSequenceDetailPage } from '@/components/pages/SequencesPage';
import { TradesPage, HedgeRecordsPage } from '@/components/pages/TradesPage';
import PaperTradingPage from '@/components/pages/PaperTradingPage';
import { SystemEventsPage, GrowthJourneyPage, SettingsPage } from '@/components/pages/SystemPages';
import VerificationPage from '@/components/pages/VerificationPage';
import { StatusBadge } from '@/components/shared/Primitives';

interface NavItem {
  key: RouteKey;
  label: string;
  icon: LucideIcon;
}

const BOTTOM_NAV: NavItem[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'accounts', label: 'Accounts', icon: Users },
  { key: 'strategies', label: 'Strategies', icon: Bot },
  { key: 'risk-profiles', label: 'Risk', icon: Gauge },
  { key: 'trade-sequences', label: 'Trades', icon: Layers },
];

const MORE_NAV: NavItem[] = [
  { key: 'account-groups', label: 'Account Groups', icon: Boxes },
  { key: 'signals', label: 'Signals', icon: Radio },
  { key: 'trade-sequences', label: 'Trade Sequences', icon: Layers },
  { key: 'trades', label: 'Trades', icon: Receipt },
  { key: 'hedge-records', label: 'Hedge Records', icon: ShieldAlert },
  { key: 'strategy-assignments', label: 'Strategy Assignments', icon: Bot },
  { key: 'paper-trading', label: 'Paper Trading', icon: TerminalSquare },
  { key: 'system-events', label: 'System Events', icon: Activity },
  { key: 'growth-journey', label: 'Growth Journey', icon: TrendingUp },
  { key: 'verification', label: 'Verification Report', icon: ClipboardCheck },
  { key: 'settings', label: 'Settings', icon: SettingsIcon },
];

const PageRouter: React.FC = () => {
  const { route } = useNav();
  switch (route.key) {
    case 'overview': return <OverviewPage />;
    case 'accounts': return <AccountsPage />;
    case 'account-detail': return <AccountDetailPage accountId={route.id} />;
    case 'account-groups': return <AccountGroupsPage />;
    case 'risk-profiles': return <RiskProfilesPage />;
    case 'strategies': return <StrategiesPage />;
    case 'strategy-detail': return <StrategyDetailPage strategyId={route.id} />;
    case 'strategy-assignments': return <StrategyAssignmentsPage />;
    case 'signals': return <SignalsPage />;
    case 'trade-sequences': return <TradeSequencesPage />;
    case 'trade-sequence-detail': return <TradeSequenceDetailPage sequenceId={route.id} />;
    case 'trades': return <TradesPage />;
    case 'hedge-records': return <HedgeRecordsPage />;
    case 'paper-trading': return <PaperTradingPage />;
    case 'system-events': return <SystemEventsPage />;
    case 'growth-journey': return <GrowthJourneyPage />;
    case 'settings': return <SettingsPage />;
    case 'verification': return <VerificationPage />;
    default: return <OverviewPage />;
  }
};

const Shell: React.FC = () => {
  const { profile, dataLoading, refresh, error, signOut } = usePlatform();
  const { route, navigate } = useNav();
  const [moreOpen, setMoreOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const isMoreRoute = MORE_NAV.some((m) => m.key === route.key) && !BOTTOM_NAV.some((b) => b.key === route.key);

  const go = (key: RouteKey) => {
    setMoreOpen(false);
    navigate(key);
  };

  const doRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* ---------------------------------- HEADER --------------------------------- */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/92 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-3 py-2.5 sm:px-6">
          <button
            type="button"
            onClick={() => go('overview')}
            className="flex min-w-0 items-center gap-2 text-left"
            aria-label="Go to overview"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/40 bg-primary/10">
              <Activity className="h-4 w-4 text-primary" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-bold leading-tight">MT5 Adaptive Hedge</span>
              <span className="block truncate text-[10px] leading-tight text-muted-foreground">Trading Control Center</span>
            </span>
          </button>

          <div className="ml-auto flex items-center gap-1.5">
            <StatusBadge value="PHASE 1 · PAPER" tone="warn" className="hidden sm:inline-flex" />
            <button
              type="button"
              onClick={doRefresh}
              aria-label="Refresh data"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              <RefreshCw className={cn('h-4 w-4', (refreshing || dataLoading) && 'animate-spin')} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => signOut()}
              aria-label="Sign out"
              className="hidden h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-rose-500/50 hover:text-rose-300 sm:flex"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* desktop nav */}
        <nav aria-label="Primary" className="hidden border-t border-border/60 lg:block">
          <div className="scroll-thin mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-6 py-1.5">
            {[...BOTTOM_NAV, ...MORE_NAV].filter((item, i, arr) => arr.findIndex((x) => x.key === item.key) === i).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => go(item.key)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors',
                  route.key === item.key ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                )}
              >
                <item.icon className="h-3.5 w-3.5" aria-hidden="true" />
                {item.label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      {/* ----------------------------------- MAIN ---------------------------------- */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-3 pb-28 pt-4 sm:px-6 lg:pb-10">
        {error && (
          <div role="alert" className="mb-4 rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-2.5 text-[11px] text-rose-300">
            {error}
          </div>
        )}
        <div key={route.key + (route.id ?? '')} className="animate-rise">
          <PageRouter />
        </div>
      </main>

      {/* ---------------------------------- FOOTER --------------------------------- */}
      <footer className="border-t border-border/70 bg-background/60 px-3 pb-28 pt-6 sm:px-6 lg:pb-8">
        <div className="mx-auto grid w-full max-w-6xl gap-6 sm:grid-cols-3">
          <div>
            <p className="text-[12px] font-bold">MT5 Adaptive Hedge Trading Platform</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Phase 1 — foundation, database and paper trading skeleton. No broker connection, no Expert Advisor,
              no live market data and no order routing exist in this build.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <StatusBadge value="MT5 NOT CONNECTED" tone="neutral" />
              <StatusBadge value="EA NOT AVAILABLE" tone="neutral" />
              <StatusBadge value="BRIDGE NOT AVAILABLE" tone="neutral" />
            </div>
          </div>
          <nav aria-label="Footer sections">
            <p className="label-caps mb-2">Sections</p>
            <ul className="space-y-1">
              {BOTTOM_NAV.map((n) => (
                <li key={n.key}>
                  <button type="button" onClick={() => go(n.key)} className="text-[11px] text-muted-foreground transition-colors hover:text-primary">
                    {n.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Footer tools">
            <p className="label-caps mb-2">Tools</p>
            <ul className="space-y-1">
              {MORE_NAV.slice(5).map((n) => (
                <li key={n.key}>
                  <button type="button" onClick={() => go(n.key)} className="text-[11px] text-muted-foreground transition-colors hover:text-primary">
                    {n.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <p className="mx-auto mt-6 w-full max-w-6xl text-[10px] text-muted-foreground">
          Signed in as {profile?.email ?? '—'} · role {profile?.role?.toUpperCase() ?? '—'} · access enforced by
          database row-level security.
        </p>
      </footer>

      {/* -------------------------------- MORE SHEET ------------------------------- */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="More destinations">
          <button type="button" aria-label="Close menu" onClick={() => setMoreOpen(false)} className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <div className="absolute inset-x-0 bottom-0 animate-rise rounded-t-2xl border-t border-border bg-card p-4 pb-24">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold">More</p>
              <button type="button" onClick={() => setMoreOpen(false)} aria-label="Close" className="rounded-md border border-border p-2 text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="grid grid-cols-2 gap-2">
              {MORE_NAV.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => go(item.key)}
                    className="flex h-16 w-full flex-col items-start justify-center gap-1 rounded-lg border border-border bg-secondary/30 px-3 text-left transition-colors hover:border-primary/50"
                  >
                    <item.icon className="h-4 w-4 text-primary" aria-hidden="true" />
                    <span className="text-[11px] font-semibold leading-tight">{item.label}</span>
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => { setMoreOpen(false); signOut(); }}
                  className="flex h-16 w-full flex-col items-start justify-center gap-1 rounded-lg border border-border bg-secondary/30 px-3 text-left transition-colors hover:border-rose-500/50"
                >
                  <LogOut className="h-4 w-4 text-rose-400" aria-hidden="true" />
                  <span className="text-[11px] font-semibold leading-tight">Sign out</span>
                </button>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* ------------------------------- BOTTOM NAV -------------------------------- */}
      <nav aria-label="Primary mobile" className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur-md lg:hidden">
        <ul className="mx-auto flex w-full max-w-lg">
          {BOTTOM_NAV.map((item) => {
            const active = route.key === item.key;
            return (
              <li key={item.key} className="flex-1">
                <button
                  type="button"
                  onClick={() => go(item.key)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex h-16 w-full flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors',
                    active ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  <item.icon className={cn('h-5 w-5', active && 'scale-110 transition-transform')} aria-hidden="true" />
                  {item.label}
                </button>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={cn(
                'flex h-16 w-full flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors',
                isMoreRoute || moreOpen ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
              More
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
};

const Gate: React.FC = () => {
  const { session, authLoading, profile, dataLoading } = usePlatform();

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Activity className="h-6 w-6 animate-pulse text-primary" aria-hidden="true" />
          <p className="text-xs text-muted-foreground">Starting control center…</p>
        </div>
      </div>
    );
  }

  if (!session) return <AuthScreen />;

  if (!profile && dataLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Activity className="h-6 w-6 animate-pulse text-primary" aria-hidden="true" />
          <p className="text-xs text-muted-foreground">Preparing your workspace and demo records…</p>
        </div>
      </div>
    );
  }

  return (
    <NavProvider>
      <Shell />
    </NavProvider>
  );
};

const AppLayout: React.FC = () => (
  <PlatformProvider>
    <Gate />
  </PlatformProvider>
);

export default AppLayout;
