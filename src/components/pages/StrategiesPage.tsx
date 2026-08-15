import React, { useMemo, useState } from 'react';
import { ArrowLeft, Bot, Link2, Plus, Trash2 } from 'lucide-react';
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
import { JsonRulesCard, StrategySummaryCard } from '@/components/shared/RecordCards';
import { STRATEGY_STATUSES, STRATEGY_TYPES, type Strategy, type StrategyStatus, type StrategyType } from '@/lib/types';
import {
  archiveStrategy, assignStrategy, createStrategy, removeAssignment, setAssignmentEnabled, updateStrategy,
} from '@/services/strategyService';
import { dateTime } from '@/lib/format';

/* -------------------------------- Strategies ------------------------------- */

export const StrategiesPage: React.FC = () => {
  const { data, dataLoading, refresh, canWrite } = usePlatform();
  const { navigate } = useNav();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [type, setType] = useState('ALL');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', strategy_type: 'CUSTOM' as StrategyType, version: 'v1.0.0',
  });

  const filtered = useMemo(() => data.strategies.filter((s) => {
    const q = search.toLowerCase();
    return (!q || s.name.toLowerCase().includes(q) || (s.description ?? '').toLowerCase().includes(q))
      && (status === 'ALL' || s.status === status) && (type === 'ALL' || s.strategy_type === type);
  }), [data.strategies, search, status, type]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const workspaceId = data.accounts[0]?.workspace_id ?? data.strategies[0]?.workspace_id ?? '';
      await createStrategy(workspaceId, {
        ...form,
        entry_rules: { conditions: ['Define your entry conditions'], human_approval_required: true },
        exit_rules: { invalidation: 'Define your invalidation' },
        hedge_rules: { max_tiers_source: 'risk_profiles.max_hedge_tiers', volume_policy: 'Fixed fraction of primary. No martingale.' },
        regime_rules: { status: 'Regime Engine arrives in Phase 3' },
        risk_rules: { authority: 'Phase 2 Risk Engine', strategy_may_override_risk: false },
      });
      toast.success('Strategy created as DRAFT — it cannot trade');
      window.supercool?.track('form_submit', { form: 'create_strategy' });
      setOpen(false);
      setForm({ name: '', description: '', strategy_type: 'CUSTOM', version: 'v1.0.0' });
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create the strategy');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Strategies"
        subtitle="Strategy definitions and rule sets. Definitions only — no strategy in Phase 1 can generate, size or route a trade."
        action={canWrite && (
          <Button onClick={() => setOpen(true)} className="h-10 font-semibold">
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" /> New strategy
          </Button>
        )}
      />

      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: 'Search strategies…' }}
        filters={[
          { id: 'status', label: 'Status', options: [...STRATEGY_STATUSES], value: status, onChange: setStatus },
          { id: 'type', label: 'Type', options: [...STRATEGY_TYPES], value: type, onChange: setType },
        ]}
      />

      {dataLoading ? <LoadingRows /> : filtered.length === 0 ? (
        <EmptyState icon={Bot} title="No strategies match" description="Adjust the filters or define a new strategy." />
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <StrategySummaryCard
              key={s.id}
              strategy={s}
              assignedCount={data.assignments.filter((a) => a.strategy_id === s.id).length}
              onClick={() => navigate('strategy-detail', s.id)}
            />
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[94vw] rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">New strategy</DialogTitle>
            <DialogDescription className="text-[11px]">Every new strategy starts as DRAFT and stays inert.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="st-name" className="text-xs">Strategy name</Label>
              <Input id="st-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st-desc" className="text-xs">Description</Label>
              <Textarea id="st-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="st-type" className="text-xs">Type</Label>
                <select
                  id="st-type" value={form.strategy_type}
                  onChange={(e) => setForm({ ...form, strategy_type: e.target.value as StrategyType })}
                  className="h-11 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  {STRATEGY_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="st-ver" className="text-xs">Version</Label>
                <Input id="st-ver" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} className="num h-11" />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="h-11 flex-1">Cancel</Button>
              <Button type="submit" disabled={busy} className="h-11 flex-1 font-semibold">{busy ? 'Saving…' : 'Create as DRAFT'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ----------------------------- Strategy detail ----------------------------- */

const RULE_BLOCKS: Array<{ key: keyof Strategy; title: string }> = [
  { key: 'entry_rules', title: 'Entry Rules' },
  { key: 'exit_rules', title: 'Exit Rules' },
  { key: 'hedge_rules', title: 'Hedge Rules' },
  { key: 'regime_rules', title: 'Regime Rules' },
  { key: 'risk_rules', title: 'Risk Rules' },
];

export const StrategyDetailPage: React.FC<{ strategyId?: string }> = ({ strategyId }) => {
  const { data, refresh, canWrite, isOwner } = usePlatform();
  const { navigate, back } = useNav();
  const { accountById } = useLookups();
  const [jsonEditor, setJsonEditor] = useState<{ key: keyof Strategy; title: string } | null>(null);
  const [jsonText, setJsonText] = useState('');
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [busy, setBusy] = useState(false);

  const strategy = data.strategies.find((s) => s.id === strategyId);
  if (!strategy) {
    return <EmptyState icon={Bot} title="Strategy not found" action={<Button onClick={() => navigate('strategies')} className="h-10">Back to strategies</Button>} />;
  }

  const assignments = data.assignments.filter((a) => a.strategy_id === strategy.id);

  const saveJson = async () => {
    if (!jsonEditor) return;
    setBusy(true);
    try {
      const parsed = JSON.parse(jsonText);
      await updateStrategy(strategy.id, { [jsonEditor.key]: parsed } as Partial<Strategy>);
      toast.success(`${jsonEditor.title} updated`);
      setJsonEditor(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof SyntaxError ? 'That is not valid JSON.' : err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <button type="button" onClick={back} className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-primary">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back
      </button>

      <PageHeader
        title={strategy.name}
        subtitle={strategy.description ?? undefined}
        action={isOwner && strategy.status !== 'ARCHIVED' && (
          <Button variant="outline" onClick={() => setConfirmArchive(true)} className="h-10 border-amber-500/40 text-amber-300">Archive</Button>
        )}
      />

      <SectionCard title="Definition" icon={Bot}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Type" value={<StatusBadge value={strategy.strategy_type} tone="info" />} />
          <Field label="Status" value={<StatusBadge value={strategy.status} />} />
          <Field label="Version" value={strategy.version} mono />
          <Field label="Assigned to" value={`${assignments.length} account(s)`} mono />
          <Field label="Created" value={dateTime(strategy.created_at)} />
          <Field label="Updated" value={dateTime(strategy.updated_at)} />
        </div>

        {canWrite && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label htmlFor="st-status" className="label-caps">Status</label>
            <select
              id="st-status" value={strategy.status}
              onChange={async (e) => {
                await updateStrategy(strategy.id, { status: e.target.value as StrategyStatus });
                toast.success('Strategy status updated. No execution path exists in Phase 1.');
                refresh();
              }}
              className="h-10 rounded-md border border-input bg-background px-3 text-xs"
            >
              {STRATEGY_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}

        <div className="mt-3">
          <NoticeBanner tone="warn" title="A status change does not enable trading">
            Marking a strategy ACTIVE records intent only. There is no strategy engine, no execution queue and no
            broker connection in Phase 1, and every future path must pass the Risk Engine first.
          </NoticeBanner>
        </div>
      </SectionCard>

      <div className="grid gap-3 lg:grid-cols-2">
        {RULE_BLOCKS.map((b) => (
          <JsonRulesCard
            key={String(b.key)}
            title={b.title}
            rules={(strategy[b.key] ?? {}) as Record<string, unknown>}
            onEditJson={canWrite ? () => {
              setJsonEditor(b);
              setJsonText(JSON.stringify(strategy[b.key] ?? {}, null, 2));
            } : undefined}
          />
        ))}
      </div>

      <SectionCard
        title="Assigned Accounts"
        icon={Link2}
        action={<button type="button" onClick={() => navigate('strategy-assignments')} className="text-[11px] font-semibold text-primary hover:underline">Manage assignments</button>}
      >
        {assignments.length === 0 ? (
          <EmptyState icon={Link2} title="Not assigned to any account" />
        ) : (
          <ul className="space-y-2">
            {assignments.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-secondary/20 px-3 py-2.5">
                <div className="min-w-0">
                  <button type="button" onClick={() => navigate('account-detail', a.account_id)} className="truncate text-[12px] font-semibold hover:text-primary hover:underline">
                    {accountById.get(a.account_id)?.name ?? 'Unknown account'}
                  </button>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Priority {a.priority}</p>
                </div>
                <StatusBadge value={a.enabled ? 'ENABLED' : 'DISABLED'} tone={a.enabled ? 'warn' : 'neutral'} />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <Dialog open={!!jsonEditor} onOpenChange={(o) => !o && setJsonEditor(null)}>
        <DialogContent className="max-h-[92vh] max-w-[94vw] overflow-y-auto rounded-xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">Edit {jsonEditor?.title}</DialogTitle>
            <DialogDescription className="text-[11px]">
              JSONB flexibility is preserved. The readable cards render whatever structure you save.
            </DialogDescription>
          </DialogHeader>
          <Label htmlFor="json-editor" className="sr-only">Rule JSON</Label>
          <Textarea
            id="json-editor" value={jsonText} onChange={(e) => setJsonText(e.target.value)}
            rows={14} className="num text-[11px]" spellCheck={false}
          />
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setJsonEditor(null)} className="h-11 flex-1">Cancel</Button>
            <Button onClick={saveJson} disabled={busy} className="h-11 flex-1 font-semibold">{busy ? 'Saving…' : 'Save rules'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title="Archive this strategy?"
        description="The strategy is marked ARCHIVED. Assignments, sequences and trades that reference it are all retained."
        confirmLabel="Archive strategy"
        destructive
        onConfirm={async () => {
          await archiveStrategy(strategy.id, strategy.name);
          toast.success('Strategy archived');
          setConfirmArchive(false);
          refresh();
          navigate('strategies');
        }}
      />
    </div>
  );
};

/* --------------------------- Strategy assignments -------------------------- */

export const StrategyAssignmentsPage: React.FC = () => {
  const { data, refresh, canWrite, isOwner } = usePlatform();
  const { navigate } = useNav();
  const { accountById, strategyById } = useLookups();
  const [accountId, setAccountId] = useState('');
  const [strategyId, setStrategyId] = useState('');
  const [priority, setPriority] = useState(100);
  const [busy, setBusy] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [filterAccount, setFilterAccount] = useState('ALL');

  const rows = useMemo(
    () => data.assignments.filter((a) => filterAccount === 'ALL' || a.account_id === filterAccount),
    [data.assignments, filterAccount],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId || !strategyId) { toast.error('Choose an account and a strategy'); return; }
    setBusy(true);
    try {
      const workspaceId = data.accounts[0]?.workspace_id ?? '';
      await assignStrategy(workspaceId, accountId, strategyId, priority);
      toast.success('Strategy assigned (disabled by default)');
      window.supercool?.track('form_submit', { form: 'assign_strategy' });
      setAccountId(''); setStrategyId('');
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not assign the strategy');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Strategy Assignments"
        subtitle="Many-to-many links between accounts and strategies. Assignments are inert in Phase 1."
      />

      {canWrite && (
        <SectionCard title="Assign a strategy" icon={Link2}>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="as-account" className="text-xs">Account</Label>
              <select id="as-account" value={accountId} onChange={(e) => setAccountId(e.target.value)} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Select an account…</option>
                {data.accounts.filter((a) => a.status !== 'ARCHIVED').map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="as-strategy" className="text-xs">Strategy</Label>
              <select id="as-strategy" value={strategyId} onChange={(e) => setStrategyId(e.target.value)} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Select a strategy…</option>
                {data.strategies.filter((s) => s.status !== 'ARCHIVED').map((s) => <option key={s.id} value={s.id}>{s.name} ({s.status})</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="as-priority" className="text-xs">Priority (lower runs first)</Label>
              <Input id="as-priority" type="number" min={1} max={999} value={priority} onChange={(e) => setPriority(Number(e.target.value))} className="num h-11" />
            </div>
            <Button type="submit" disabled={busy} className="h-11 w-full font-semibold">{busy ? 'Assigning…' : 'Assign strategy'}</Button>
          </form>
        </SectionCard>
      )}

      <FilterBar
        filters={[{
          id: 'account', label: 'Account',
          options: data.accounts.map((a) => a.id),
          value: filterAccount, onChange: setFilterAccount,
        }].map((f) => ({
          ...f,
          options: data.accounts.map((a) => a.name),
          value: filterAccount === 'ALL' ? 'ALL' : accountById.get(filterAccount)?.name ?? 'ALL',
          onChange: (name: string) => {
            const found = data.accounts.find((a) => a.name === name);
            setFilterAccount(found ? found.id : 'ALL');
          },
        }))}
      />

      <SectionCard title={`Assignments (${rows.length})`} icon={Link2}>
        {rows.length === 0 ? (
          <EmptyState icon={Link2} title="No assignments" description="Link a strategy to an account above." />
        ) : (
          <ul className="space-y-2">
            {rows.map((a) => (
              <li key={a.id} className="flex items-center gap-2 rounded-lg border border-border/70 bg-secondary/20 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => navigate('strategy-detail', a.strategy_id)} className="truncate text-[12px] font-semibold hover:text-primary hover:underline">
                    {strategyById.get(a.strategy_id)?.name ?? 'Unknown strategy'}
                  </button>
                  <p className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                    {accountById.get(a.account_id)?.name ?? 'Unknown account'} · priority {a.priority}
                  </p>
                </div>
                {canWrite && (
                  <button
                    type="button"
                    onClick={async () => {
                      await setAssignmentEnabled(a.id, !a.enabled);
                      toast.success(a.enabled ? 'Assignment disabled' : 'Assignment enabled (still inert in Phase 1)');
                      refresh();
                    }}
                    className="shrink-0"
                  >
                    <StatusBadge value={a.enabled ? 'ENABLED' : 'DISABLED'} tone={a.enabled ? 'warn' : 'neutral'} />
                  </button>
                )}
                {isOwner && (
                  <button
                    type="button" onClick={() => setRemoveId(a.id)} aria-label="Remove assignment"
                    className="shrink-0 rounded-md border border-border p-2 text-muted-foreground transition-colors hover:border-rose-500/50 hover:text-rose-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <ConfirmDialog
        open={!!removeId}
        onOpenChange={(o) => !o && setRemoveId(null)}
        title="Remove this assignment?"
        description="This unlinks the strategy from the account. Sequences and trades that reference the strategy are retained."
        confirmLabel="Remove assignment"
        destructive
        onConfirm={async () => {
          if (!removeId) return;
          await removeAssignment(removeId);
          toast.success('Assignment removed');
          setRemoveId(null);
          refresh();
        }}
      />
    </div>
  );
};
