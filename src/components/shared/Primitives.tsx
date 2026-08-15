import React from 'react';
import { cn } from '@/lib/utils';
import { humanise } from '@/lib/format';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

/* ------------------------------- StatusBadge ------------------------------- */

type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'info' | 'draft';

const TONE_MAP: Record<string, Tone> = {
  ACTIVE: 'good', READY: 'good', APPROVED: 'good', SUCCESS: 'good', OPEN: 'good',
  FILLED: 'good', RECOVERYCOMPLETE: 'good', AHEAD: 'good', ON_TRACK: 'good', NORMAL: 'good',
  WATCH: 'warn', WARNING: 'warn', PENDING: 'warn', THROTTLED: 'warn', CONFIRMING: 'warn',
  HEDGETRIGGERED: 'warn', PLANNED: 'warn', PAUSED: 'warn', REDUCED: 'warn', BEHIND: 'warn',
  PARTIALLY_CLOSED: 'warn', TESTING: 'warn', REDUCEPRIMARY: 'warn', FOLLOWHEDGE: 'warn',
  HEDGED: 'info', PAPER: 'info', INFO: 'info', EXECUTED: 'info', SIGNALCOPY: 'info',
  ERROR: 'bad', CRITICAL: 'bad', REJECTED: 'bad', FAILED: 'bad', LOCKED: 'bad', EMERGENCY: 'bad',
  INACTIVE: 'neutral', ARCHIVED: 'neutral', CLOSED: 'neutral', CANCELLED: 'neutral',
  EXPIRED: 'neutral', NOT_CONNECTED: 'neutral', OFFLINE: 'neutral', NOT_AVAILABLE: 'neutral',
  DRAFT: 'draft',
};

const TONE_CLASS: Record<Tone, string> = {
  good: 'bg-emerald-500/12 text-emerald-300 border-emerald-500/30',
  warn: 'bg-amber-500/12 text-amber-300 border-amber-500/30',
  bad: 'bg-rose-500/12 text-rose-300 border-rose-500/30',
  info: 'bg-sky-500/12 text-sky-300 border-sky-500/30',
  draft: 'bg-violet-500/12 text-violet-300 border-violet-500/30',
  neutral: 'bg-slate-500/12 text-slate-300 border-slate-500/25',
};

export const StatusBadge: React.FC<{ value?: string | null; tone?: Tone; className?: string; dot?: boolean }> = ({
  value, tone, className, dot,
}) => {
  const key = (value ?? '').toUpperCase();
  const resolved: Tone = tone ?? TONE_MAP[key] ?? 'neutral';
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
        TONE_CLASS[resolved], className,
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full bg-current', resolved === 'good' && 'animate-dot')} />}
      {value ? value.replace(/_/g, ' ') : '—'}
    </span>
  );
};

/* --------------------------------- SimBadge -------------------------------- */

export const SimBadge: React.FC<{ label?: string; className?: string }> = ({ label = 'PAPER / SIMULATED', className }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded border border-dashed border-amber-500/45 bg-amber-500/8 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-amber-300/90',
      className,
    )}
  >
    <ShieldCheck className="h-2.5 w-2.5" aria-hidden="true" />
    {label}
  </span>
);

/* --------------------------------- StatCard -------------------------------- */

export const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: LucideIcon;
  tone?: 'default' | 'good' | 'bad' | 'warn';
  simulated?: boolean;
}> = ({ label, value, sub, icon: Icon, tone = 'default', simulated }) => (
  <div className="panel flex min-w-0 flex-col gap-1 p-3 transition-colors hover:border-primary/35">
    <div className="flex items-center justify-between gap-2">
      <span className="label-caps truncate">{label}</span>
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
    </div>
    <span
      className={cn(
        'num truncate text-lg font-semibold leading-tight sm:text-xl',
        tone === 'good' && 'text-emerald-400',
        tone === 'bad' && 'text-rose-400',
        tone === 'warn' && 'text-amber-400',
      )}
    >
      {value}
    </span>
    {sub && <span className="truncate text-[11px] text-muted-foreground">{sub}</span>}
    {simulated && <SimBadge className="mt-0.5 self-start" />}
  </div>
);

/* ------------------------------- SectionCard ------------------------------- */

export const SectionCard: React.FC<{
  title: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  description?: string;
  children: React.ReactNode;
  className?: string;
}> = ({ title, icon: Icon, action, description, children, className }) => (
  <section className={cn('panel animate-rise', className)}>
    <header className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          {Icon && <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
          <span className="truncate">{title}</span>
        </h2>
        {description && <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
    <div className="p-4">{children}</div>
  </section>
);

/* -------------------------------- PageHeader ------------------------------- */

export const PageHeader: React.FC<{
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}> = ({ title, subtitle, action }) => (
  <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
    <div className="min-w-0">
      <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
      {subtitle && <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">{subtitle}</p>}
    </div>
    {action}
  </div>
);

/* -------------------------------- EmptyState ------------------------------- */

export const EmptyState: React.FC<{
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}> = ({ icon: Icon = AlertTriangle, title, description, action }) => (
  <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-10 text-center">
    <Icon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
    <p className="text-sm font-semibold">{title}</p>
    {description && <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{description}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>
);

/* ---------------------------------- Field ---------------------------------- */

export const Field: React.FC<{ label: string; value: React.ReactNode; mono?: boolean; className?: string }> = ({
  label, value, mono, className,
}) => (
  <div className={cn('min-w-0', className)}>
    <div className="label-caps">{label}</div>
    <div className={cn('mt-0.5 truncate text-sm', mono && 'num')}>{value ?? '—'}</div>
  </div>
);

/* ------------------------------- NoticeBanner ------------------------------ */

export const NoticeBanner: React.FC<{
  tone?: 'info' | 'warn';
  title: string;
  children?: React.ReactNode;
  icon?: LucideIcon;
}> = ({ tone = 'info', title, children, icon: Icon = AlertTriangle }) => (
  <div
    className={cn(
      'flex items-start gap-2.5 rounded-lg border px-3 py-2.5',
      tone === 'warn'
        ? 'border-amber-500/30 bg-amber-500/[0.06]'
        : 'border-sky-500/25 bg-sky-500/[0.05]',
    )}
  >
    <Icon
      className={cn('mt-0.5 h-4 w-4 shrink-0', tone === 'warn' ? 'text-amber-400' : 'text-sky-400')}
      aria-hidden="true"
    />
    <div className="min-w-0 text-[11px] leading-relaxed">
      <p className={cn('font-semibold uppercase tracking-wide', tone === 'warn' ? 'text-amber-300' : 'text-sky-300')}>
        {title}
      </p>
      {children && <div className="mt-0.5 text-muted-foreground">{children}</div>}
    </div>
  </div>
);

export { humanise };
