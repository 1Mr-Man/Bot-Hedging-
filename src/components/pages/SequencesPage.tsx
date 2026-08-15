import React, { useMemo, useState } from 'react';
import { ArrowLeft, CircleDot, Layers, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePlatform, useLookups } from '@/contexts/PlatformContext';
import { useNav } from '@/contexts/NavContext';
import { EmptyState, Field, NoticeBanner, PageHeader, SectionCard, SimBadge, StatusBadge } from '@/components/shared/Primitives';
import { FilterBar, LoadingRows } from '@/components/shared/Controls';
import { EventFeed, HedgeStatusCard, TradeLegCard, TradeSequenceCard } from '@/components/shared/RecordCards';
import { SEQUENCE_STATES } from '@/lib/types';
import { dateTime, money, pnlTone, signedMoney } from '@/lib/format';

export const TradeSequencesPage: React.FC = () => {
  const { data, dataLoading } = usePlatform();
  const { navigate } = useNav();
  const { symbolById, accountById } = useLookups();
  const [search, setSearch] = useState('');
  const [state, setState] = useState('ALL');
  const [accountFilter, setAccountFilter] = useState('ALL');
  const [symbolFilter, setSymbolFilter] = useState('ALL');

  const filtered = useMemo(() => data.sequences.filter((s) => {
    const sym = symbolById.get(s.symbol_id)?.broker_symbol ?? '';
    const acc = accountById.get(s.account_id)?.name ?? '';
    const q = search.toLowerCase();
    const matches = !q || (s.reference ?? '').toLowerCase().includes(q) || sym.toLowerCase().includes(q) || acc.toLowerCase().includes(q);
    return matches && (state === 'ALL' || s.state === state) && (accountFilter === 'ALL' || acc === accountFilter)
      && (symbolFilter === 'ALL' || sym === symbolFilter);
  }), [data.sequences, search, state, accountFilter, symbolFilter, symbolById, accountById]);

  return (
    <div>
      <PageHeader
        title="Trade Sequences"
        subtitle="Each sequence is one full lifecycle: primary trade, any hedge legs, re-entries and the final resolution."
      />

      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: 'Search reference, symbol, account…' }}
        filters={[
          { id: 'state', label: 'State', options: [...SEQUENCE_STATES], value: state, onChange: setState },
          { id: 'account', label: 'Account', options: data.accounts.map((a) => a.name), value: accountFilter, onChange: setAccountFilter },
          { id: 'symbol', label: 'Symbol', options: data.symbols.map((s) => s.broker_symbol), value: symbolFilter, onChange: setSymbolFilter },
        ]}
      />

      {dataLoading ? <LoadingRows /> : filtered.length === 0 ? (
        <EmptyState icon={Layers} title="No sequences match" description="Open a simulated position in the paper simulator to create one." />
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
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
    </div>
  );
};

/* ----------------------------- Sequence detail ----------------------------- */

interface FlowStep {
  key: string;
  label: string;
  detail: string;
  state: 'done' | 'active' | 'pending';
}

function buildFlow(
  hasPrimary: boolean, adverse: boolean, hasHedge: boolean, hedgeActive: boolean, closed: boolean,
): FlowStep[] {
  return [
    { key: 'primary', label: 'PRIMARY', detail: hasPrimary ? 'Primary leg recorded' : 'No primary leg yet', state: hasPrimary ? 'done' : 'pending' },
    { key: 'adverse', label: 'ADVERSE MOVE', detail: adverse ? 'Simulated price moved against the primary' : 'Primary not in adverse territory', state: adverse ? 'done' : 'pending' },
    { key: 'invalidation', label: 'STRUCTURE INVALIDATION', detail: hasHedge ? 'Invalidation confirmed — hedge authorised' : 'No invalidation recorded', state: hasHedge ? 'done' : 'pending' },
    { key: 'hedge', label: 'HEDGE', detail: hasHedge ? 'Opposing leg recorded within the tier limit' : 'No hedge leg', state: hasHedge ? 'done' : 'pending' },
    { key: 'monitor', label: 'MONITOR', detail: hedgeActive ? 'Hedge active — sequence under observation' : closed ? 'Monitoring complete' : 'Not monitoring', state: hedgeActive ? 'active' : closed ? 'done' : 'pending' },
    { key: 'resolution', label: 'RESOLUTION', detail: closed ? 'Sequence resolved and closed' : 'Sequence still open', state: closed ? 'done' : 'pending' },
  ];
}

export const TradeSequenceDetailPage: React.FC<{ sequenceId?: string }> = ({ sequenceId }) => {
  const { data } = usePlatform();
  const { navigate, back } = useNav();
  const { symbolById, accountById, strategyById } = useLookups();

  const sequence = data.sequences.find((s) => s.id === sequenceId);
  if (!sequence) {
    return <EmptyState icon={Layers} title="Sequence not found" action={<Button onClick={() => navigate('trade-sequences')} className="h-10">Back to sequences</Button>} />;
  }

  const symbol = symbolById.get(sequence.symbol_id);
  const trades = data.trades.filter((t) => t.sequence_id === sequence.id);
  const hedges = data.hedges.filter((h) => h.sequence_id === sequence.id);
  const positions = data.paperPositions.filter((p) => p.sequence_id === sequence.id);
  const primary = trades.find((t) => t.trade_role === 'PRIMARY');
  const hedgeLegs = trades.filter((t) => t.trade_role === 'HEDGE');
  const closed = sequence.state === 'CLOSED';
  const adverse = Number(sequence.floating_pnl) < 0 || hedges.length > 0 || closed;
  const flow = buildFlow(!!primary, adverse, hedges.length > 0, hedges.some((h) => h.hedge_status === 'ACTIVE'), closed);
  const events = data.events.filter((e) => e.account_id === sequence.account_id).slice(0, 8);

  return (
    <div className="space-y-4">
      <button type="button" onClick={back} className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-primary">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back
      </button>

      <PageHeader
        title={sequence.reference ?? `Sequence ${sequence.id.slice(0, 8)}`}
        subtitle={`${symbol?.broker_symbol ?? 'Symbol'} · ${sequence.direction} · ${accountById.get(sequence.account_id)?.name ?? 'Account'}`}
        action={<StatusBadge value={sequence.state} />}
      />

      <SectionCard title="Sequence Summary" icon={Layers} action={<SimBadge />}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Symbol" value={symbol?.broker_symbol ?? '—'} mono />
          <Field label="Strategy" value={sequence.strategy_id ? strategyById.get(sequence.strategy_id)?.name ?? '—' : 'None'} />
          <Field label="Direction" value={<span className={sequence.direction === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}>{sequence.direction}</span>} />
          <Field label="State" value={<StatusBadge value={sequence.state} />} />
          <Field label="Hedge tier" value={String(sequence.current_hedge_tier)} mono />
          <Field label="Exposure" value={money(sequence.current_exposure)} mono />
          <Field label="Initial risk" value={money(sequence.initial_risk)} mono />
          <Field label="Max exposure" value={money(sequence.max_sequence_exposure ?? 0)} mono />
          <Field label="Realised" value={<span className={pnlTone(sequence.realized_pnl)}>{signedMoney(sequence.realized_pnl)}</span>} mono />
          <Field label="Floating" value={<span className={pnlTone(sequence.floating_pnl)}>{signedMoney(sequence.floating_pnl)}</span>} mono />
          <Field label="Opened" value={dateTime(sequence.opened_at)} />
          <Field label="Closed" value={sequence.closed_at ? dateTime(sequence.closed_at) : 'Open'} />
        </div>
        {sequence.notes && (
          <p className="mt-3 rounded-md border border-border/70 bg-secondary/20 p-2.5 text-[11px] leading-relaxed text-muted-foreground">{sequence.notes}</p>
        )}
      </SectionCard>

      {/* ------------------------------ VERTICAL FLOW ------------------------------ */}
      <SectionCard title="Sequence Flow" icon={CircleDot} description="Primary → adverse move → structure invalidation → hedge → monitor → resolution">
        <ol className="relative space-y-0 pl-6">
          <span className="absolute left-[7px] top-2 bottom-2 w-px bg-border" aria-hidden="true" />
          {flow.map((step) => (
            <li key={step.key} className="relative pb-4 last:pb-0">
              <span
                className={`absolute -left-[22px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                  step.state === 'done'
                    ? 'border-emerald-500 bg-emerald-500/25'
                    : step.state === 'active'
                      ? 'border-amber-400 bg-amber-400/25 animate-dot'
                      : 'border-border bg-background'
                }`}
                aria-hidden="true"
              />
              <p className={`text-[11px] font-bold uppercase tracking-wider ${
                step.state === 'done' ? 'text-emerald-300' : step.state === 'active' ? 'text-amber-300' : 'text-muted-foreground'
              }`}>
                {step.label}
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{step.detail}</p>
            </li>
          ))}
        </ol>
      </SectionCard>

      <SectionCard title={`Primary Trade`} icon={Layers}>
        {primary ? (
          <TradeLegCard trade={primary} symbol={symbol} />
        ) : (
          <EmptyState icon={Layers} title="No primary leg recorded" />
        )}
      </SectionCard>

      <SectionCard title={`Hedge Legs (${hedgeLegs.length})`} icon={ShieldAlert}>
        {hedgeLegs.length === 0 ? (
          <EmptyState icon={ShieldAlert} title="No hedge legs" description="This sequence has never been hedged." />
        ) : (
          <div className="space-y-2">
            {hedgeLegs.map((t) => <TradeLegCard key={t.id} trade={t} symbol={symbol} />)}
          </div>
        )}
      </SectionCard>

      {hedges.length > 0 && (
        <SectionCard title="Hedge Records" icon={ShieldAlert}>
          <div className="space-y-2">
            {hedges.map((h) => <HedgeStatusCard key={h.id} hedge={h} sequenceRef={sequence.reference ?? undefined} />)}
          </div>
        </SectionCard>
      )}

      <SectionCard title={`Simulated Positions (${positions.length})`} icon={CircleDot} action={<SimBadge />}>
        {positions.length === 0 ? (
          <EmptyState icon={CircleDot} title="No paper positions linked" />
        ) : (
          <ul className="space-y-2">
            {positions.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-secondary/20 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold">
                    <span className={p.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}>{p.side}</span>{' '}
                    <span className="num">{Number(p.volume).toFixed(2)}</span> lots · {p.position_role}
                  </p>
                  <p className="num text-[10px] text-muted-foreground">
                    entry {Number(p.entry_price).toFixed(symbol?.digits ?? 5)} · sim price {Number(p.current_price).toFixed(symbol?.digits ?? 5)}
                  </p>
                </div>
                <span className={`num text-[12px] font-semibold ${pnlTone(p.status === 'CLOSED' ? p.realized_pnl : p.unrealized_pnl)}`}>
                  {signedMoney(p.status === 'CLOSED' ? p.realized_pnl : p.unrealized_pnl)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Event History" icon={CircleDot}>
        {events.length === 0 ? <EmptyState icon={CircleDot} title="No events for this account" /> : <EventFeed events={events} compact />}
      </SectionCard>

      <NoticeBanner tone="warn" title="Simulated record">
        This sequence was produced by the paper simulator or seeded as clearly-marked demo data. It is not a
        historical broker result and no order was ever routed.
      </NoticeBanner>
    </div>
  );
};
