import React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/* --------------------------------- SearchBar ------------------------------- */

export const SearchBar: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id?: string;
}> = ({ value, onChange, placeholder = 'Search…', id = 'search' }) => (
  <div className="relative flex-1 min-w-[9rem]">
    <label htmlFor={id} className="sr-only">{placeholder}</label>
    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
    <Input
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-10 bg-secondary/50 pl-8 pr-8 text-sm"
    />
    {value && (
      <button
        type="button"
        onClick={() => onChange('')}
        aria-label="Clear search"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    )}
  </div>
);

/* --------------------------------- FilterBar ------------------------------- */

export interface FilterDef {
  id: string;
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}

export const FilterBar: React.FC<{
  search?: { value: string; onChange: (v: string) => void; placeholder?: string };
  filters?: FilterDef[];
  trailing?: React.ReactNode;
}> = ({ search, filters = [], trailing }) => (
  <div className="mb-4 space-y-2">
    {(search || trailing) && (
      <div className="flex items-center gap-2">
        {search && <SearchBar value={search.value} onChange={search.onChange} placeholder={search.placeholder} />}
        {trailing}
      </div>
    )}
    {filters.length > 0 && (
      <div className="scroll-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {filters.map((f) => (
          <div key={f.id} className="shrink-0">
            <label htmlFor={`filter-${f.id}`} className="sr-only">{f.label}</label>
            <select
              id={`filter-${f.id}`}
              value={f.value}
              onChange={(e) => f.onChange(e.target.value)}
              className={cn(
                'h-9 rounded-md border border-border bg-secondary/50 px-2.5 text-xs font-medium',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                f.value !== 'ALL' && 'border-primary/50 text-primary',
              )}
            >
              <option value="ALL">{f.label}: All</option>
              {f.options.map((o) => (
                <option key={o} value={o}>{f.label}: {o.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    )}
  </div>
);

/* ------------------------------ MobileRecordCard --------------------------- */

export const MobileRecordCard: React.FC<{
  title: React.ReactNode;
  badge?: React.ReactNode;
  meta?: React.ReactNode;
  onClick?: () => void;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  accent?: 'default' | 'buy' | 'sell';
}> = ({ title, badge, meta, onClick, children, footer, accent = 'default' }) => {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      {...(onClick ? { onClick, type: 'button' as const } : {})}
      className={cn(
        'panel group relative w-full overflow-hidden p-3 text-left transition-all',
        onClick && 'hover:border-primary/45 hover:bg-card active:scale-[0.995]',
      )}
    >
      {accent !== 'default' && (
        <span className={cn('absolute inset-y-0 left-0 w-0.5', accent === 'buy' ? 'bg-emerald-500' : 'bg-rose-500')} />
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold leading-snug">{title}</div>
          {meta && <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{meta}</div>}
        </div>
        {badge}
      </div>
      {children && <div className="mt-2.5">{children}</div>}
      {footer && <div className="mt-2.5 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">{footer}</div>}
    </Wrapper>
  );
};

/* -------------------------------- RecordTable ------------------------------ */
/** Desktop-only tabular view. Mobile always uses card lists instead. */

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
}

export function RecordTable<T extends { id: string }>({
  rows, columns, onRowClick,
}: { rows: T[]; columns: Column<T>[]; onRowClick?: (row: T) => void }) {
  return (
    <div className="hidden overflow-x-auto lg:block">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cn('label-caps px-3 py-2 text-left', c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                'border-b border-border/50 transition-colors',
                onRowClick && 'cursor-pointer hover:bg-secondary/40',
              )}
            >
              {columns.map((c) => (
                <td key={c.key} className={cn('px-3 py-2.5 align-middle', c.className)}>{c.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------- ConfirmDialog ----------------------------- */

export const ConfirmDialog: React.FC<{
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}> = ({ open, onOpenChange, title, description, confirmLabel = 'Confirm', destructive, onConfirm }) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent className="max-w-[92vw] rounded-xl sm:max-w-md">
      <AlertDialogHeader>
        <AlertDialogTitle className="text-base">{title}</AlertDialogTitle>
        <AlertDialogDescription className="text-xs leading-relaxed">{description}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="gap-2">
        <AlertDialogCancel className="h-10 text-sm">Cancel</AlertDialogCancel>
        <AlertDialogAction
          onClick={onConfirm}
          className={cn('h-10 text-sm', destructive && 'bg-amber-600 text-white hover:bg-amber-500')}
        >
          {confirmLabel}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

/* --------------------------------- LoadingRow ------------------------------ */

export const LoadingRows: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="space-y-2" aria-busy="true" aria-live="polite">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="h-20 animate-pulse rounded-xl border border-border bg-card/60" />
    ))}
  </div>
);

export const ActionButton: React.FC<{
  onClick: () => void;
  children: React.ReactNode;
  loading?: boolean;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'default';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
}> = ({ onClick, children, loading, variant = 'default', size = 'default', className, disabled, type = 'button' }) => (
  <Button
    type={type}
    variant={variant}
    onClick={onClick}
    disabled={disabled || loading}
    className={cn(size === 'sm' ? 'h-9 px-3 text-xs' : 'h-10 px-4 text-sm', 'font-semibold', className)}
  >
    {loading ? 'Working…' : children}
  </Button>
);
