import React from 'react';
import {
  Activity, ArrowDownRight, ArrowUpRight, Braces, Copy, Layers, Radio, ShieldAlert, Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { dateTime, humanise, lots, money, pnlTone, price, relTime, signedMoney } from '@/lib/format';
import type {
  HedgeRecord, PaperPosition, RiskProfile, Signal, Strategy, Symbol as TradingSymbol,
  SystemEvent, Trade, TradeSequence, TradingAccount,
} from '@/lib/types';
import { Field, SimBadge, StatusBadge } from './Primitives';
import { MobileRecordCard } from './Controls';

/* ---------------------------- AccountSummaryCard --------------------------- */

export const AccountSummaryCard: React.FC<{
  account: TradingAccount;
  riskProfileName?: string;
  strategyCount?: number;
  onClick?: () => void;
}> = ({ account, riskProfileName, strategyCount = 0, onClick }) => (
  <MobileRecordCard
    onClick={onClick}
    title={account.name}
    meta={`${account.broker ?? 'No broker set'} · ${account.account_reference ?? 'no reference'}`}
    badge={<StatusBadge value={account.status} />}
  >
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Field label="Mode" value={<StatusBadge value={account.account_mode} tone="info" />} />
      <Field label="Risk state" value={<StatusBadge value={account.current_risk_state} />} />
      <Field label="Risk profile" value={riskProfileName ?? 'Unassigned'} />
      <Field label="Strategies" value={`${strategyCount} assigned`} mono />
    </div>
    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
      <StatusBadge value={`MT5 ${account.execution_status.replace('_', ' ')}`} tone="neutral" dot />
      {account.trading_enabled ? (
        <StatusBadge value="TRADING FLAG ON" tone="warn" />
      ) : (
        <StatusBadge value="EXECUTION DISABLED" tone="neutral" />
      )}
      {account.manual_stop_active && <StatusBadge value="MANUAL STOP" tone="bad" />}
      {account.hedging_allowed && <StatusBadge value="HEDGING ALLOWED" tone="info" />}
    </div>
  </MobileRecordCard>
);

/* ---------------------------- StrategySummaryCard -------------------------- */

export const StrategySummaryCard: React.FC<{
  strategy: Strategy;
  assignedCount?: number;
  onClick?: () => void;
}> = ({ strategy, assignedCount = 0, onClick }) => (
  <MobileRecordCard
    onClick={onClick}
    title={strategy.name}
    meta={`${humanise(strategy.strategy_type)} · ${strategy.version}`}
    badge={<StatusBadge value={strategy.status} />}
  >
    <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{strategy.description}</p>
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <StatusBadge value={`${assignedCount} ACCOUNTS`} tone="neutral" />
      {strategy.status === 'DRAFT' && <StatusBadge value="CANNOT TRADE" tone="draft" />}
      <StatusBadge value="RISK ENGINE REQUIRED" tone="info" />
    </div>
  </MobileRecordCard>
);

/* ------------------------------ RiskProfileCard ---------------------------- */

export const RiskProfileCard: React.FC<{
  profile: RiskProfile;
  usedBy?: number;
  onEdit?: () => void;
  onArchive?: () => void;
}> = ({ profile, usedBy = 0, onEdit, onArchive }) => (
  <article className="panel p-3">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <h3 className="truncate text-sm font-semibold">{profile.name}</h3>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{profile.description}</p>
      </div>
      <StatusBadge value={profile.status} />
    </div>

    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
      <Field label="Risk / setup" value={`${profile.risk_per_setup}%`} mono />
      <Field label="Risk / hedge" value={`${profile.risk_per_hedge}%`} mono />
      <Field label="Max daily loss" value={`${profile.max_daily_loss}%`} mono />
      <Field label="Max hedge tiers" value={String(profile.max_hedge_tiers)} mono />
      <Field label="Weekly DD cap" value={`${profile.max_weekly_drawdown}%`} mono />
      <Field label="Monthly DD cap" value={`${profile.max_monthly_drawdown}%`} mono />
      <Field label="Max positions" value={String(profile.max_open_positions)} mono />
      <Field label="Margin cap" value={`${profile.max_margin_utilization}%`} mono />
      <Field label="Total exposure" value={`${profile.max_total_exposure}%`} mono />
      <Field label="Correlated cap" value={`${profile.max_correlated_exposure}%`} mono />
      <Field label="News mode" value={profile.news_mode} />
      <Field label="Used by" value={`${usedBy} account(s)`} mono />
    </dl>

    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2.5">
      <StatusBadge value="CONFIGURATION ONLY" tone="info" />
      <StatusBadge value="ENGINE: PHASE 2" tone="draft" />
      <div className="ml-auto flex gap-1.5">
        {onEdit && (
          <button type="button" onClick={onEdit} className="rounded-md border border-border px-2.5 py-1 text-[11px] font-semibold transition-colors hover:border-primary/50 hover:text-primary">
            Edit
          </button>
        )}
        {onArchive && profile.status !== 'ARCHIVED' && (
          <button type="button" onClick={onArchive} className="rounded-md border border-border px-2.5 py-1 text-[11px] font-semibold text-amber-300 transition-colors hover:border-amber-500/50">
            Archive
          </button>
        )}
      </div>
    </div>
  </article>
);

/* ----------------------------- TradeSequenceCard --------------------------- */

export const TradeSequenceCard: React.FC<{
  sequence: TradeSequence;
  symbol?: TradingSymbol;
  accountName?: string;
  onClick?: () => void;
}> = ({ sequence, symbol, accountName, onClick }) => (
  <MobileRecordCard
    onClick={onClick}
    accent={sequence.direction === 'BUY' ? 'buy' : 'sell'}
    title={
      <span className="flex items-center gap-2">
        <span className="num">{symbol?.broker_symbol ?? 'Symbol'}</span>
        <span className={cn('text-[11px] font-bold', sequence.direction === 'BUY' ? 'text-emerald-400' : 'text-rose-400')}>
          {sequence.direction}
        </span>
      </span>
    }
    meta={`${sequence.reference ?? sequence.id.slice(0, 8)} · ${accountName ?? 'Account'} · ${relTime(sequence.opened_at)}`}
    badge={<StatusBadge value={sequence.state} />}
  >
    <div className="grid grid-cols-3 gap-2">
      <Field label="Hedge tier" value={String(sequence.current_hedge_tier)} mono />
      <Field label="Exposure" value={money(sequence.current_exposure)} mono />
      <Field
        label={sequence.state === 'CLOSED' ? 'Realised' : 'Floating'}
        value={
          <span className={pnlTone(sequence.state === 'CLOSED' ? sequence.realized_pnl : sequence.floating_pnl)}>
            {signedMoney(sequence.state === 'CLOSED' ? sequence.realized_pnl : sequence.floating_pnl)}
          </span>
        }
        mono
      />
    </div>
    <div className="mt-2"><SimBadge /></div>
  </MobileRecordCard>
);

/* -------------------------------- TradeLegCard ----------------------------- */

export const TradeLegCard: React.FC<{ trade: Trade; symbol?: TradingSymbol; accountName?: string }> = ({
  trade, symbol, accountName,
}) => (
  <article className={cn('panel relative overflow-hidden p-3')}>
    <span className={cn('absolute inset-y-0 left-0 w-0.5', trade.side === 'BUY' ? 'bg-emerald-500' : 'bg-rose-500')} />
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold">
          {trade.side === 'BUY'
            ? <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            : <ArrowDownRight className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />}
          <span className="num">{symbol?.broker_symbol ?? '—'}</span>
          <span className="text-muted-foreground">·</span>
          <span className="num">{lots(trade.volume)} lots</span>
        </h4>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {accountName ? `${accountName} · ` : ''}{trade.client_order_id ?? 'no client id'}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <StatusBadge value={trade.trade_role} tone={trade.trade_role === 'HEDGE' ? 'warn' : 'info'} />
        <StatusBadge value={trade.status} />
      </div>
    </div>

    <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Field label="Entry" value={price(trade.entry_price, symbol)} mono />
      <Field label="Stop" value={price(trade.stop_loss, symbol)} mono />
      <Field label="Target" value={price(trade.take_profit, symbol)} mono />
      <Field label="Exit" value={price(trade.exit_price, symbol)} mono />
      <Field label="Tier" value={String(trade.hedge_tier)} mono />
      <Field label="Risk" value={money(trade.risk_amount)} mono />
      <Field
        label="Realised"
        value={<span className={pnlTone(trade.realized_pnl)}>{signedMoney(trade.realized_pnl)}</span>}
        mono
      />
      <Field
        label="Floating"
        value={<span className={pnlTone(trade.floating_pnl)}>{signedMoney(trade.floating_pnl)}</span>}
        mono
      />
    </div>

    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2">
      <StatusBadge value={`EXEC ${trade.execution_status}`} tone={trade.execution_status === 'PAPER' ? 'info' : 'neutral'} />
      <span className="text-[10px] text-muted-foreground">Broker ticket: {trade.broker_ticket ?? 'none — no order was ever routed'}</span>
    </div>
  </article>
);

/* ------------------------------ HedgeStatusCard ---------------------------- */

export const HedgeStatusCard: React.FC<{ hedge: HedgeRecord; sequenceRef?: string; onClick?: () => void }> = ({
  hedge, sequenceRef, onClick,
}) => (
  <MobileRecordCard
    onClick={onClick}
    title={<span className="flex items-center gap-1.5"><Layers className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />Tier {hedge.hedge_tier} hedge</span>}
    meta={`${sequenceRef ?? hedge.sequence_id.slice(0, 8)} · ${relTime(hedge.opened_at ?? hedge.created_at)}`}
    badge={<StatusBadge value={hedge.hedge_status} />}
  >
    <p className="text-[11px] leading-relaxed text-muted-foreground">
      <span className="font-semibold text-foreground">Trigger:</span> {hedge.trigger_reason}
    </p>
    <div className="mt-2 grid grid-cols-3 gap-2">
      <Field label="Direction" value={<span className={hedge.hedge_direction === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}>{hedge.hedge_direction}</span>} />
      <Field label="Volume" value={lots(hedge.hedge_volume)} mono />
      <Field label="Realised" value={<span className={pnlTone(hedge.realized_pnl)}>{signedMoney(hedge.realized_pnl)}</span>} mono />
    </div>
  </MobileRecordCard>
);

/* --------------------------------- SignalCard ------------------------------ */

export const SignalCard: React.FC<{
  signal: Signal;
  symbol?: TradingSymbol;
  onApprove?: () => void;
  onReject?: () => void;
  canAct?: boolean;
}> = ({ signal, symbol, onApprove, onReject, canAct }) => (
  <article className="panel p-3">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Radio className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          <span className="num">{symbol?.broker_symbol ?? 'No symbol'}</span>
          {signal.direction && (
            <span className={cn('text-[11px] font-bold', signal.direction === 'BUY' ? 'text-emerald-400' : 'text-rose-400')}>
              {signal.direction}
            </span>
          )}
        </h3>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {signal.source_type} · {signal.source_name ?? 'unknown source'} · {relTime(signal.received_at)}
        </p>
      </div>
      <StatusBadge value={signal.validation_status} />
    </div>

    <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Field label="Entry" value={price(signal.entry_price, symbol)} mono />
      <Field label="Stop" value={price(signal.stop_loss, symbol)} mono />
      <Field label="Target" value={price(signal.take_profit, symbol)} mono />
      <Field label="Timeframe" value={signal.timeframe ?? '—'} mono />
    </div>

    {signal.notes && <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{signal.notes}</p>}

    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2">
      <StatusBadge value={`REF ${signal.provider_reference ?? '—'}`} tone="neutral" />
      {canAct && signal.validation_status === 'PENDING' && (
        <div className="ml-auto flex gap-1.5">
          <button type="button" onClick={onReject} className="rounded-md border border-rose-500/40 px-2.5 py-1 text-[11px] font-semibold text-rose-300 transition-colors hover:bg-rose-500/10">
            Reject
          </button>
          <button type="button" onClick={onApprove} className="rounded-md border border-emerald-500/40 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/10">
            Approve
          </button>
        </div>
      )}
    </div>
  </article>
);

/* ------------------------------ PaperPositionCard -------------------------- */

export const PaperPositionCard: React.FC<{
  position: PaperPosition;
  symbol?: TradingSymbol;
  onUpdatePrice?: () => void;
  onHedge?: () => void;
  onClose?: () => void;
  canAct?: boolean;
}> = ({ position, symbol, onUpdatePrice, onHedge, onClose, canAct }) => {
  const pnl = position.status === 'CLOSED' ? position.realized_pnl : position.unrealized_pnl;
  return (
    <article className={cn('panel relative overflow-hidden p-3')}>
      <span className={cn('absolute inset-y-0 left-0 w-0.5', position.side === 'BUY' ? 'bg-emerald-500' : 'bg-rose-500')} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <Wallet className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            <span className="num">{symbol?.broker_symbol ?? '—'}</span>
            <span className={cn('text-[11px] font-bold', position.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400')}>
              {position.side}
            </span>
            <span className="num text-[11px] text-muted-foreground">{lots(position.volume)} lots</span>
          </h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {position.position_role} · tier {position.hedge_tier} · opened {relTime(position.opened_at)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge value={position.status} />
          <SimBadge label="SIMULATED" />
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="Entry" value={price(position.entry_price, symbol)} mono />
        <Field label="Sim price" value={price(position.current_price, symbol)} mono />
        <Field label="Stop" value={price(position.stop_loss, symbol)} mono />
        <Field
          label={position.status === 'CLOSED' ? 'Sim realised' : 'Sim floating'}
          value={<span className={cn('font-semibold', pnlTone(pnl))}>{signedMoney(pnl)}</span>}
          mono
        />
      </div>

      {canAct && position.status === 'OPEN' && (
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <button type="button" onClick={onUpdatePrice} className="h-9 rounded-md border border-border text-[11px] font-semibold transition-colors hover:border-primary/50 hover:text-primary">
            Set price
          </button>
          <button
            type="button"
            onClick={onHedge}
            disabled={position.position_role !== 'PRIMARY'}
            className="h-9 rounded-md border border-amber-500/40 text-[11px] font-semibold text-amber-300 transition-colors hover:bg-amber-500/10 disabled:opacity-35"
          >
            Add hedge
          </button>
          <button type="button" onClick={onClose} className="h-9 rounded-md border border-border text-[11px] font-semibold transition-colors hover:border-rose-500/50 hover:text-rose-300">
            Close
          </button>
        </div>
      )}
    </article>
  );
};

/* --------------------------------- EventFeed ------------------------------- */

const SEVERITY_ICON = { INFO: Activity, SUCCESS: Activity, WARNING: ShieldAlert, ERROR: ShieldAlert, CRITICAL: ShieldAlert };

export const EventFeed: React.FC<{ events: SystemEvent[]; compact?: boolean }> = ({ events, compact }) => (
  <ol className="space-y-2">
    {events.map((e) => {
      const Icon = SEVERITY_ICON[e.severity] ?? Activity;
      return (
        <li key={e.id} className="flex gap-2.5 rounded-lg border border-border/70 bg-secondary/20 p-2.5">
          <Icon
            className={cn(
              'mt-0.5 h-3.5 w-3.5 shrink-0',
              e.severity === 'SUCCESS' && 'text-emerald-400',
              e.severity === 'WARNING' && 'text-amber-400',
              (e.severity === 'ERROR' || e.severity === 'CRITICAL') && 'text-rose-400',
              e.severity === 'INFO' && 'text-sky-400',
            )}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] leading-snug">{e.message}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] uppercase tracking-wide text-muted-foreground">
              <span className="font-semibold">{e.event_type.replace(/_/g, ' ')}</span>
              <span>{compact ? relTime(e.created_at) : dateTime(e.created_at)}</span>
            </p>
          </div>
        </li>
      );
    })}
  </ol>
);

/* -------------------------------- JsonRulesCard ---------------------------- */

function renderValue(value: unknown): React.ReactNode {
  if (Array.isArray(value)) {
    return (
      <ul className="mt-1 space-y-1">
        {value.map((v, i) => (
          <li key={i} className="flex gap-1.5 text-[12px] leading-snug text-foreground/90">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
            <span>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (value && typeof value === 'object') {
    return <pre className="num mt-1 overflow-x-auto rounded bg-secondary/50 p-2 text-[10px]">{JSON.stringify(value, null, 2)}</pre>;
  }
  if (typeof value === 'boolean') return <StatusBadge value={value ? 'YES' : 'NO'} tone={value ? 'good' : 'neutral'} />;
  return <span className="text-[12px] text-foreground/90">{String(value)}</span>;
}

export const JsonRulesCard: React.FC<{
  title: string;
  rules: Record<string, unknown>;
  emptyHint?: string;
  onEditJson?: () => void;
}> = ({ title, rules, emptyHint = 'No rules defined yet.', onEditJson }) => {
  const [showRaw, setShowRaw] = React.useState(false);
  const entries = Object.entries(rules ?? {});
  return (
    <article className="panel p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="label-caps flex items-center gap-1.5 !text-[11px] !text-foreground">
          <Braces className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          {title}
        </h3>
        <div className="flex items-center gap-1.5">
          {onEditJson && (
            <button type="button" onClick={onEditJson} className="rounded border border-border px-2 py-0.5 text-[10px] font-semibold transition-colors hover:border-primary/50 hover:text-primary">
              Edit JSON
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowRaw((s) => !s)}
            className="flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[10px] font-semibold transition-colors hover:border-primary/50 hover:text-primary"
          >
            <Copy className="h-2.5 w-2.5" aria-hidden="true" />
            {showRaw ? 'Readable' : 'Raw'}
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="mt-2 text-[11px] text-muted-foreground">{emptyHint}</p>
      ) : showRaw ? (
        <pre className="num mt-2 max-h-64 overflow-auto rounded bg-secondary/50 p-2 text-[10px] leading-relaxed">
          {JSON.stringify(rules, null, 2)}
        </pre>
      ) : (
        <dl className="mt-2 space-y-2.5">
          {entries.map(([k, v]) => (
            <div key={k}>
              <dt className="label-caps">{humanise(k)}</dt>
              <dd>{renderValue(v)}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
};
