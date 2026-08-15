import React, { useMemo, useState } from 'react';
import { Layers, Receipt } from 'lucide-react';
import { usePlatform, useLookups } from '@/contexts/PlatformContext';
import { useNav } from '@/contexts/NavContext';
import { EmptyState, NoticeBanner, PageHeader } from '@/components/shared/Primitives';
import { FilterBar, LoadingRows } from '@/components/shared/Controls';
import { HedgeStatusCard, TradeLegCard } from '@/components/shared/RecordCards';
import { TRADE_ROLES, TRADE_STATUSES } from '@/lib/types';

export const TradesPage: React.FC = () => {
  const { data, dataLoading } = usePlatform();
  const { symbolById, accountById } = useLookups();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [role, setRole] = useState('ALL');
  const [symbolFilter, setSymbolFilter] = useState('ALL');

  const filtered = useMemo(() => data.trades.filter((t) => {
    const sym = symbolById.get(t.symbol_id)?.broker_symbol ?? '';
    const acc = accountById.get(t.account_id)?.name ?? '';
    const q = search.toLowerCase();
    const matches = !q || sym.toLowerCase().includes(q) || acc.toLowerCase().includes(q)
      || (t.client_order_id ?? '').toLowerCase().includes(q);
    return matches && (status === 'ALL' || t.status === status) && (role === 'ALL' || t.trade_role === role)
      && (symbolFilter === 'ALL' || sym === symbolFilter);
  }), [data.trades, search, status, role, symbolFilter, symbolById, accountById]);

  return (
    <div>
      <PageHeader
        title="Trades"
        subtitle="Every trade leg recorded by the platform. All legs are PAPER records — no broker ticket exists for any of them."
      />

      <div className="mb-4">
        <NoticeBanner tone="warn" title="No broker tickets">
          Broker ticket, deal id and order id are permanently null in Phase 1 because no order was ever routed. They
          exist so Phase 5 reconciliation has somewhere honest to write.
        </NoticeBanner>
      </div>

      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: 'Search symbol, account, order id…' }}
        filters={[
          { id: 'status', label: 'Status', options: [...TRADE_STATUSES], value: status, onChange: setStatus },
          { id: 'role', label: 'Role', options: [...TRADE_ROLES], value: role, onChange: setRole },
          { id: 'symbol', label: 'Symbol', options: data.symbols.map((s) => s.broker_symbol), value: symbolFilter, onChange: setSymbolFilter },
        ]}
      />

      {dataLoading ? <LoadingRows /> : filtered.length === 0 ? (
        <EmptyState icon={Receipt} title="No trades match" description="Open a simulated position from the paper simulator to create trade legs." />
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => (
            <TradeLegCard key={t.id} trade={t} symbol={symbolById.get(t.symbol_id)} accountName={accountById.get(t.account_id)?.name} />
          ))}
        </div>
      )}
    </div>
  );
};

export const HedgeRecordsPage: React.FC = () => {
  const { data, dataLoading } = usePlatform();
  const { sequenceById } = useLookups();
  const { navigate } = useNav();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [tier, setTier] = useState('ALL');

  const filtered = useMemo(() => data.hedges.filter((h) => {
    const q = search.toLowerCase();
    const ref = sequenceById.get(h.sequence_id)?.reference ?? '';
    const matches = !q || h.trigger_reason.toLowerCase().includes(q) || ref.toLowerCase().includes(q);
    return matches && (status === 'ALL' || h.hedge_status === status) && (tier === 'ALL' || String(h.hedge_tier) === tier);
  }), [data.hedges, search, status, tier, sequenceById]);

  return (
    <div>
      <PageHeader
        title="Hedge Records"
        subtitle="Structural hedge legs and the reason each one was triggered. Every record here was created by a manual paper action."
      />

      <div className="mb-4">
        <NoticeBanner title="Bounded by design">
          Hedge tiers are capped by the account's risk profile. There is no automatic hedging, no doubling and no
          unlimited recovery ladder anywhere in this platform.
        </NoticeBanner>
      </div>

      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: 'Search trigger reason or sequence…' }}
        filters={[
          { id: 'status', label: 'Status', options: ['PLANNED', 'ACTIVE', 'REDUCED', 'CLOSED', 'CANCELLED'], value: status, onChange: setStatus },
          { id: 'tier', label: 'Tier', options: ['1', '2', '3', '4', '5'], value: tier, onChange: setTier },
        ]}
      />

      {dataLoading ? <LoadingRows /> : filtered.length === 0 ? (
        <EmptyState icon={Layers} title="No hedge records match" description="Add a simulated hedge from the paper simulator to create one." />
      ) : (
        <div className="space-y-2">
          {filtered.map((h) => (
            <HedgeStatusCard
              key={h.id}
              hedge={h}
              sequenceRef={sequenceById.get(h.sequence_id)?.reference ?? undefined}
              onClick={() => navigate('trade-sequence-detail', h.sequence_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
