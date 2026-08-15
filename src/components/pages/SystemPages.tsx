import React, { useMemo, useState } from 'react';
import { Activity, Clock, Cog, Rocket, Save, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { usePlatform } from '@/contexts/PlatformContext';
import { EmptyState, Field, NoticeBanner, PageHeader, SectionCard, SimBadge, StatCard, StatusBadge } from '@/components/shared/Primitives';
import { FilterBar, LoadingRows } from '@/components/shared/Controls';
import { EventFeed } from '@/components/shared/RecordCards';
import { EVENT_TYPES } from '@/services/systemEventService';
import { buildGrowthLadder, updateGrowthJourney, updateProfileRole, upsertSetting } from '@/services/settingsService';
import { FUTURE_ENGINES } from '@/services/futureEngines';
import { dateTime, money, pnlTone, signedMoney } from '@/lib/format';
import type { Role } from '@/lib/types';

/* ------------------------------ System events ------------------------------ */

export const SystemEventsPage: React.FC = () => {
  const { data, dataLoading } = usePlatform();
  const [search, setSearch] = useState('');
  const [type, setType] = useState('ALL');
  const [severity, setSeverity] = useState('ALL');

  const filtered = useMemo(() => data.events.filter((e) => {
    const q = search.toLowerCase();
    return (!q || e.message.toLowerCase().includes(q) || e.event_type.toLowerCase().includes(q))
      && (type === 'ALL' || e.event_type === type) && (severity === 'ALL' || e.severity === severity);
  }), [data.events, search, type, severity]);

  return (
    <div>
      <PageHeader
        title="System Events"
        subtitle="Append-only audit journal. Every meaningful action writes a human-readable event here."
      />

      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: 'Search event messages…' }}
        filters={[
          { id: 'type', label: 'Type', options: [...EVENT_TYPES], value: type, onChange: setType },
          { id: 'sev', label: 'Severity', options: ['INFO', 'SUCCESS', 'WARNING', 'ERROR', 'CRITICAL'], value: severity, onChange: setSeverity },
        ]}
      />

      {dataLoading ? <LoadingRows /> : filtered.length === 0 ? (
        <EmptyState icon={Activity} title="No events match" description="Adjust the filters to see more of the journal." />
      ) : (
        <SectionCard title={`Journal (${filtered.length})`} icon={Clock}>
          <EventFeed events={filtered} />
        </SectionCard>
      )}
    </div>
  );
};

/* ------------------------------ Growth journey ----------------------------- */

export const GrowthJourneyPage: React.FC = () => {
  const { data, refresh, canWrite } = usePlatform();
  const growth = data.growth;
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ current_level: 1, actual_balance: 0, notes: '' });

  React.useEffect(() => {
    if (growth) {
      setForm({
        current_level: growth.current_level,
        actual_balance: Number(growth.actual_balance),
        notes: growth.notes ?? '',
      });
    }
  }, [growth]);

  const paperEquity = data.paperAccounts.reduce((s, p) => s + Number(p.current_equity), 0);
  const ladder = useMemo(
    () => growth ? buildGrowthLadder(Number(growth.starting_balance), Number(growth.target_balance), growth.target_level) : [],
    [growth],
  );

  if (!growth) {
    return (
      <div>
        <PageHeader title="Growth Journey" subtitle="Reference projection only." />
        <EmptyState icon={TrendingUp} title="No growth journey record" description="A reference record is created with your demo workspace." />
      </div>
    );
  }

  const currentTarget = ladder.find((l) => l.level === growth.current_level)?.referenceBalance ?? Number(growth.starting_balance);
  const nextTarget = ladder.find((l) => l.level === growth.current_level + 1)?.referenceBalance ?? Number(growth.target_balance);
  const progress = Math.max(0, Math.min(100, (growth.current_level / growth.target_level) * 100));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Growth Journey"
        subtitle="A reference progression curve for reporting and motivation."
        action={<SimBadge label="SIMULATION / REFERENCE" />}
      />

      <NoticeBanner tone="warn" title="GROWTH JOURNEY — SIMULATION / REFERENCE" icon={ShieldCheck}>
        This projection is presentation data. It is never read by the paper simulator and will never be read by the
        Risk Engine. No value on this page can become execution risk or influence a position size.
      </NoticeBanner>

      <SectionCard title="Progress" icon={TrendingUp}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard label="Current level" value={`${growth.current_level} / ${growth.target_level}`} />
          <StatCard label="Level target" value={money(currentTarget)} sub="reference curve" />
          <StatCard label="Next level target" value={money(nextTarget)} sub="reference curve" />
          <StatCard label="Pace" value={<StatusBadge value={growth.pace} />} />
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>Level {growth.current_level}</span>
            <span>{progress.toFixed(0)}% of the reference journey</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all duration-700" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Theoretical Reference Curve" icon={Rocket} description="Illustrative only — separate from actual paper equity.">
          <ol className="scroll-thin max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {ladder.map((l) => (
              <li
                key={l.level}
                className={`flex items-center justify-between rounded-md border px-2.5 py-1.5 text-[11px] ${
                  l.level === growth.current_level ? 'border-primary/50 bg-primary/10' : 'border-border/60 bg-secondary/20'
                }`}
              >
                <span className="font-semibold">Level {l.level}</span>
                <span className="num text-muted-foreground">{money(l.referenceBalance)}</span>
              </li>
            ))}
          </ol>
        </SectionCard>

        <SectionCard title="Actual Paper Equity" icon={Activity} description="Measured from the paper ledger — the honest number.">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Simulated equity across paper accounts" value={money(paperEquity)} mono />
            <Field label="Recorded actual balance" value={money(growth.actual_balance)} mono />
            <Field label="Reference target for this level" value={money(currentTarget)} mono />
            <Field
              label="Difference vs reference"
              value={<span className={pnlTone(paperEquity - currentTarget)}>{signedMoney(paperEquity - currentTarget)}</span>}
              mono
            />
          </div>

          {canWrite && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await updateGrowthJourney(growth.id, {
                    current_level: form.current_level,
                    actual_balance: form.actual_balance,
                    notes: form.notes,
                  });
                  toast.success('Growth journey updated — sizing is unaffected');
                  refresh();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Could not update the growth journey');
                } finally {
                  setBusy(false);
                }
              }}
              className="mt-4 space-y-3 border-t border-border/60 pt-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="gj-level" className="text-xs">Current level</Label>
                  <Input id="gj-level" type="number" min={1} max={growth.target_level} value={form.current_level} onChange={(e) => setForm({ ...form, current_level: Number(e.target.value) })} className="num h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gj-balance" className="text-xs">Actual balance</Label>
                  <Input id="gj-balance" type="number" step="0.01" value={form.actual_balance} onChange={(e) => setForm({ ...form, actual_balance: Number(e.target.value) })} className="num h-11" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gj-notes" className="text-xs">Notes</Label>
                <Textarea id="gj-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
              <Button type="submit" disabled={busy} className="h-11 w-full font-semibold">{busy ? 'Saving…' : 'Save reference values'}</Button>
            </form>
          )}
        </SectionCard>
      </div>
    </div>
  );
};

/* --------------------------------- Settings -------------------------------- */

export const SettingsPage: React.FC = () => {
  const { data, profile, refresh, isOwner, signOut } = usePlatform();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const save = async (key: string, description: string | null) => {
    setBusyKey(key);
    try {
      const parsed = JSON.parse(drafts[key]);
      await upsertSetting(profile!.workspace_id, profile!.id, key, parsed, description ?? undefined);
      toast.success(`Setting "${key}" saved`);
      refresh();
    } catch (err) {
      toast.error(err instanceof SyntaxError ? 'That is not valid JSON.' : err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" subtitle="Workspace configuration, roles and platform phase status." />

      <SectionCard title="Your Profile" icon={Users}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Name" value={profile?.full_name ?? 'Not set'} />
          <Field label="Email" value={profile?.email ?? '—'} />
          <Field label="Role" value={<StatusBadge value={profile?.role?.toUpperCase()} tone={profile?.role === 'owner' ? 'good' : 'info'} />} />
          <Field label="Workspace" value={profile?.workspace_id?.slice(0, 8) ?? '—'} mono />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => signOut()} className="h-10">Sign out</Button>
        </div>
      </SectionCard>

      <SectionCard title="Roles & Access" icon={ShieldCheck} description="Enforced by database row-level security, not by this interface.">
        <ul className="space-y-2">
          {[
            { role: 'OWNER', detail: 'Full access. Manages accounts, strategies, risk profiles and settings, and performs archive actions.' },
            { role: 'ADMIN', detail: 'Manages accounts, strategies, risk profiles and paper records. No owner-only destructive or security actions.' },
            { role: 'VIEWER', detail: 'Read-only. Every write policy excludes this role at the database level.' },
          ].map((r) => (
            <li key={r.role} className="rounded-lg border border-border/70 bg-secondary/20 p-2.5">
              <div className="flex items-center gap-2">
                <StatusBadge value={r.role} tone={r.role === 'OWNER' ? 'good' : r.role === 'ADMIN' ? 'info' : 'neutral'} />
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{r.detail}</p>
            </li>
          ))}
        </ul>

        {data.team.length > 0 && (
          <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
            <p className="label-caps">Workspace members</p>
            {data.team.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-secondary/20 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold">{m.full_name || m.email}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{m.email}</p>
                </div>
                {isOwner && m.id !== profile?.id ? (
                  <select
                    aria-label={`Role for ${m.email}`}
                    value={m.role}
                    onChange={async (e) => {
                      await updateProfileRole(m.id, e.target.value as Role);
                      toast.success('Role updated');
                      refresh();
                    }}
                    className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="owner">owner</option>
                    <option value="admin">admin</option>
                    <option value="viewer">viewer</option>
                  </select>
                ) : (
                  <StatusBadge value={m.role.toUpperCase()} />
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Platform Configuration" icon={Cog} description="Non-sensitive values only.">
        <NoticeBanner tone="warn" title="Never stored here">
          Broker passwords, MT5 master or investor passwords, private API keys and endpoint secrets are never written
          to ordinary database fields. When the Phase 5 bridge arrives its credentials belong in server-side secret
          storage. Keys containing password, secret, token or api key are rejected outright.
        </NoticeBanner>

        <ul className="mt-3 space-y-3">
          {data.settings.map((s) => (
            <li key={s.id} className="rounded-lg border border-border/70 bg-secondary/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="num text-[12px] font-semibold text-primary">{s.setting_key}</p>
                <span className="text-[10px] text-muted-foreground">{dateTime(s.updated_at)}</span>
              </div>
              {s.description && <p className="mt-0.5 text-[11px] text-muted-foreground">{s.description}</p>}
              {isOwner ? (
                <div className="mt-2 space-y-2">
                  <Label htmlFor={`set-${s.id}`} className="sr-only">Value for {s.setting_key}</Label>
                  <Textarea
                    id={`set-${s.id}`}
                    value={drafts[s.setting_key] ?? JSON.stringify(s.setting_value, null, 2)}
                    onChange={(e) => setDrafts({ ...drafts, [s.setting_key]: e.target.value })}
                    rows={2}
                    className="num text-[11px]"
                    spellCheck={false}
                  />
                  <Button
                    onClick={() => save(s.setting_key, s.description)}
                    disabled={busyKey === s.setting_key}
                    variant="outline"
                    className="h-9 text-xs"
                  >
                    <Save className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                    {busyKey === s.setting_key ? 'Saving…' : 'Save value'}
                  </Button>
                </div>
              ) : (
                <pre className="num mt-2 overflow-x-auto rounded bg-background/60 p-2 text-[10px]">{JSON.stringify(s.setting_value, null, 2)}</pre>
              )}
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="Roadmap & Insertion Points" icon={Rocket} description="Declared in services/futureEngines.ts — declared, not implemented.">
        <ul className="space-y-2">
          {FUTURE_ENGINES.map((e) => (
            <li key={e.key} className="rounded-lg border border-border/70 bg-secondary/20 p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold">{e.label}</p>
                  <p className="num text-[10px] text-muted-foreground">{e.key}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusBadge value={e.phase.toUpperCase()} tone="draft" />
                  <StatusBadge value={e.status.replace(/_/g, ' ')} tone="neutral" />
                </div>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{e.description}</p>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
};
