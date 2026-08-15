import React, { useMemo, useState } from 'react';
import { ArrowLeft, Cable, HeartPulse, Layers, Plus, ShieldAlert, Users, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { usePlatform, useLookups } from '@/contexts/PlatformContext';
import { useNav } from '@/contexts/NavContext';
import { EmptyState, Field, NoticeBanner, PageHeader, SectionCard, StatusBadge } from '@/components/shared/Primitives';
import { ConfirmDialog, FilterBar, LoadingRows } from '@/components/shared/Controls';
import { AccountSummaryCard, EventFeed, TradeSequenceCard } from '@/components/shared/RecordCards';
import { ACCOUNT_MODES, type AccountMode, type TradingAccount } from '@/lib/types';
import { archiveAccount, createAccount, setManualStop, updateAccount } from '@/services/accountService';
import { listEventsForAccount } from '@/services/systemEventService';
import { dateTime, money, pnlTone, signedMoney } from '@/lib/format';

/* ------------------------------ Account form ------------------------------- */

const AccountForm: React.FC<{
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: TradingAccount | null;
  onDone: () => void;
}> = ({ open, onOpenChange, editing, onDone }) => {
  const { profile, data } = usePlatform();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: '', broker: '', server: '', account_reference: '',
    account_mode: 'MONITORONLY' as AccountMode, currency: 'USD', leverage: 30,
    margin_mode: 'HEDGING' as 'HEDGING' | 'NETTING', hedging_allowed: true,
    risk_profile_id: '', notes: '',
  });

  React.useEffect(() => {
    if (!open) return;
    setForm({
      name: editing?.name ?? '',
      broker: editing?.broker ?? '',
      server: editing?.server ?? '',
      account_reference: editing?.account_reference ?? '',
      account_mode: editing?.account_mode ?? 'MONITORONLY',
      currency: editing?.currency ?? 'USD',
      leverage: editing?.leverage ?? 30,
      margin_mode: editing?.margin_mode ?? 'HEDGING',
      hedging_allowed: editing?.hedging_allowed ?? true,
      risk_profile_id: editing?.risk_profile_id ?? '',
      notes: editing?.notes ?? '',
    });
  }, [open, editing]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setBusy(true);
    try {
      const payload = { ...form, risk_profile_id: form.risk_profile_id || null, leverage: Number(form.leverage) };
      if (editing) {
        await updateAccount(editing.id, payload);
        toast.success('Account updated');
      } else {
        await createAccount(profile.workspace_id, payload);
        toast.success('Account created — execution remains disconnected');
        window.supercool?.track('form_submit', { form: 'create_account', mode: form.account_mode });
      }
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the account');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-[94vw] overflow-y-auto rounded-xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">{editing ? 'Edit trading account' : 'New trading account'}</DialogTitle>
          <DialogDescription className="text-[11px]">
            Accounts are records only. No terminal is contacted and no credentials are stored.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="acc-name" className="text-xs">Account name</Label>
            <Input id="acc-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11" placeholder="Prop Challenge Account" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="acc-broker" className="text-xs">Broker</Label>
              <Input id="acc-broker" value={form.broker} onChange={(e) => setForm({ ...form, broker: e.target.value })} className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acc-server" className="text-xs">Server</Label>
              <Input id="acc-server" value={form.server} onChange={(e) => setForm({ ...form, server: e.target.value })} className="h-11" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="acc-ref" className="text-xs">Account reference</Label>
              <Input id="acc-ref" value={form.account_reference} onChange={(e) => setForm({ ...form, account_reference: e.target.value })} className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acc-mode" className="text-xs">Mode</Label>
              <select
                id="acc-mode" value={form.account_mode}
                onChange={(e) => setForm({ ...form, account_mode: e.target.value as AccountMode })}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {ACCOUNT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="acc-currency" className="text-xs">Currency</Label>
              <Input id="acc-currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acc-lev" className="text-xs">Leverage</Label>
              <Input id="acc-lev" type="number" min={1} max={500} value={form.leverage} onChange={(e) => setForm({ ...form, leverage: Number(e.target.value) })} className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acc-margin" className="text-xs">Margin mode</Label>
              <select
                id="acc-margin" value={form.margin_mode}
                onChange={(e) => setForm({ ...form, margin_mode: e.target.value as 'HEDGING' | 'NETTING' })}
                className="h-11 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="HEDGING">HEDGING</option>
                <option value="NETTING">NETTING</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="acc-rp" className="text-xs">Risk profile</Label>
            <select
              id="acc-rp" value={form.risk_profile_id}
              onChange={(e) => setForm({ ...form, risk_profile_id: e.target.value })}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">No risk profile assigned</option>
              {data.riskProfiles.filter((r) => r.status === 'ACTIVE').map((r) => (
                <option key={r.id} value={r.id}>{r.name} — max {r.max_hedge_tiers} hedge tier(s)</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 rounded-md border border-border bg-secondary/30 p-3">
            <input
              type="checkbox" checked={form.hedging_allowed}
              onChange={(e) => setForm({ ...form, hedging_allowed: e.target.checked })}
              className="h-4 w-4 accent-primary"
            />
            <span className="text-xs">Hedging allowed on this account</span>
          </label>
          <div className="space-y-1.5">
            <Label htmlFor="acc-notes" className="text-xs">Notes</Label>
            <Textarea id="acc-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>

          <NoticeBanner tone="warn" title="Execution stays disabled">
            New and edited accounts are always saved with trading disabled and execution status NOT CONNECTED.
          </NoticeBanner>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-11 flex-1">Cancel</Button>
            <Button type="submit" disabled={busy} className="h-11 flex-1 font-semibold">{busy ? 'Saving…' : 'Save account'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

/* ------------------------------ Accounts list ------------------------------ */

export const AccountsPage: React.FC = () => {
  const { data, dataLoading, refresh, canWrite } = usePlatform();
  const { navigate } = useNav();
  const { riskProfileById } = useLookups();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [mode, setMode] = useState('ALL');
  const [formOpen, setFormOpen] = useState(false);

  const filtered = useMemo(() => data.accounts.filter((a) => {
    const q = search.toLowerCase();
    const matches = !q || a.name.toLowerCase().includes(q) || (a.broker ?? '').toLowerCase().includes(q)
      || (a.account_reference ?? '').toLowerCase().includes(q);
    return matches && (status === 'ALL' || a.status === status) && (mode === 'ALL' || a.account_mode === mode);
  }), [data.accounts, search, status, mode]);

  return (
    <div>
      <PageHeader
        title="Trading Accounts"
        subtitle="Account records, modes and risk assignments. Archiving preserves all linked history."
        action={canWrite && (
          <Button onClick={() => setFormOpen(true)} className="h-10 font-semibold">
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" /> New account
          </Button>
        )}
      />

      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: 'Search accounts, brokers, references…' }}
        filters={[
          { id: 'status', label: 'Status', options: ['ACTIVE', 'INACTIVE', 'ARCHIVED'], value: status, onChange: setStatus },
          { id: 'mode', label: 'Mode', options: [...ACCOUNT_MODES], value: mode, onChange: setMode },
        ]}
      />

      {dataLoading ? <LoadingRows /> : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No accounts match"
          description="Adjust the filters, or create a new trading account record."
          action={canWrite && <Button onClick={() => setFormOpen(true)} className="h-10">Create account</Button>}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => (
            <AccountSummaryCard
              key={a.id}
              account={a}
              riskProfileName={a.risk_profile_id ? riskProfileById.get(a.risk_profile_id)?.name : undefined}
              strategyCount={data.assignments.filter((x) => x.account_id === a.id).length}
              onClick={() => navigate('account-detail', a.id)}
            />
          ))}
        </div>
      )}

      <AccountForm open={formOpen} onOpenChange={setFormOpen} editing={null} onDone={refresh} />
    </div>
  );
};

/* ------------------------------ Account detail ----------------------------- */

export const AccountDetailPage: React.FC<{ accountId?: string }> = ({ accountId }) => {
  const { data, refresh, canWrite, isOwner } = usePlatform();
  const { navigate, back } = useNav();
  const { symbolById, strategyById, riskProfileById } = useLookups();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [events, setEvents] = useState<Awaited<ReturnType<typeof listEventsForAccount>>>([]);

  const account = data.accounts.find((a) => a.id === accountId);

  React.useEffect(() => {
    if (!accountId) return;
    listEventsForAccount(accountId, 12).then(setEvents).catch(() => setEvents([]));
  }, [accountId, data.events.length]);

  if (!account) {
    return <EmptyState icon={Users} title="Account not found" description="It may have been archived or belongs to another workspace." action={<Button onClick={() => navigate('accounts')} className="h-10">Back to accounts</Button>} />;
  }

  const riskProfile = account.risk_profile_id ? riskProfileById.get(account.risk_profile_id) : null;
  const assignments = data.assignments.filter((a) => a.account_id === account.id);
  const paper = data.paperAccounts.find((p) => p.trading_account_id === account.id);
  const sequences = data.sequences.filter((s) => s.account_id === account.id);
  const groups = data.groupMembers
    .filter((m) => m.account_id === account.id)
    .map((m) => data.groups.find((g) => g.id === m.group_id)?.name)
    .filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      <button type="button" onClick={back} className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-primary">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back
      </button>

      <PageHeader
        title={account.name}
        subtitle={`${account.broker ?? 'No broker'} · ${account.server ?? 'no server'} · ${account.account_reference ?? 'no reference'}`}
        action={canWrite && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditOpen(true)} className="h-10">Edit</Button>
            {isOwner && account.status !== 'ARCHIVED' && (
              <Button variant="outline" onClick={() => setConfirmArchive(true)} className="h-10 border-amber-500/40 text-amber-300">Archive</Button>
            )}
          </div>
        )}
      />

      <SectionCard title="Account Information" icon={Users}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Status" value={<StatusBadge value={account.status} />} />
          <Field label="Mode" value={<StatusBadge value={account.account_mode} tone="info" />} />
          <Field label="Risk state" value={<StatusBadge value={account.current_risk_state} dot />} />
          <Field label="Currency" value={account.currency} mono />
          <Field label="Leverage" value={`1:${account.leverage}`} mono />
          <Field label="Margin mode" value={account.margin_mode} />
          <Field label="Hedging" value={account.hedging_allowed ? 'Allowed' : 'Blocked'} />
          <Field label="Groups" value={groups.length ? groups.join(', ') : 'None'} />
        </div>
        {account.notes && <p className="mt-3 rounded-md border border-border/70 bg-secondary/20 p-2.5 text-[11px] leading-relaxed text-muted-foreground">{account.notes}</p>}
        {canWrite && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                await setManualStop(account.id, account.name, !account.manual_stop_active);
                toast.success(account.manual_stop_active ? 'Manual stop released' : 'Manual stop engaged');
                refresh();
              }}
              className={`h-10 ${account.manual_stop_active ? 'border-emerald-500/40 text-emerald-300' : 'border-rose-500/40 text-rose-300'}`}
            >
              <ShieldAlert className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {account.manual_stop_active ? 'Release manual stop' : 'Engage manual stop'}
            </Button>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Execution Status" icon={Cable} description="Reported honestly. Phase 1 never connects a terminal.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="MT5 connection" value={<StatusBadge value={account.execution_status} />} />
          <Field label="EA heartbeat" value={<StatusBadge value="NOT AVAILABLE" tone="neutral" />} />
          <Field label="Execution bridge" value={<StatusBadge value="NOT AVAILABLE" tone="neutral" />} />
          <Field label="MT5 account no." value={account.mt5_account_number ?? 'Not set'} mono />
          <Field label="Execution mode" value={account.execution_mode ?? 'PAPER'} />
          <Field label="Last heartbeat" value={account.last_execution_heartbeat_at ? dateTime(account.last_execution_heartbeat_at) : 'Never'} />
          <Field label="Trading flag" value={<StatusBadge value={account.trading_enabled ? 'ENABLED' : 'DISABLED'} tone={account.trading_enabled ? 'warn' : 'neutral'} />} />
          <Field label="Manual stop" value={<StatusBadge value={account.manual_stop_active ? 'ENGAGED' : 'RELEASED'} tone={account.manual_stop_active ? 'bad' : 'neutral'} />} />
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Risk Profile" icon={ShieldAlert} description="Stored configuration for the Phase 2 Risk Engine.">
          {riskProfile ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Profile" value={riskProfile.name} />
              <Field label="Risk / setup" value={`${riskProfile.risk_per_setup}%`} mono />
              <Field label="Risk / hedge" value={`${riskProfile.risk_per_hedge}%`} mono />
              <Field label="Max hedge tiers" value={String(riskProfile.max_hedge_tiers)} mono />
              <Field label="Daily loss cap" value={`${riskProfile.max_daily_loss}%`} mono />
              <Field label="News mode" value={riskProfile.news_mode} />
            </div>
          ) : (
            <EmptyState icon={ShieldAlert} title="No risk profile assigned" description="Assign one from the edit form so the paper simulator can enforce hedge tier limits." />
          )}
        </SectionCard>

        <SectionCard
          title="Paper Account"
          icon={Wallet}
          action={<button type="button" onClick={() => navigate('paper-trading')} className="text-[11px] font-semibold text-primary hover:underline">Simulator</button>}
        >
          {paper ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Sim starting" value={money(paper.starting_balance)} mono />
              <Field label="Sim balance" value={money(paper.current_balance)} mono />
              <Field label="Sim equity" value={money(paper.current_equity)} mono />
              <Field label="Sim P/L" value={<span className={pnlTone(paper.simulated_pnl)}>{signedMoney(paper.simulated_pnl)}</span>} mono />
              <Field label="Paper state" value={<StatusBadge value={paper.status} />} />
            </div>
          ) : (
            <EmptyState icon={Wallet} title="No paper account" description="Create one from the Paper Trading screen to simulate positions on this account." />
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Assigned Strategies"
        icon={Layers}
        action={<button type="button" onClick={() => navigate('strategy-assignments')} className="text-[11px] font-semibold text-primary hover:underline">Manage</button>}
      >
        {assignments.length === 0 ? (
          <EmptyState icon={Layers} title="No strategies assigned" />
        ) : (
          <ul className="space-y-2">
            {assignments.map((a) => {
              const s = strategyById.get(a.strategy_id);
              return (
                <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-secondary/20 px-3 py-2.5">
                  <div className="min-w-0">
                    <button type="button" onClick={() => navigate('strategy-detail', a.strategy_id)} className="truncate text-[12px] font-semibold hover:text-primary hover:underline">
                      {s?.name ?? 'Unknown strategy'}
                    </button>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Priority {a.priority} · {s?.status ?? '—'}</p>
                  </div>
                  <StatusBadge value={a.enabled ? 'ENABLED' : 'DISABLED'} tone={a.enabled ? 'warn' : 'neutral'} />
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Trade Sequences" icon={Layers}>
        {sequences.length === 0 ? (
          <EmptyState icon={Layers} title="No sequences on this account" />
        ) : (
          <div className="space-y-2">
            {sequences.map((s) => (
              <TradeSequenceCard key={s.id} sequence={s} symbol={symbolById.get(s.symbol_id)} accountName={account.name} onClick={() => navigate('trade-sequence-detail', s.id)} />
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Recent Events" icon={HeartPulse}>
        {events.length === 0 ? <EmptyState icon={HeartPulse} title="No events for this account" /> : <EventFeed events={events} compact />}
      </SectionCard>

      <AccountForm open={editOpen} onOpenChange={setEditOpen} editing={account} onDone={refresh} />
      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title="Archive this account?"
        description="Archiving sets the status to ARCHIVED and disables trading. Nothing is deleted — sequences, trades, hedge records and events are all retained for audit."
        confirmLabel="Archive account"
        destructive
        onConfirm={async () => {
          await archiveAccount(account.id, account.name);
          toast.success('Account archived. History retained.');
          setConfirmArchive(false);
          refresh();
          navigate('accounts');
        }}
      />
    </div>
  );
};
