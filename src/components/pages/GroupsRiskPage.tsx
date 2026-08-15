import React, { useMemo, useState } from 'react';
import { Boxes, Gauge, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { usePlatform } from '@/contexts/PlatformContext';
import { EmptyState, NoticeBanner, PageHeader, SectionCard, StatusBadge } from '@/components/shared/Primitives';
import { ConfirmDialog, FilterBar, LoadingRows } from '@/components/shared/Controls';
import { RiskProfileCard } from '@/components/shared/RecordCards';
import type { RiskProfile } from '@/lib/types';
import {
  addGroupMember, archiveRiskProfile, createGroup, createRiskProfile, removeGroupMember, updateRiskProfile,
} from '@/services/accountService';

/* ------------------------------ Account groups ----------------------------- */

export const AccountGroupsPage: React.FC = () => {
  const { data, dataLoading, refresh, canWrite, isOwner, profile } = usePlatform();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [addTo, setAddTo] = useState<string | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const groups = useMemo(
    () => data.groups.filter((g) => !search || g.name.toLowerCase().includes(search.toLowerCase())),
    [data.groups, search],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !name.trim()) return;
    setBusy(true);
    try {
      await createGroup(profile.workspace_id, name.trim(), description.trim());

      toast.success('Account group created');
      setOpen(false); setName(''); setDescription('');
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create the group');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Account Groups"
        subtitle="Group accounts so a future signal can be copied to several at once, with shared risk configuration and per-account multipliers."
        action={canWrite && (
          <Button onClick={() => setOpen(true)} className="h-10 font-semibold">
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" /> New group
          </Button>
        )}
      />

      <FilterBar search={{ value: search, onChange: setSearch, placeholder: 'Search groups…' }} />

      {dataLoading ? <LoadingRows /> : groups.length === 0 ? (
        <EmptyState icon={Boxes} title="No account groups" description="Create a group to organise accounts by risk posture or signal source." />
      ) : (
        <div className="space-y-3">
          {groups.map((g) => {
            const members = data.groupMembers.filter((m) => m.group_id === g.id);
            const available = data.accounts.filter(
              (a) => a.status !== 'ARCHIVED' && !members.some((m) => m.account_id === a.id),
            );
            return (
              <SectionCard
                key={g.id}
                title={g.name}
                icon={Boxes}
                description={g.description ?? undefined}
                action={<StatusBadge value={g.status} />}
              >
                {members.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">No accounts in this group yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {members.map((m) => {
                      const acc = data.accounts.find((a) => a.id === m.account_id);
                      return (
                        <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-secondary/20 px-3 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-[12px] font-semibold">{acc?.name ?? 'Unknown account'}</p>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              {acc?.account_mode} · risk multiplier {Number(m.risk_multiplier).toFixed(2)}
                            </p>
                          </div>
                          {isOwner && (
                            <button
                              type="button" onClick={() => setRemoveId(m.id)} aria-label={`Remove ${acc?.name} from ${g.name}`}
                              className="rounded-md border border-border p-2 text-muted-foreground transition-colors hover:border-rose-500/50 hover:text-rose-300"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {canWrite && available.length > 0 && (
                  <div className="mt-3 flex gap-2">
                    <label htmlFor={`add-${g.id}`} className="sr-only">Add account to {g.name}</label>
                    <select
                      id={`add-${g.id}`}
                      value={addTo === g.id ? '' : ''}
                      onChange={async (e) => {
                        if (!e.target.value) return;
                        setAddTo(g.id);
                        try {
                          await addGroupMember(g.workspace_id, g.id, e.target.value);
                          toast.success('Account added to group');
                          refresh();
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'Could not add the account');
                        } finally {
                          setAddTo(null);
                        }
                      }}
                      className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-xs"
                    >
                      <option value="">Add an account to this group…</option>
                      {available.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                )}
              </SectionCard>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[94vw] rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">New account group</DialogTitle>
            <DialogDescription className="text-[11px]">Groups are organisational only in Phase 1.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="grp-name" className="text-xs">Group name</Label>
              <Input id="grp-name" required value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="grp-desc" className="text-xs">Description</Label>
              <Textarea id="grp-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="h-11 flex-1">Cancel</Button>
              <Button type="submit" disabled={busy} className="h-11 flex-1 font-semibold">{busy ? 'Saving…' : 'Create group'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!removeId}
        onOpenChange={(o) => !o && setRemoveId(null)}
        title="Remove account from group?"
        description="This unlinks the account from the group. No account, trade, sequence or event record is deleted."
        confirmLabel="Remove from group"
        destructive
        onConfirm={async () => {
          if (!removeId) return;
          await removeGroupMember(removeId);
          toast.success('Account removed from group');
          setRemoveId(null);
          refresh();
        }}
      />
    </div>
  );
};

/* ------------------------------ Risk profiles ------------------------------ */

const DEFAULTS = {
  name: '', description: '', risk_per_setup: 0.25, risk_per_hedge: 0.15, max_daily_loss: 1,
  max_weekly_drawdown: 2, max_monthly_drawdown: 4, max_open_positions: 2, max_hedge_tiers: 1,
  max_total_exposure: 1, max_correlated_exposure: 0.5, max_margin_utilization: 10,
  news_mode: 'BLOCK' as 'BLOCK' | 'REDUCE' | 'ALLOW',
};

const NUMERIC_FIELDS: Array<{ key: keyof typeof DEFAULTS; label: string; step: number; max: number }> = [
  { key: 'risk_per_setup', label: 'Risk per setup (%)', step: 0.05, max: 5 },
  { key: 'risk_per_hedge', label: 'Risk per hedge (%)', step: 0.05, max: 5 },
  { key: 'max_daily_loss', label: 'Max daily loss (%)', step: 0.25, max: 20 },
  { key: 'max_weekly_drawdown', label: 'Max weekly DD (%)', step: 0.25, max: 30 },
  { key: 'max_monthly_drawdown', label: 'Max monthly DD (%)', step: 0.25, max: 40 },
  { key: 'max_open_positions', label: 'Max open positions', step: 1, max: 50 },
  { key: 'max_hedge_tiers', label: 'Max hedge tiers', step: 1, max: 5 },
  { key: 'max_total_exposure', label: 'Max total exposure (%)', step: 0.25, max: 50 },
  { key: 'max_correlated_exposure', label: 'Max correlated exposure (%)', step: 0.25, max: 50 },
  { key: 'max_margin_utilization', label: 'Max margin utilisation (%)', step: 1, max: 100 },
];

export const RiskProfilesPage: React.FC = () => {
  const { data, dataLoading, refresh, canWrite, isOwner, profile: me } = usePlatform();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RiskProfile | null>(null);
  const [form, setForm] = useState(DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<RiskProfile | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');

  const profiles = useMemo(() => data.riskProfiles.filter((p) => {
    const q = search.toLowerCase();
    return (!q || p.name.toLowerCase().includes(q)) && (status === 'ALL' || p.status === status);
  }), [data.riskProfiles, search, status]);

  const openForm = (profile: RiskProfile | null) => {
    setEditing(profile);
    setForm(profile ? {
      name: profile.name, description: profile.description ?? '',
      risk_per_setup: Number(profile.risk_per_setup), risk_per_hedge: Number(profile.risk_per_hedge),
      max_daily_loss: Number(profile.max_daily_loss), max_weekly_drawdown: Number(profile.max_weekly_drawdown),
      max_monthly_drawdown: Number(profile.max_monthly_drawdown), max_open_positions: profile.max_open_positions,
      max_hedge_tiers: profile.max_hedge_tiers, max_total_exposure: Number(profile.max_total_exposure),
      max_correlated_exposure: Number(profile.max_correlated_exposure),
      max_margin_utilization: Number(profile.max_margin_utilization), news_mode: profile.news_mode,
    } : DEFAULTS);
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing) {
        await updateRiskProfile(editing.id, form);
        toast.success('Risk configuration updated');
      } else {
        if (!me) return;
        await createRiskProfile(me.workspace_id, form);

        toast.success('Risk profile stored as configuration');
        window.supercool?.track('form_submit', { form: 'create_risk_profile' });
      }
      setOpen(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the risk profile');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Risk Profiles"
        subtitle="Configuration records consumed by the Phase 2 Risk Engine. Phase 1 performs no live risk calculation — the only limit enforced today is max hedge tiers inside the paper simulator."
        action={canWrite && (
          <Button onClick={() => openForm(null)} className="h-10 font-semibold">
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" /> New profile
          </Button>
        )}
      />

      <div className="mb-4">
        <NoticeBanner tone="warn" title="Configuration, not execution" icon={ShieldAlert}>
          These values are stored, displayed and version-controlled. Nothing on this screen sizes a position, and no
          dashboard or growth-journey number can become execution risk.
        </NoticeBanner>
      </div>

      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: 'Search risk profiles…' }}
        filters={[{ id: 'status', label: 'Status', options: ['ACTIVE', 'INACTIVE', 'ARCHIVED'], value: status, onChange: setStatus }]}
      />

      {dataLoading ? <LoadingRows /> : profiles.length === 0 ? (
        <EmptyState icon={Gauge} title="No risk profiles" description="Create a conservative configuration to attach to your accounts." />
      ) : (
        <div className="space-y-3">
          {profiles.map((p) => (
            <RiskProfileCard
              key={p.id}
              profile={p}
              usedBy={data.accounts.filter((a) => a.risk_profile_id === p.id).length}
              onEdit={canWrite ? () => openForm(p) : undefined}
              onArchive={isOwner ? () => setArchiveTarget(p) : undefined}
            />
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-[94vw] overflow-y-auto rounded-xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">{editing ? 'Edit risk configuration' : 'New risk profile'}</DialogTitle>
            <DialogDescription className="text-[11px]">
              Stored as configuration only. Trading remains disabled on every profile in Phase 1.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="rp-name" className="text-xs">Profile name</Label>
              <Input id="rp-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rp-desc" className="text-xs">Description</Label>
              <Textarea id="rp-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {NUMERIC_FIELDS.map((f) => (
                <div key={String(f.key)} className="space-y-1.5">
                  <Label htmlFor={`rp-${String(f.key)}`} className="text-[11px]">{f.label}</Label>
                  <Input
                    id={`rp-${String(f.key)}`} type="number" min={0} max={f.max} step={f.step}
                    value={form[f.key] as number}
                    onChange={(e) => setForm({ ...form, [f.key]: Number(e.target.value) })}
                    className="num h-11"
                  />
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rp-news" className="text-xs">News mode</Label>
              <select
                id="rp-news" value={form.news_mode}
                onChange={(e) => setForm({ ...form, news_mode: e.target.value as 'BLOCK' | 'REDUCE' | 'ALLOW' })}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="BLOCK">BLOCK — stand down around high-impact news</option>
                <option value="REDUCE">REDUCE — reduce exposure around news</option>
                <option value="ALLOW">ALLOW — no news restriction</option>
              </select>
            </div>
            <NoticeBanner title="Hedge tiers are a hard cap">
              The paper simulator refuses any hedge above this number and shows HEDGE TIER LIMIT REACHED. There is no
              martingale, doubling or unlimited recovery anywhere in this platform.
            </NoticeBanner>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="h-11 flex-1">Cancel</Button>
              <Button type="submit" disabled={busy} className="h-11 flex-1 font-semibold">{busy ? 'Saving…' : 'Save configuration'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!archiveTarget}
        onOpenChange={(o) => !o && setArchiveTarget(null)}
        title="Archive this risk profile?"
        description="The profile is marked ARCHIVED and stays linked to any account that used it. Nothing is deleted."
        confirmLabel="Archive profile"
        destructive
        onConfirm={async () => {
          if (!archiveTarget) return;
          await archiveRiskProfile(archiveTarget.id, archiveTarget.name);
          toast.success('Risk profile archived');
          setArchiveTarget(null);
          refresh();
        }}
      />
    </div>
  );
};
