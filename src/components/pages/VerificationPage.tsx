import React from 'react';
import { CheckCircle2, CircleSlash, Database, FileCheck2, Lock, Smartphone, XCircle } from 'lucide-react';
import { usePlatform } from '@/contexts/PlatformContext';
import { NoticeBanner, PageHeader, SectionCard, StatusBadge } from '@/components/shared/Primitives';

const TABLES = [
  ['profiles', 'Operator identity, workspace membership and role (owner / admin / viewer).'],
  ['symbols', 'Reference instruments. Global rows are shared read-only; workspace rows are private.'],
  ['risk_profiles', 'Risk configuration records. Consumed by the Phase 2 Risk Engine only.'],
  ['trading_accounts', 'Account records, modes, risk state and execution placeholders.'],
  ['account_groups', 'Named groupings of accounts.'],
  ['account_group_members', 'Group membership with a per-account risk multiplier.'],
  ['strategies', 'Strategy definitions with entry / exit / hedge / regime / risk JSONB rule blocks.'],
  ['strategy_assignments', 'Many-to-many account ↔ strategy links with priority and overrides.'],
  ['signals', 'Signal intake shaped for future adapters. Manual entry only today.'],
  ['trade_sequences', 'Full lifecycle records: primary, hedge, re-entry, resolution.'],
  ['trades', 'Individual trade legs with broker id columns reserved for Phase 5.'],
  ['hedge_records', 'Hedge legs with trigger reason, tier and status.'],
  ['paper_accounts', 'Simulated ledgers attached to trading accounts.'],
  ['paper_positions', 'Simulated positions with manual price and simulated P/L.'],
  ['paper_decision_log', 'Manual operator actions in the simulator. Never implies a strategy engine.'],
  ['system_events', 'Append-only audit journal with human-readable messages.'],
  ['growth_journey', 'Reference progression curve. Presentation data only.'],
  ['app_settings', 'Non-sensitive workspace configuration.'],
];

const RLS = [
  ['Workspace isolation', 'Every table filters on the caller\'s workspace_id, resolved by a SECURITY DEFINER helper. Authenticated users cannot read another workspace\'s data.'],
  ['Role enforcement', 'Insert and update policies require can_write() — true for owner and admin only. Viewers hold read policies exclusively.'],
  ['Owner-only surfaces', 'app_settings writes, profile role changes, and the two delete policies (group membership, strategy assignment) require is_owner().'],
  ['No blanket policy', 'No "allow all authenticated" policy exists on any table.'],
  ['Financial record protection', 'trades, trade_sequences, hedge_records, paper_positions, paper_accounts, signals and system_events have no DELETE policy at all — archive and status changes only.'],
  ['Audit append-only', 'system_events accepts inserts from any workspace member and exposes no update or delete policy.'],
];

const PAGES = [
  'OverviewPage', 'AccountsPage', 'AccountDetailPage', 'AccountGroupsPage', 'RiskProfilesPage',
  'StrategiesPage', 'StrategyDetailPage', 'StrategyAssignmentsPage', 'SignalsPage',
  'TradeSequencesPage', 'TradeSequenceDetailPage', 'TradesPage', 'HedgeRecordsPage',
  'PaperTradingPage', 'SystemEventsPage', 'GrowthJourneyPage', 'SettingsPage', 'VerificationPage',
];

const COMPONENTS = [
  'StatusBadge', 'StatCard', 'SimBadge', 'SectionCard', 'PageHeader', 'EmptyState', 'Field',
  'NoticeBanner', 'SearchBar', 'FilterBar', 'MobileRecordCard', 'RecordTable', 'ConfirmDialog',
  'LoadingRows', 'ActionButton', 'AccountSummaryCard', 'StrategySummaryCard', 'RiskProfileCard',
  'TradeSequenceCard', 'TradeLegCard', 'HedgeStatusCard', 'SignalCard', 'PaperPositionCard',
  'EventFeed', 'JsonRulesCard',
];

const SERVICES = [
  ['accountService', 'Accounts, groups, group members and risk profiles (create / edit / archive).'],
  ['strategyService', 'Strategies, assignments, symbols and signals.'],
  ['tradeSequenceService', 'Sequences, trade legs and hedge records.'],
  ['paperTradingService', 'The only module that creates simulated positions.'],
  ['systemEventService', 'Audit journal writer and reader.'],
  ['settingsService', 'Growth journey, app settings and profile roles.'],
  ['futureEngines', 'Declared insertion points: riskEngine, regimeEngine, strategyEngine, execution, reconciliation, signalAdapter.'],
];

const NOT_BUILT = [
  'Live MT5 broker execution and any real order routing',
  'MQL5 Expert Advisor (Phase 6)',
  'MT5 execution bridge and execution queue (Phase 5)',
  'Risk Engine — the mandatory sizing and approval gate (Phase 2)',
  'Regime Engine (Phase 3) and historical validation / backtesting (Phase 3.5)',
  'Adaptive Structural Hedge strategy engine (Phase 4)',
  'Live market data streaming and real broker margin calculations',
  'Autonomous trade generation and automatic hedge decisions',
  'Email, Telegram, Discord, Webhook and API signal adapters',
  'AI trade decisions, news trading and portfolio optimisation',
  'Broker reconciliation of tickets, deals and orders',
];

const NEVER = [
  'Martingale, doubling or unlimited position scaling',
  'Unlimited hedge tiers or unlimited recovery ladders',
  'Hidden risk multipliers or any bypass of the future Risk Engine',
  '"No liquidation" or guaranteed-outcome claims',
  'Frontend-only authorization',
  'Hard deletion of financial or audit records',
  'Fake broker connection status or fabricated live results',
];

const Row: React.FC<{ ok?: boolean; title: string; detail?: string }> = ({ ok = true, title, detail }) => (
  <li className="flex gap-2.5 rounded-lg border border-border/70 bg-secondary/20 p-2.5">
    {ok
      ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
      : <CircleSlash className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
    <div className="min-w-0">
      <p className="text-[12px] font-semibold">{title}</p>
      {detail && <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{detail}</p>}
    </div>
  </li>
);

const VerificationPage: React.FC = () => {
  const { data } = usePlatform();

  const counts = [
    ['Trading accounts', data.accounts.length],
    ['Account groups', data.groups.length],
    ['Group memberships', data.groupMembers.length],
    ['Risk profiles', data.riskProfiles.length],
    ['Strategies', data.strategies.length],
    ['Strategy assignments', data.assignments.length],
    ['Symbols', data.symbols.length],
    ['Signals', data.signals.length],
    ['Trade sequences', data.sequences.length],
    ['Trade legs', data.trades.length],
    ['Hedge records', data.hedges.length],
    ['Paper accounts', data.paperAccounts.length],
    ['Paper positions', data.paperPositions.length],
    ['Decision log entries', data.decisionLog.length],
    ['System events', data.events.length],
    ['App settings', data.settings.length],
  ] as const;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Phase 1 Verification Report"
        subtitle="What was built, what is enforced, and exactly what was intentionally left unimplemented."
      />

      <NoticeBanner tone="warn" title="Scope statement">
        This build is Phase 1 only: foundation, database, authentication, role-based access and a paper trading
        skeleton. No live trading capability exists anywhere in the codebase.
      </NoticeBanner>

      <SectionCard title={`Tables Created (${TABLES.length})`} icon={Database}>
        <ul className="space-y-2">
          {TABLES.map(([name, detail]) => <Row key={name} title={name} detail={detail} />)}
        </ul>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Foreign keys link every relationship in the brief, and indexes cover workspace_id, status, foreign keys and
          time-ordered columns on all high-traffic tables.
        </p>
      </SectionCard>

      <SectionCard title="Row Level Security" icon={Lock}>
        <ul className="space-y-2">
          {RLS.map(([title, detail]) => <Row key={title} title={title} detail={detail} />)}
        </ul>
      </SectionCard>

      <SectionCard title="Seed Data Present In This Workspace" icon={FileCheck2} description="Every seeded record is marked DEMO and is never presented as a real historical trade.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {counts.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border/70 bg-secondary/20 p-2.5">
              <p className="label-caps truncate">{label}</p>
              <p className="num mt-0.5 text-lg font-semibold">{value}</p>
            </div>
          ))}
        </div>
        <ul className="mt-3 space-y-2">
          <Row title="ASH-DEMO-001" detail="EURUSD, primary BUY 0.10, hedge SELL 0.05 at tier 1, state HEDGED, trigger 'Structural invalidation (demo)'." />
          <Row title="ASH-DEMO-002" detail="GBPUSD, fully resolved cycle: primary BUY, adverse move, hedge SELL, hedge active, sequence closed with a net positive simulated result." />
          <Row title="ASH-DEMO-003" detail="XAUUSD, unhedged primary SELL in WATCH state." />
        </ul>
      </SectionCard>

      <SectionCard title={`Pages (${PAGES.length})`} icon={FileCheck2}>
        <div className="flex flex-wrap gap-1.5">
          {PAGES.map((p) => <StatusBadge key={p} value={p} tone="info" />)}
        </div>
      </SectionCard>

      <SectionCard title={`Shared Components (${COMPONENTS.length})`} icon={FileCheck2}>
        <div className="flex flex-wrap gap-1.5">
          {COMPONENTS.map((c) => <StatusBadge key={c} value={c} tone="neutral" />)}
        </div>
      </SectionCard>

      <SectionCard title="Service Architecture" icon={FileCheck2} description="All logic lives in services; page components only compose and present.">
        <ul className="space-y-2">
          {SERVICES.map(([name, detail]) => <Row key={name} title={name} detail={detail} />)}
        </ul>
      </SectionCard>

      <SectionCard title="Paper Trading Functionality Completed" icon={CheckCircle2}>
        <ul className="space-y-2">
          <Row title="Select a paper account" detail="Switch between simulated ledgers, and create a new one against any trading account." />
          <Row title="Create a simulated PRIMARY position" detail="Writes a sequence, a trade leg and a paper position in one guarded action." />
          <Row title="Create a simulated HEDGE leg" detail="Opposite direction, operator-chosen volume, writes a hedge record and moves the sequence to HEDGED." />
          <Row title="Manually update the simulated price" detail="Recomputes simulated P/L on the position, the trade leg and the account ledger." />
          <Row title="Close a simulated position" detail="Realises the simulated result and resolves the sequence when the last leg closes." />
          <Row title="Hedge tier limit enforced" detail="A hedge above the risk profile's max_hedge_tiers is refused with HEDGE TIER LIMIT REACHED before anything is written." />
          <Row title="Pause / resume paper trading" detail="A paused paper account refuses every new simulated action." />
          <Row title="Risk Check Preview (read-only)" detail="Shows which stored risk-profile limits a draft position would be measured against and whether it would pass or fail each. It is a preview of the Phase 2 Risk Engine only: it sizes nothing, writes nothing and gates nothing." />

          <Row title="No broker order is generated" detail="The paper service imports no broker client; every trade is written with execution_status PAPER and null broker ids." />
        </ul>
      </SectionCard>

      <SectionCard title="Mobile Testing Results" icon={Smartphone}>
        <ul className="space-y-2">
          <Row title="390px primary target" detail="Layouts are single-column at 390px with a fixed bottom navigation bar and a More menu for secondary destinations." />
          <Row title="Touch targets" detail="Primary controls, form inputs and dialog buttons are 40–44px tall." />
          <Row title="Card lists instead of tables" detail="Every list screen renders record cards on mobile; the tabular component is reserved for large screens." />
          <Row title="Horizontal scrolling" detail="Limited to the filter chip rows, which scroll deliberately rather than shrinking." />
          <Row title="Desktop" detail="Content is centred with a max width and grids expand to two, four and five columns at sm, lg and xl." />
          <Row ok={false} title="Not device-lab tested" detail="Verified against responsive breakpoints in the browser, not against physical handsets." />
        </ul>
      </SectionCard>

      <SectionCard title="Intentionally Not Implemented" icon={XCircle} description="Phase 2 to Phase 6. Declared as insertion points, not built.">
        <ul className="space-y-1.5">
          {NOT_BUILT.map((n) => (
            <li key={n} className="flex gap-2 text-[11px] leading-relaxed text-muted-foreground">
              <CircleSlash className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              <span>{n}</span>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="Anti-Patterns Deliberately Absent" icon={Lock}>
        <ul className="space-y-1.5">
          {NEVER.map((n) => (
            <li key={n} className="flex gap-2 text-[11px] leading-relaxed text-muted-foreground">
              <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-rose-400/70" aria-hidden="true" />
              <span>{n}</span>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="Known Limitations" icon={CircleSlash}>
        <ul className="space-y-2">
          <Row ok={false} title="Simulated P/L is deliberately simple" detail="Contract-size based, with no swap, no commission and no broker margin model. Non-USD quote conversion is approximated." />
          <Row ok={false} title="Each new sign-up gets its own workspace" detail="Team invitations are not built; a second operator joins by having their profile's workspace changed at the database level." />
          <Row ok={false} title="No realtime subscriptions" detail="Screens refresh on action rather than streaming, because there is no live data source to stream." />
          <Row ok={false} title="Growth journey is manual" detail="Levels and actual balance are entered by the operator. It is never derived from, and never feeds, the risk path." />
        </ul>
      </SectionCard>
    </div>
  );
};

export default VerificationPage;
