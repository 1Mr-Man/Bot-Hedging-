import React, { useMemo, useState } from 'react';
import { Cable, HeartPulse, Pause, Play, Plus, TerminalSquare, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { usePlatform, useLookups } from '@/contexts/PlatformContext';
import { useNav } from '@/contexts/NavContext';
import {
  EmptyState, Field, NoticeBanner, PageHeader, SectionCard, SimBadge, StatCard, StatusBadge,
} from '@/components/shared/Primitives';
import { LoadingRows } from '@/components/shared/Controls';
import { PaperPositionCard } from '@/components/shared/RecordCards';
import { RiskCheckPreview, type RiskPreviewDraft } from '@/components/shared/RiskCheckPreview';
import { money, pnlTone, relTime, signedMoney } from '@/lib/format';
import type { Direction, PaperPosition } from '@/lib/types';
import { evaluateRiskPreview } from '@/services/riskPreview';
import {
  closePaperPosition, createPaperAccount, openPaperHedge, openPaperPrimary,
  setPaperTradingEnabled, updateSimulatedPrice,
} from '@/services/paperTradingService';


const PaperTradingPage: React.FC = () => {
  const { data, dataLoading, refresh, canWrite } = usePlatform();
  const { navigate } = useNav();
  const { symbolById, accountById, riskProfileById } = useLookups();

  const [selectedPaperId, setSelectedPaperId] = useState<string>('');
  const [primaryOpen, setPrimaryOpen] = useState(false);
  const [hedgeTarget, setHedgeTarget] = useState<PaperPosition | null>(null);
  const [priceTarget, setPriceTarget] = useState<PaperPosition | null>(null);
  const [closeTarget, setCloseTarget] = useState<PaperPosition | null>(null);
  const [newPaperOpen, setNewPaperOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const paperAccounts = data.paperAccounts;
  const selected = useMemo(
    () => paperAccounts.find((p) => p.id === selectedPaperId) ?? paperAccounts[0] ?? null,
    [paperAccounts, selectedPaperId],
  );
  const tradingAccount = selected ? accountById.get(selected.trading_account_id) ?? null : null;
  const riskProfile = tradingAccount?.risk_profile_id ? riskProfileById.get(tradingAccount.risk_profile_id) ?? null : null;
  const positions = useMemo(
    () => (selected ? data.paperPositions.filter((p) => p.paper_account_id === selected.id) : []),
    [data.paperPositions, selected],
  );
  const openPositions = positions.filter((p) => p.status === 'OPEN');
  const closedPositions = positions.filter((p) => p.status === 'CLOSED');
  const accountsWithoutPaper = data.accounts.filter(
    (a) => a.status !== 'ARCHIVED' && !paperAccounts.some((p) => p.trading_account_id === a.id),
  );

  /* --------------------- risk check preview (read-only, Phase 2) -------------------- */
  const [riskDraft, setRiskDraft] = useState<RiskPreviewDraft>({
    symbol_id: '', side: 'BUY', volume: '0.10', entry_price: '', stop_loss: '', hedge_of: '',
  });

  const hedgeSource = riskDraft.hedge_of
    ? openPositions.find((p) => p.id === riskDraft.hedge_of) ?? null
    : null;
  const draftSymbolId = hedgeSource?.symbol_id || riskDraft.symbol_id || data.symbols[0]?.id || '';
  const hedgeTierRequested = hedgeSource ? hedgeSource.hedge_tier + 1 : 0;

  const riskPreview = useMemo(() => evaluateRiskPreview({
    riskProfile,
    tradingAccount,
    paperAccount: selected,
    symbol: symbolById.get(draftSymbolId),
    side: hedgeSource ? (hedgeSource.side === 'BUY' ? 'SELL' : 'BUY') : riskDraft.side,
    volume: Number(riskDraft.volume),
    entryPrice: Number(riskDraft.entry_price || hedgeSource?.current_price || 0),
    stopLoss: riskDraft.stop_loss ? Number(riskDraft.stop_loss) : null,
    isHedge: !!hedgeSource,
    requestedTier: hedgeTierRequested,
    openPositions,
    symbolFor: (id: string) => symbolById.get(id),
  }), [riskProfile, tradingAccount, selected, symbolById, draftSymbolId, hedgeSource, hedgeTierRequested, riskDraft, openPositions]);


  /* ------------------------------- primary form ------------------------------ */
  const [pForm, setPForm] = useState({
    symbol_id: '', side: 'BUY' as Direction, volume: '0.10', entry_price: '',
    stop_loss: '', take_profit: '', strategy_id: '', signal_id: '', reference: '',
  });

  const submitPrimary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !tradingAccount) return;
    const symbol = symbolById.get(pForm.symbol_id);
    if (!symbol) { toast.error('Choose a symbol'); return; }
    if (!pForm.entry_price) { toast.error('Enter a simulated entry price'); return; }
    setBusy(true);
    try {
      const result = await openPaperPrimary({
        workspaceId: selected.workspace_id,
        paperAccount: selected,
        tradingAccount,
        riskProfile,
        symbol,
        side: pForm.side,
        volume: Number(pForm.volume),
        entryPrice: Number(pForm.entry_price),
        stopLoss: pForm.stop_loss ? Number(pForm.stop_loss) : null,
        takeProfit: pForm.take_profit ? Number(pForm.take_profit) : null,
        strategyId: pForm.strategy_id || null,
        signalId: pForm.signal_id || null,
        reference: pForm.reference || undefined,
      });
      if (!result.ok) { toast.error(result.check.message); return; }
      toast.success('Simulated primary position created — no broker order was sent');
      window.supercool?.track('paper_position_created', { role: 'PRIMARY', symbol: symbol.broker_symbol });
      setPrimaryOpen(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create the simulated position');
    } finally {
      setBusy(false);
    }
  };

  /* -------------------------------- hedge form ------------------------------- */
  const [hForm, setHForm] = useState({ volume: '0.05', entry_price: '', reason: 'Structural invalidation (simulated)' });

  const submitHedge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !tradingAccount || !hedgeTarget) return;
    const symbol = symbolById.get(hedgeTarget.symbol_id);
    if (!symbol) return;
    setBusy(true);
    try {
      const result = await openPaperHedge({
        workspaceId: selected.workspace_id,
        paperAccount: selected,
        tradingAccount,
        riskProfile,
        symbol,
        primary: hedgeTarget,
        volume: Number(hForm.volume),
        entryPrice: Number(hForm.entry_price || hedgeTarget.current_price),
        triggerReason: hForm.reason,
      });
      if (!result.ok) {
        toast.error(result.check.message, { duration: 6000 });
        setHedgeTarget(null);
        refresh();
        return;
      }
      toast.success('Simulated hedge leg created within the configured tier limit');
      window.supercool?.track('paper_position_created', { role: 'HEDGE', symbol: symbol.broker_symbol });
      setHedgeTarget(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create the simulated hedge');
    } finally {
      setBusy(false);
    }
  };

  /* -------------------------------- price form ------------------------------- */
  const [newPrice, setNewPrice] = useState('');

  const submitPrice = async () => {
    if (!priceTarget || !selected) return;
    const symbol = symbolById.get(priceTarget.symbol_id);
    if (!symbol || !newPrice) return;
    setBusy(true);
    try {
      const pnl = await updateSimulatedPrice(selected.workspace_id, priceTarget, symbol, Number(newPrice));
      toast.success(`Simulated P/L recalculated: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}`);
      setPriceTarget(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update the simulated price');
    } finally {
      setBusy(false);
    }
  };

  const submitClose = async () => {
    if (!closeTarget || !selected) return;
    const symbol = symbolById.get(closeTarget.symbol_id);
    if (!symbol) return;
    setBusy(true);
    try {
      const pnl = await closePaperPosition(selected.workspace_id, closeTarget, symbol, Number(newPrice || closeTarget.current_price));
      toast.success(`Simulated position closed. Result ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}`);
      window.supercool?.track('paper_position_closed', { result: pnl });
      setCloseTarget(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not close the simulated position');
    } finally {
      setBusy(false);
    }
  };

  const symbolFor = (p: PaperPosition) => symbolById.get(p.symbol_id);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Paper Trading"
        subtitle="Mock broker simulator. Manual actions only — nothing here contacts a broker or an Expert Advisor."
        action={canWrite && accountsWithoutPaper.length > 0 && (
          <Button variant="outline" onClick={() => setNewPaperOpen(true)} className="h-10">
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" /> New paper account
          </Button>
        )}
      />

      <NoticeBanner tone="warn" title="PAPER / SIMULATION — no broker orders are ever generated">
        Prices are moved by hand. Profit and loss uses a transparent contract-size formula with no swap, no commission
        and no broker margin model. Hedge tiers are hard-capped by the assigned risk profile.
      </NoticeBanner>

      {dataLoading ? <LoadingRows count={4} /> : paperAccounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No paper accounts yet"
          description="Create a paper account against one of your trading accounts to start simulating."
          action={canWrite && <Button onClick={() => setNewPaperOpen(true)} className="h-10">Create paper account</Button>}
        />
      ) : (
        <>
          <SectionCard title="Select Paper Account" icon={Wallet}>
            <Label htmlFor="pa-select" className="sr-only">Paper account</Label>
            <select
              id="pa-select"
              value={selected?.id ?? ''}
              onChange={(e) => setSelectedPaperId(e.target.value)}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {paperAccounts.map((p) => (
                <option key={p.id} value={p.id}>
                  {accountById.get(p.trading_account_id)?.name ?? 'Account'} — sim {money(p.current_equity)}
                </option>
              ))}
            </select>

            {selected && (
              <>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <StatCard label="Sim starting" value={money(selected.starting_balance)} simulated />
                  <StatCard label="Sim balance" value={money(selected.current_balance)} simulated />
                  <StatCard label="Sim equity" value={money(selected.current_equity)} simulated />
                  <StatCard
                    label="Sim P/L"
                    value={<span className={pnlTone(selected.simulated_pnl)}>{signedMoney(selected.simulated_pnl)}</span>}
                    simulated
                  />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field label="Trading account" value={tradingAccount?.name ?? '—'} />
                  <Field label="Mode" value={<StatusBadge value={tradingAccount?.account_mode ?? '—'} tone="info" />} />
                  <Field label="Risk profile" value={riskProfile?.name ?? 'Unassigned'} />
                  <Field
                    label="Max hedge tiers"
                    value={riskProfile ? String(riskProfile.max_hedge_tiers) : '0 (no profile)'}
                    mono
                  />
                </div>

                {canWrite && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      onClick={() => {
                        const fromPreview = riskDraft.hedge_of === '';
                        setPForm((f) => ({
                          ...f,
                          symbol_id: (fromPreview && draftSymbolId) || f.symbol_id || data.symbols[0]?.id || '',
                          side: fromPreview ? riskDraft.side : f.side,
                          volume: fromPreview && riskDraft.volume ? riskDraft.volume : f.volume,
                          entry_price: fromPreview && riskDraft.entry_price ? riskDraft.entry_price : f.entry_price,
                          stop_loss: fromPreview && riskDraft.stop_loss ? riskDraft.stop_loss : f.stop_loss,
                        }));
                        setPrimaryOpen(true);
                      }}
                      disabled={!selected.paper_trading_enabled}
                      className="h-11 flex-1 font-semibold sm:flex-none"
                    >
                      <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" /> New simulated position
                    </Button>

                    <Button
                      variant="outline"
                      onClick={async () => {
                        await setPaperTradingEnabled(selected.id, !selected.paper_trading_enabled);
                        toast.success(selected.paper_trading_enabled ? 'Paper trading paused' : 'Paper trading resumed');
                        refresh();
                      }}
                      className={`h-11 flex-1 sm:flex-none ${selected.paper_trading_enabled ? 'border-amber-500/40 text-amber-300' : 'border-emerald-500/40 text-emerald-300'}`}
                    >
                      {selected.paper_trading_enabled
                        ? <><Pause className="mr-1.5 h-4 w-4" aria-hidden="true" /> Pause paper trading</>
                        : <><Play className="mr-1.5 h-4 w-4" aria-hidden="true" /> Resume paper trading</>}
                    </Button>
                  </div>
                )}

                {!selected.paper_trading_enabled && (
                  <div className="mt-3">
                    <NoticeBanner tone="warn" title="Paper trading is paused">
                      New simulated positions and hedges are refused for this account until it is resumed.
                    </NoticeBanner>
                  </div>
                )}
              </>
            )}
          </SectionCard>

          <RiskCheckPreview
            result={riskPreview}
            draft={{
              ...riskDraft,
              symbol_id: draftSymbolId,
              side: hedgeSource ? (hedgeSource.side === 'BUY' ? 'SELL' : 'BUY') : riskDraft.side,
              entry_price: riskDraft.entry_price || (hedgeSource ? String(hedgeSource.current_price) : ''),
            }}
            onDraftChange={setRiskDraft}
            symbols={data.symbols}
            openPositions={openPositions}
            symbolFor={(id) => symbolById.get(id)}
            riskProfile={riskProfile}
            hedgeTierRequested={hedgeTierRequested}
          />


          <SectionCard title={`Open Simulated Positions (${openPositions.length})`} icon={TerminalSquare} action={<SimBadge />}>
            {openPositions.length === 0 ? (
              <EmptyState icon={TerminalSquare} title="No open simulated positions" description="Create one to exercise the full primary → hedge → resolution flow." />
            ) : (
              <div className="space-y-2">
                {openPositions.map((p) => (
                  <PaperPositionCard
                    key={p.id}
                    position={p}
                    symbol={symbolFor(p)}
                    canAct={canWrite}
                    onUpdatePrice={() => { setNewPrice(String(p.current_price)); setPriceTarget(p); }}
                    onHedge={() => { setHForm({ ...hForm, entry_price: String(p.current_price) }); setHedgeTarget(p); }}
                    onClose={() => { setNewPrice(String(p.current_price)); setCloseTarget(p); }}
                  />
                ))}
              </div>
            )}
          </SectionCard>

          {closedPositions.length > 0 && (
            <SectionCard title={`Closed Simulated Positions (${closedPositions.length})`} icon={Wallet}>
              <div className="space-y-2">
                {closedPositions.slice(0, 8).map((p) => (
                  <PaperPositionCard key={p.id} position={p} symbol={symbolFor(p)} canAct={false} />
                ))}
              </div>
            </SectionCard>
          )}

          <SectionCard
            title="Paper Decision Log"
            icon={TerminalSquare}
            description="Manual operator actions only. No strategy engine produced any of these entries."
          >
            {data.decisionLog.length === 0 ? (
              <EmptyState icon={TerminalSquare} title="No decisions logged" />
            ) : (
              <ol className="space-y-2">
                {data.decisionLog.slice(0, 10).map((d) => (
                  <li key={d.id} className="rounded-lg border border-border/70 bg-secondary/20 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="num text-[11px] font-semibold text-primary">{d.action}</p>
                      <span className="text-[10px] text-muted-foreground">{relTime(d.created_at)}</span>
                    </div>
                    {d.reason && <p className="mt-0.5 text-[11px] text-muted-foreground">{d.reason}</p>}
                    {d.result && <p className="text-[11px] text-foreground/80">{d.result}</p>}
                    <StatusBadge className="mt-1.5" value={d.origin.replace(/_/g, ' ')} tone="neutral" />
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>
        </>
      )}

      <SectionCard title="Future Execution Placeholders" icon={Cable} description="Honest status. Nothing is faked.">
        <ul className="space-y-2">
          {[
            { icon: Cable, label: 'MT5 connection', value: 'NOT CONNECTED' },
            { icon: HeartPulse, label: 'EA heartbeat', value: 'NOT AVAILABLE' },
            { icon: Cable, label: 'Execution bridge', value: 'NOT AVAILABLE' },
          ].map((row) => (
            <li key={row.label} className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-secondary/20 px-3 py-2.5">
              <row.icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="flex-1 text-[12px] font-semibold">{row.label}</span>
              <StatusBadge value={row.value} tone="neutral" />
            </li>
          ))}
        </ul>
      </SectionCard>

      {/* --------------------------------- dialogs -------------------------------- */}

      <Dialog open={primaryOpen} onOpenChange={setPrimaryOpen}>
        <DialogContent className="max-h-[92vh] max-w-[94vw] overflow-y-auto rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">New simulated PRIMARY position</DialogTitle>
            <DialogDescription className="text-[11px]">
              Creates a sequence, a trade leg and a paper position. No broker order is generated.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitPrimary} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pp-symbol" className="text-xs">Symbol</Label>
                <select id="pp-symbol" required value={pForm.symbol_id} onChange={(e) => setPForm({ ...pForm, symbol_id: e.target.value })} className="h-11 w-full rounded-md border border-input bg-background px-2 text-sm">
                  <option value="">Select…</option>
                  {data.symbols.map((s) => <option key={s.id} value={s.id}>{s.broker_symbol}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pp-side" className="text-xs">Side</Label>
                <select id="pp-side" value={pForm.side} onChange={(e) => setPForm({ ...pForm, side: e.target.value as Direction })} className="h-11 w-full rounded-md border border-input bg-background px-2 text-sm">
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pp-vol" className="text-xs">Simulated volume (lots)</Label>
                <Input id="pp-vol" type="number" step="0.01" min="0.01" required value={pForm.volume} onChange={(e) => setPForm({ ...pForm, volume: e.target.value })} className="num h-11" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pp-entry" className="text-xs">Simulated entry</Label>
                <Input id="pp-entry" type="number" step="0.00001" required value={pForm.entry_price} onChange={(e) => setPForm({ ...pForm, entry_price: e.target.value })} className="num h-11" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pp-sl" className="text-xs">Stop loss</Label>
                <Input id="pp-sl" type="number" step="0.00001" value={pForm.stop_loss} onChange={(e) => setPForm({ ...pForm, stop_loss: e.target.value })} className="num h-11" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pp-tp" className="text-xs">Take profit</Label>
                <Input id="pp-tp" type="number" step="0.00001" value={pForm.take_profit} onChange={(e) => setPForm({ ...pForm, take_profit: e.target.value })} className="num h-11" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pp-strategy" className="text-xs">Strategy (optional)</Label>
              <select id="pp-strategy" value={pForm.strategy_id} onChange={(e) => setPForm({ ...pForm, strategy_id: e.target.value })} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">No strategy linked</option>
                {data.strategies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pp-signal" className="text-xs">Approved signal (optional)</Label>
              <select id="pp-signal" value={pForm.signal_id} onChange={(e) => setPForm({ ...pForm, signal_id: e.target.value })} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">No signal linked</option>
                {data.signals.filter((s) => s.validation_status === 'APPROVED').map((s) => (
                  <option key={s.id} value={s.id}>{s.provider_reference ?? s.id.slice(0, 8)} — {s.direction}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pp-ref" className="text-xs">Sequence reference (optional)</Label>
              <Input id="pp-ref" value={pForm.reference} onChange={(e) => setPForm({ ...pForm, reference: e.target.value })} className="num h-11" placeholder="ASH-TEST-001" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setPrimaryOpen(false)} className="h-11 flex-1">Cancel</Button>
              <Button type="submit" disabled={busy} className="h-11 flex-1 font-semibold">{busy ? 'Simulating…' : 'Create simulated position'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!hedgeTarget} onOpenChange={(o) => !o && setHedgeTarget(null)}>
        <DialogContent className="max-w-[94vw] rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Add simulated HEDGE leg</DialogTitle>
            <DialogDescription className="text-[11px]">
              Requesting tier {(hedgeTarget?.hedge_tier ?? 0) + 1}. The configured maximum is {riskProfile?.max_hedge_tiers ?? 0}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitHedge} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ph-vol" className="text-xs">Hedge volume (lots)</Label>
                <Input id="ph-vol" type="number" step="0.01" min="0.01" required value={hForm.volume} onChange={(e) => setHForm({ ...hForm, volume: e.target.value })} className="num h-11" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ph-entry" className="text-xs">Hedge entry</Label>
                <Input id="ph-entry" type="number" step="0.00001" required value={hForm.entry_price} onChange={(e) => setHForm({ ...hForm, entry_price: e.target.value })} className="num h-11" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ph-reason" className="text-xs">Trigger reason</Label>
              <Textarea id="ph-reason" required value={hForm.reason} onChange={(e) => setHForm({ ...hForm, reason: e.target.value })} rows={2} />
            </div>
            <NoticeBanner tone="warn" title="Volume is yours to choose">
              The simulator never scales a hedge for you. There is no martingale, no doubling and no automatic
              recovery ladder — if the requested tier exceeds the risk profile, the action is refused outright.
            </NoticeBanner>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setHedgeTarget(null)} className="h-11 flex-1">Cancel</Button>
              <Button type="submit" disabled={busy} className="h-11 flex-1 font-semibold">{busy ? 'Simulating…' : 'Create hedge leg'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!priceTarget} onOpenChange={(o) => !o && setPriceTarget(null)}>
        <DialogContent className="max-w-[94vw] rounded-xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Set simulated price</DialogTitle>
            <DialogDescription className="text-[11px]">
              Moves the simulated market price by hand and recalculates simulated P/L. There is no live price feed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="sim-price" className="text-xs">Simulated current price</Label>
              <Input id="sim-price" type="number" step="0.00001" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} className="num h-11" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPriceTarget(null)} className="h-11 flex-1">Cancel</Button>
              <Button onClick={submitPrice} disabled={busy} className="h-11 flex-1 font-semibold">{busy ? 'Updating…' : 'Recalculate P/L'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!closeTarget} onOpenChange={(o) => !o && setCloseTarget(null)}>
        <DialogContent className="max-w-[94vw] rounded-xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Close simulated position</DialogTitle>
            <DialogDescription className="text-[11px]">
              Realises the simulated result. When every leg of a sequence is closed the sequence resolves.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="exit-price" className="text-xs">Simulated exit price</Label>
              <Input id="exit-price" type="number" step="0.00001" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} className="num h-11" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCloseTarget(null)} className="h-11 flex-1">Cancel</Button>
              <Button onClick={submitClose} disabled={busy} className="h-11 flex-1 font-semibold">{busy ? 'Closing…' : 'Close position'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={newPaperOpen} onOpenChange={setNewPaperOpen}>
        <DialogContent className="max-w-[94vw] rounded-xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">New paper account</DialogTitle>
            <DialogDescription className="text-[11px]">Attaches a simulated ledger to a trading account record.</DialogDescription>
          </DialogHeader>
          <NewPaperAccountForm
            accounts={accountsWithoutPaper}
            onCreated={() => { setNewPaperOpen(false); refresh(); }}
          />
        </DialogContent>
      </Dialog>

      <button
        type="button"
        onClick={() => navigate('trade-sequences')}
        className="w-full rounded-lg border border-border py-2.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
      >
        View all trade sequences
      </button>
    </div>
  );
};

const NewPaperAccountForm: React.FC<{
  accounts: Array<{ id: string; name: string; workspace_id: string }>;
  onCreated: () => void;
}> = ({ accounts, onCreated }) => {
  const [accountId, setAccountId] = useState('');
  const [balance, setBalance] = useState('10000');
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const acc = accounts.find((a) => a.id === accountId);
        if (!acc) { toast.error('Choose a trading account'); return; }
        setBusy(true);
        try {
          await createPaperAccount(acc.workspace_id, acc.id, Number(balance));
          toast.success('Paper account created');
          onCreated();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Could not create the paper account');
        } finally {
          setBusy(false);
        }
      }}
      className="space-y-3"
    >
      <div className="space-y-1.5">
        <Label htmlFor="np-account" className="text-xs">Trading account</Label>
        <select id="np-account" required value={accountId} onChange={(e) => setAccountId(e.target.value)} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="">Select…</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="np-balance" className="text-xs">Simulated starting balance</Label>
        <Input id="np-balance" type="number" min="100" step="100" value={balance} onChange={(e) => setBalance(e.target.value)} className="num h-11" />
      </div>
      <Button type="submit" disabled={busy} className="h-11 w-full font-semibold">{busy ? 'Creating…' : 'Create paper account'}</Button>
    </form>
  );
};

export default PaperTradingPage;
