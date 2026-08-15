import React, { useMemo, useState } from 'react';
import { Plus, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { usePlatform, useLookups } from '@/contexts/PlatformContext';
import { EmptyState, NoticeBanner, PageHeader, StatusBadge } from '@/components/shared/Primitives';
import { FilterBar, LoadingRows } from '@/components/shared/Controls';
import { SignalCard } from '@/components/shared/RecordCards';
import { SIGNAL_SOURCES, SIGNAL_STATUSES, type Direction } from '@/lib/types';
import { createSignal, setSignalStatus } from '@/services/strategyService';

const SignalsPage: React.FC = () => {
  const { data, dataLoading, refresh, canWrite } = usePlatform();
  const { symbolById } = useLookups();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [source, setSource] = useState('ALL');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    symbol_id: '', direction: 'BUY' as Direction, entry_price: '', stop_loss: '',
    take_profit: '', timeframe: 'H1', provider_reference: '', notes: '', raw: '',
  });

  const filtered = useMemo(() => data.signals.filter((s) => {
    const q = search.toLowerCase();
    const sym = s.symbol_id ? symbolById.get(s.symbol_id)?.broker_symbol ?? '' : '';
    const matches = !q || sym.toLowerCase().includes(q) || (s.provider_reference ?? '').toLowerCase().includes(q)
      || (s.notes ?? '').toLowerCase().includes(q);
    return matches && (status === 'ALL' || s.validation_status === status) && (source === 'ALL' || s.source_type === source);
  }), [data.signals, search, status, source, symbolById]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.symbol_id) { toast.error('Choose a symbol'); return; }
    setBusy(true);
    try {
      const workspaceId = data.accounts[0]?.workspace_id ?? data.signals[0]?.workspace_id ?? data.symbols.find((s) => s.workspace_id)?.workspace_id ?? '';

      await createSignal(workspaceId, {
        symbol_id: form.symbol_id,
        direction: form.direction,
        entry_price: form.entry_price ? Number(form.entry_price) : null,
        stop_loss: form.stop_loss ? Number(form.stop_loss) : null,
        take_profit: form.take_profit ? Number(form.take_profit) : null,
        timeframe: form.timeframe || null,
        provider_reference: form.provider_reference || null,
        notes: form.notes || null,
        raw_signal: { text: form.raw || 'Entered manually in the control center', entered_manually: true },
      });
      toast.success('Signal recorded and queued for manual review');
      window.supercool?.track('form_submit', { form: 'create_signal' });
      setOpen(false);
      setForm({ ...form, entry_price: '', stop_loss: '', take_profit: '', provider_reference: '', notes: '', raw: '' });
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not record the signal');
    } finally {
      setBusy(false);
    }
  };

  const act = async (id: string, next: 'APPROVED' | 'REJECTED', label: string) => {
    try {
      await setSignalStatus(id, next, label);
      toast.success(`Signal ${next.toLowerCase()} — no order was generated`);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update the signal');
    }
  };

  return (
    <div>
      <PageHeader
        title="Signals"
        subtitle="Manual signal intake and human validation. External adapters are not connected in Phase 1."
        action={canWrite && (
          <Button onClick={() => setOpen(true)} className="h-10 font-semibold">
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" /> New signal
          </Button>
        )}
      />

      <div className="mb-4 space-y-2">
        <NoticeBanner tone="warn" title="Manual entry only" icon={Radio}>
          Email, Telegram, Webhook, Discord and API adapters are future work. The signals table is already shaped for
          them, but nothing external can write to it today, and approving a signal never places an order.
        </NoticeBanner>
        <div className="scroll-thin flex gap-1.5 overflow-x-auto pb-1">
          {SIGNAL_SOURCES.map((s) => (
            <StatusBadge key={s} value={s === 'MANUAL' ? 'MANUAL — ACTIVE' : `${s} — NOT CONNECTED`} tone={s === 'MANUAL' ? 'good' : 'neutral'} />
          ))}
        </div>
      </div>

      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: 'Search symbol, reference, notes…' }}
        filters={[
          { id: 'status', label: 'Status', options: [...SIGNAL_STATUSES], value: status, onChange: setStatus },
          { id: 'source', label: 'Source', options: [...SIGNAL_SOURCES], value: source, onChange: setSource },
        ]}
      />

      {dataLoading ? <LoadingRows /> : filtered.length === 0 ? (
        <EmptyState icon={Radio} title="No signals match" description="Record a manual signal to begin building the validation history." />
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <SignalCard
              key={s.id}
              signal={s}
              symbol={s.symbol_id ? symbolById.get(s.symbol_id) : undefined}
              canAct={canWrite}
              onApprove={() => act(s.id, 'APPROVED', s.provider_reference ?? s.id.slice(0, 8))}
              onReject={() => act(s.id, 'REJECTED', s.provider_reference ?? s.id.slice(0, 8))}
            />
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-[94vw] overflow-y-auto rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Record a manual signal</DialogTitle>
            <DialogDescription className="text-[11px]">Saved as PENDING for human approval. No order is created.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sg-symbol" className="text-xs">Symbol</Label>
                <select id="sg-symbol" required value={form.symbol_id} onChange={(e) => setForm({ ...form, symbol_id: e.target.value })} className="h-11 w-full rounded-md border border-input bg-background px-2 text-sm">
                  <option value="">Select…</option>
                  {data.symbols.map((s) => <option key={s.id} value={s.id}>{s.broker_symbol}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sg-dir" className="text-xs">Direction</Label>
                <select id="sg-dir" value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value as Direction })} className="h-11 w-full rounded-md border border-input bg-background px-2 text-sm">
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([['entry_price', 'Entry'], ['stop_loss', 'Stop'], ['take_profit', 'Target']] as const).map(([key, label]) => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={`sg-${key}`} className="text-[11px]">{label}</Label>
                  <Input
                    id={`sg-${key}`} type="number" step="0.00001" value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="num h-11"
                  />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sg-tf" className="text-xs">Timeframe</Label>
                <Input id="sg-tf" value={form.timeframe} onChange={(e) => setForm({ ...form, timeframe: e.target.value })} className="num h-11" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sg-ref" className="text-xs">Provider reference</Label>
                <Input id="sg-ref" value={form.provider_reference} onChange={(e) => setForm({ ...form, provider_reference: e.target.value })} className="h-11" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sg-raw" className="text-xs">Raw signal text</Label>
              <Textarea id="sg-raw" value={form.raw} onChange={(e) => setForm({ ...form, raw: e.target.value })} rows={2} placeholder="EURUSD buy 1.0850 sl 1.0800 tp 1.0950" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sg-notes" className="text-xs">Notes</Label>
              <Textarea id="sg-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="h-11 flex-1">Cancel</Button>
              <Button type="submit" disabled={busy} className="h-11 flex-1 font-semibold">{busy ? 'Saving…' : 'Record signal'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SignalsPage;
