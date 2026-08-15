import React, { useMemo } from 'react';
import {
  Activity, AlertOctagon, Bot, Cable, Database, Gauge, HeartPulse, Layers, LineChart,
  Radio, ShieldAlert, Users, Wallet,
} from 'lucide-react';
import { usePlatform, useLookups } from '@/contexts/PlatformContext';
import { useNav } from '@/contexts/NavContext';
import { NoticeBanner, PageHeader, SectionCard, SimBadge, StatCard, StatusBadge, EmptyState } from '@/components/shared/Primitives';
import { EventFeed, TradeSequenceCard } from '@/components/shared/RecordCards';
import { money, pnlTone, signedMoney } from '@/lib/format';

const OverviewPage: React.FC = () => {
  const { data, profile } = usePlatform();
  const { navigate } = useNav();
  const { symbolById, accountById } = useLookups();

  const stats = useMemo(() => {
    const accounts = data.accounts.filter((a) => a.status !== 'ARCHIVED');
    const paper = data.paperAccounts;
    const openPositions = data.paperPositions.filter((p) => p.status === 'OPEN');
    const openSequences = data.sequences.filter((s) => s.state !== 'CLOSED');
    const hedged = openSequences.filter((s) => s.current_hedge_tier > 0);
    const balance = paper.reduce((s, p) => s + Number(p.current_balance), 0);
    const equity = paper.reduce((s, p) => s + Number(p.current_equity), 0);
    const start = paper.reduce((s, p) => s + Number(p.starting_balance), 0);
    const simPnl = paper.reduce((s, p) => s + Number(p.simulated_pnl), 0);
    const dailyDrawdown = start > 0 ? Math.min(0, ((equity - start) / start) * 100) : 0;
    return {
      total: accounts.length,
      active: accounts.filter((a) => a.status === 'ACTIVE').length,
      autonomous: accounts.filter((a) => a.account_mode === 'AUTONOMOUS').length,
      signalcopy: accounts.filter((a) => a.account_mode === 'SIGNALCOPY').length,
      hybrid: accounts.filter((a) => a.account_mode === 'HYBRID').length,
      balance, equity, simPnl, start, dailyDrawdown,
      openPositions: openPositions.length,
      openSequences: openSequences.length,
      hedgedSequences: hedged.length,
      worstRiskState: accounts.some((a) => a.current_risk_state === 'LOCKED')
        ? 'LOCKED'
        : accounts.some((a) => a.current_risk_state === 'THROTTLED')
          ? 'THROTTLED'
          : accounts.some((a) => a.current_risk_state === 'WATCH') ? 'WATCH' : 'NORMAL',
      activeStrategies: data.strategies.filter((s) => s.status === 'ACTIVE').length,
      draftStrategies: data.strategies.filter((s) => s.status === 'DRAFT').length,
      assignedStrategies: data.assignments.length,
      enabledAssignments: data.assignments.filter((a) => a.enabled).length,
      pendingSignals: data.signals.filter((s) => s.validation_status === 'PENDING').length,
    };
  }, [data]);

  const recentSequences = data.sequences.slice(0, 4);
  const recentEvents = data.events.slice(0, 6);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Control Center"
        subtitle={`Signed in as ${profile?.full_name || profile?.email} · role ${profile?.role?.toUpperCase() ?? '—'}. Phase 1 build: foundation, database and paper trading skeleton.`}
      />

      <NoticeBanner tone="warn" title="Paper mode — no live execution exists" icon={ShieldAlert}>
        Every balance, equity and P/L figure on this screen is produced by the paper simulator. No broker is
        connected, no Expert Advisor is running and no order has ever been routed.
      </NoticeBanner>

      {/* ------------------------------ ACCOUNT SUMMARY ------------------------------ */}
      <SectionCard
        title="Account Summary"
        icon={Users}
        action={
          <button type="button" onClick={() => navigate('accounts')} className="text-[11px] font-semibold text-primary hover:underline">
            View all
          </button>
        }
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Total accounts" value={stats.total} icon={Users} />
          <StatCard label="Active" value={stats.active} icon={Activity} tone="good" />
          <StatCard label="Autonomous" value={stats.autonomous} icon={Bot} />
          <StatCard label="Signal copy" value={stats.signalcopy} icon={Radio} />
          <StatCard label="Hybrid" value={stats.hybrid} icon={Layers} />
        </div>
      </SectionCard>

      {/* --------------------------- PAPER TRADING SUMMARY --------------------------- */}
      <SectionCard
        title="Paper Trading Summary"
        icon={Wallet}
        description="Simulated ledger only. Not a broker statement."
        action={
          <button type="button" onClick={() => navigate('paper-trading')} className="text-[11px] font-semibold text-primary hover:underline">
            Open simulator
          </button>
        }
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Sim balance" value={money(stats.balance)} icon={Wallet} simulated />
          <StatCard label="Sim equity" value={money(stats.equity)} icon={Gauge} simulated />
          <StatCard
            label="Sim P/L"
            value={<span className={pnlTone(stats.simPnl)}>{signedMoney(stats.simPnl)}</span>}
            icon={LineChart}
            simulated
          />
          <StatCard label="Open sequences" value={stats.openSequences} sub={`${stats.openPositions} sim positions`} icon={Layers} />
          <StatCard label="Hedged sequences" value={stats.hedgedSequences} sub="active hedge tier > 0" icon={ShieldAlert} tone={stats.hedgedSequences > 0 ? 'warn' : 'default'} />
        </div>
      </SectionCard>

      {/* ------------------------------- RISK PLACEHOLDER ---------------------------- */}
      <SectionCard
        title="Risk Placeholder"
        icon={Gauge}
        description="Displays stored configuration and simulated drawdown. The Risk Engine itself arrives in Phase 2."
        action={
          <button type="button" onClick={() => navigate('risk-profiles')} className="text-[11px] font-semibold text-primary hover:underline">
            Risk profiles
          </button>
        }
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard
            label="Aggregate risk state"
            value={<StatusBadge value={stats.worstRiskState} dot />}
            sub="Worst state across active accounts"
          />
          <StatCard
            label="Sim drawdown"
            value={`${stats.dailyDrawdown.toFixed(2)}%`}
            tone={stats.dailyDrawdown < -1 ? 'warn' : 'default'}
            sub="Equity vs simulated starting balance"
            simulated
          />
          <StatCard label="Circuit breaker" value="NOT ARMED" sub="Phase 2 component" icon={AlertOctagon} />
          <StatCard label="Risk profiles" value={data.riskProfiles.filter((r) => r.status === 'ACTIVE').length} sub="stored configurations" />
        </div>
        <div className="mt-3">
          <NoticeBanner title="Single approval path">
            No dashboard control, growth-journey value or strategy field can size a position. When the Risk Engine
            lands it becomes the only gate between a decision and an order.
          </NoticeBanner>
        </div>
      </SectionCard>

      {/* ------------------------------ STRATEGY SUMMARY ----------------------------- */}
      <SectionCard
        title="Strategy Summary"
        icon={Bot}
        action={
          <button type="button" onClick={() => navigate('strategies')} className="text-[11px] font-semibold text-primary hover:underline">
            View all
          </button>
        }
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard label="Active strategies" value={stats.activeStrategies} />
          <StatCard label="Draft strategies" value={stats.draftStrategies} sub="cannot trade" />
          <StatCard label="Assignments" value={stats.assignedStrategies} sub={`${stats.enabledAssignments} enabled`} />
          <StatCard label="Pending signals" value={stats.pendingSignals} sub="await manual review" icon={Radio} tone={stats.pendingSignals > 0 ? 'warn' : 'default'} />
        </div>
      </SectionCard>

      {/* -------------------------------- SYSTEM STATUS ------------------------------ */}
      <SectionCard title="System Status" icon={Database} description="Honest status only. Nothing here is faked.">
        <ul className="space-y-2">
          {[
            { icon: Database, label: 'Database', detail: 'Connected · row-level security enforced', badge: 'READY', tone: 'good' as const },
            { icon: Activity, label: 'Paper engine', detail: 'Operational · manual simulation only', badge: 'ACTIVE', tone: 'good' as const },
            { icon: Gauge, label: 'Risk Engine', detail: 'Phase 2 — mandatory approval gate, not built', badge: 'NOT AVAILABLE', tone: 'neutral' as const },
            { icon: Cable, label: 'MT5 connection', detail: 'No broker terminal is attached to this platform', badge: 'NOT CONNECTED', tone: 'neutral' as const },
            { icon: HeartPulse, label: 'EA heartbeat', detail: 'Phase 6 — no Expert Advisor exists yet', badge: 'NOT AVAILABLE', tone: 'neutral' as const },
            { icon: Cable, label: 'Execution bridge', detail: 'Phase 5 — no execution queue is running', badge: 'NOT AVAILABLE', tone: 'neutral' as const },
            { icon: Radio, label: 'Signal adapters', detail: 'Email / Telegram / Webhook / Discord / API not connected', badge: 'MANUAL ONLY', tone: 'neutral' as const },
          ].map((row) => (
            <li key={row.label} className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-secondary/20 px-3 py-2.5">
              <row.icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold">{row.label}</p>
                <p className="truncate text-[11px] text-muted-foreground">{row.detail}</p>
              </div>
              <StatusBadge value={row.badge} tone={row.tone} dot={row.tone === 'good'} />
            </li>
          ))}
        </ul>
      </SectionCard>

      {/* ---------------------------- ACTIVITY + SEQUENCES --------------------------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Recent Trade Sequences"
          icon={Layers}
          action={
            <button type="button" onClick={() => navigate('trade-sequences')} className="text-[11px] font-semibold text-primary hover:underline">
              All sequences
            </button>
          }
        >
          {recentSequences.length === 0 ? (
            <EmptyState icon={Layers} title="No sequences yet" description="Open a simulated position in the paper simulator to create your first sequence." />
          ) : (
            <div className="space-y-2">
              {recentSequences.map((s) => (
                <TradeSequenceCard
                  key={s.id}
                  sequence={s}
                  symbol={symbolById.get(s.symbol_id)}
                  accountName={accountById.get(s.account_id)?.name}
                  onClick={() => navigate('trade-sequence-detail', s.id)}
                />
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="System Events"
          icon={Activity}
          action={
            <button type="button" onClick={() => navigate('system-events')} className="text-[11px] font-semibold text-primary hover:underline">
              Full journal
            </button>
          }
        >
          {recentEvents.length === 0 ? (
            <EmptyState icon={Activity} title="No events recorded" />
          ) : (
            <EventFeed events={recentEvents} compact />
          )}
        </SectionCard>
      </div>

      <p className="flex items-center justify-center gap-1.5 pb-2 text-center text-[10px] text-muted-foreground">
        <SimBadge label="ALL VALUES SIMULATED" />
      </p>
    </div>
  );
};

export default OverviewPage;
