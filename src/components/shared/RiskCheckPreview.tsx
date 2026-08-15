import React from 'react';
import {
  CheckCircle2, CircleSlash, Gauge, ShieldAlert, XCircle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { money } from '@/lib/format';
import { NoticeBanner, SectionCard, StatusBadge } from '@/components/shared/Primitives';
import type { Direction, PaperPosition, RiskProfile, Symbol as TradingSymbol } from '@/lib/types';
import type { PreviewVerdict, RiskCheckRow, RiskPreviewResult } from '@/services/riskPreview';

export interface RiskPreviewDraft {
  symbol_id: string;
  side: Direction;
  volume: string;
  entry_price: string;
  stop_loss: string;
  /** '' = primary entry, otherwise the id of the open position being hedged. */
  hedge_of: string;
}

const VERDICT_META: Record<PreviewVerdict, { label: string; tone: 'good' | 'bad' | 'neutral'; icon: typeof CheckCircle2; bar: string; ring: string }> = {
  PASS: {
    label: 'WOULD PASS', tone: 'good', icon: CheckCircle2,
    bar: 'bg-emerald-400', ring: 'border-emerald-500/25 bg-emerald-500/[0.04]',
  },
  FAIL: {
    label: 'WOULD FAIL', tone: 'bad', icon: XCircle,
    bar: 'bg-rose-400', ring: 'border-rose-500/35 bg-rose-500/[0.06]',
  },
  NOT_MEASURABLE: {
    label: 'NOT MEASURABLE', tone: 'neutral', icon: CircleSlash,
    bar: 'bg-slate-500', ring: 'border-border/70 bg-secondary/20',
  },
};

/* --------------------------------- one row -------------------------------- */

const CheckRow: React.FC<{ row: RiskCheckRow }> = ({ row }) => {
  const meta = VERDICT_META[row.verdict];
  const Icon = meta.icon;
  const fill = row.usage === null ? 0 : Math.max(0, Math.min(row.usage, 1)) * 100;
  const over = row.usage !== null && row.usage > 1;

  return (
    <li className={cn('rounded-lg border p-3 transition-colors', meta.ring)}>
      <div className="flex items-start justify-between gap-2">
        <h4 className="flex min-w-0 items-center gap-1.5 text-[12px] font-semibold">
          <Icon
            className={cn(
              'h-3.5 w-3.5 shrink-0',
              row.verdict === 'PASS' && 'text-emerald-400',
              row.verdict === 'FAIL' && 'text-rose-400',
              row.verdict === 'NOT_MEASURABLE' && 'text-muted-foreground',
            )}
            aria-hidden="true"
          />
          <span className="truncate">{row.label}</span>
        </h4>
        <StatusBadge value={meta.label} tone={meta.tone} />
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-2">
        <div className="min-w-0">
          <dt className="label-caps">Configured limit</dt>
          <dd className="num mt-0.5 truncate text-[12px] text-foreground/90">{row.limit}</dd>
        </div>
        <div className="min-w-0">
          <dt className="label-caps">This draft measures</dt>
          <dd
            className={cn(
              'num mt-0.5 truncate text-[12px]',
              row.verdict === 'FAIL' ? 'text-rose-300' : row.verdict === 'PASS' ? 'text-emerald-300' : 'text-muted-foreground',
            )}
          >
            {row.measured}
          </dd>
        </div>
      </dl>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary/60" aria-hidden="true">
        <div
          className={cn('h-full rounded-full transition-[width] duration-500 ease-out', meta.bar)}
          style={{ width: `${row.usage === null ? 0 : over ? 100 : fill}%` }}
        />
      </div>

      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{row.detail}</p>
    </li>
  );
};

/* -------------------------------- the panel ------------------------------- */

export const RiskCheckPreview: React.FC<{
  result: RiskPreviewResult;
  draft: RiskPreviewDraft;
  onDraftChange: (next: RiskPreviewDraft) => void;
  symbols: TradingSymbol[];
  openPositions: PaperPosition[];
  symbolFor: (symbolId: string) => TradingSymbol | null | undefined;
  riskProfile: RiskProfile | null;
  hedgeTierRequested: number;
}> = ({ result, draft, onDraftChange, symbols, openPositions, symbolFor, riskProfile, hedgeTierRequested }) => {
  const set = (patch: Partial<RiskPreviewDraft>) => onDraftChange({ ...draft, ...patch });
  const isHedge = draft.hedge_of !== '';

  return (
    <SectionCard
      title="Risk Check Preview"
      icon={Gauge}
      action={(
        <span className="inline-flex items-center gap-1 rounded border border-dashed border-sky-500/45 bg-sky-500/[0.07] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-sky-300">
          <ShieldAlert className="h-2.5 w-2.5" aria-hidden="true" />
          Preview · Phase 2
        </span>
      )}
      description="Read-only. Shows which stored risk-profile limits this draft would be measured against once the Phase 2 Risk Engine exists, and whether it would sit inside or outside each one."
    >
      <NoticeBanner title="This panel sizes nothing and approves nothing">
        The Risk Engine is <span className="font-semibold text-foreground/90">not built</span>. Nothing here suggests a
        lot size, adjusts your draft, or permits or refuses an action — it only measures the numbers you typed against
        configuration already stored on the assigned risk profile. The only limits actually enforced in Phase 1 remain
        the paper guard rails: max hedge tiers, symbol volume bounds and the paused flag.
      </NoticeBanner>

      {/* ------------------------------ draft inputs ----------------------------- */}
      <fieldset className="mt-3 rounded-lg border border-border/70 bg-secondary/20 p-3">
        <legend className="label-caps px-1">Draft position to measure</legend>
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="rcp-context" className="text-xs">Measure as</Label>
            <select
              id="rcp-context"
              value={draft.hedge_of}
              onChange={(e) => {
                const id = e.target.value;
                const target = openPositions.find((p) => p.id === id);
                set({
                  hedge_of: id,
                  ...(target
                    ? {
                      symbol_id: target.symbol_id,
                      side: (target.side === 'BUY' ? 'SELL' : 'BUY') as Direction,
                      entry_price: String(target.current_price),
                    }
                    : {}),
                });
              }}
              className="h-11 w-full rounded-md border border-input bg-background px-2 text-sm transition-colors hover:border-primary/50"
            >
              <option value="">Primary entry</option>
              {openPositions.map((p) => (
                <option key={p.id} value={p.id}>
                  Hedge of {symbolFor(p.symbol_id)?.broker_symbol ?? 'position'} {p.side} · tier {p.hedge_tier + 1}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rcp-symbol" className="text-xs">Symbol</Label>
            <select
              id="rcp-symbol"
              value={draft.symbol_id}
              disabled={isHedge}
              onChange={(e) => set({ symbol_id: e.target.value })}
              className="h-11 w-full rounded-md border border-input bg-background px-2 text-sm transition-colors hover:border-primary/50 disabled:opacity-60"
            >
              <option value="">Select…</option>
              {symbols.map((s) => <option key={s.id} value={s.id}>{s.broker_symbol}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rcp-side" className="text-xs">Side</Label>
            <select
              id="rcp-side"
              value={draft.side}
              disabled={isHedge}
              onChange={(e) => set({ side: e.target.value as Direction })}
              className="h-11 w-full rounded-md border border-input bg-background px-2 text-sm transition-colors hover:border-primary/50 disabled:opacity-60"
            >
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rcp-vol" className="text-xs">Volume (lots)</Label>
            <Input
              id="rcp-vol" type="number" step="0.01" min="0.01" inputMode="decimal"
              value={draft.volume} onChange={(e) => set({ volume: e.target.value })} className="num h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rcp-entry" className="text-xs">Entry price</Label>
            <Input
              id="rcp-entry" type="number" step="0.00001" inputMode="decimal"
              value={draft.entry_price} onChange={(e) => set({ entry_price: e.target.value })} className="num h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rcp-stop" className="text-xs">Stop loss</Label>
            <Input
              id="rcp-stop" type="number" step="0.00001" inputMode="decimal" placeholder="Required for risk %"
              value={draft.stop_loss} onChange={(e) => set({ stop_loss: e.target.value })} className="num h-11"
            />
          </div>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Editing this draft changes nothing on the account and writes nothing to the database. The same values prefill
          the <span className="font-semibold text-foreground/80">New simulated position</span> dialog, where you stay in
          full control of the volume.
        </p>
      </fieldset>

      {/* -------------------------------- verdicts ------------------------------- */}
      {!result.ready ? (
        <div className="mt-3 rounded-lg border border-dashed border-border px-4 py-8 text-center">
          <CircleSlash className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 text-[12px] font-semibold">Nothing to measure yet</p>
          <p className="mx-auto mt-1 max-w-md text-[11px] leading-relaxed text-muted-foreground">
            {result.blockedReason ?? 'Complete the draft above to preview the limits.'}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'Would pass', value: String(result.passCount), tone: 'text-emerald-400' },
              { label: 'Would fail', value: String(result.failCount), tone: result.failCount > 0 ? 'text-rose-400' : 'text-muted-foreground' },
              { label: 'Not measurable', value: String(result.unknownCount), tone: 'text-muted-foreground' },
              { label: 'Measured against', value: riskProfile?.name ?? '—', tone: 'text-foreground' },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-border/70 bg-secondary/20 p-2.5">
                <div className="label-caps truncate">{s.label}</div>
                <div className={cn('num mt-0.5 truncate text-base font-semibold', s.tone)}>{s.value}</div>
              </div>
            ))}
          </div>

          <div
            className={cn(
              'mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-3 py-2 text-[11px]',
              result.failCount > 0 ? 'border-rose-500/30 bg-rose-500/[0.05]' : 'border-emerald-500/25 bg-emerald-500/[0.04]',
            )}
          >
            <span className={cn('font-semibold uppercase tracking-wide', result.failCount > 0 ? 'text-rose-300' : 'text-emerald-300')}>
              {result.failCount > 0
                ? `${result.failCount} limit(s) would be breached`
                : 'Draft sits inside every measurable limit'}
            </span>
            <span className="num text-muted-foreground">Sim equity {money(result.equity)}</span>
            {result.riskAmount !== null && <span className="num text-muted-foreground">Loss at stop {money(result.riskAmount)}</span>}
            {result.notional !== null && <span className="num text-muted-foreground">Approx notional {money(result.notional)}</span>}
            {isHedge && <span className="num text-muted-foreground">Hedge tier {hedgeTierRequested}</span>}
          </div>

          <ul className="mt-3 grid gap-2 lg:grid-cols-2">
            {result.rows.map((row) => <CheckRow key={row.key} row={row} />)}
          </ul>

          {result.unmeasuredPositions > 0 && (
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              {result.unmeasuredPositions} open simulated leg(s) carry no stop loss, so their risk is excluded from the
              exposure figures above. The preview never estimates a stop it was not given.
            </p>
          )}

          <p className="mt-3 border-t border-border/70 pt-2.5 text-[11px] leading-relaxed text-muted-foreground">
            Verdicts are informational arithmetic over stored configuration, not a decision. A
            <span className="font-semibold text-rose-300"> WOULD FAIL </span>
            row does not stop you simulating the position today, and a
            <span className="font-semibold text-emerald-300"> WOULD PASS </span>
            row is not an approval. When the Phase 2 Risk Engine is built it becomes the single authority for sizing and
            approval, and no dashboard control, strategy field or growth-journey value may override it.
          </p>
        </>
      )}
    </SectionCard>
  );
};

export default RiskCheckPreview;
