import type { Symbol as TradingSymbol } from './types';

export function money(value: number | null | undefined, currency = 'USD'): string {
  const n = Number(value ?? 0);
  const sign = n < 0 ? '-' : '';
  return `${sign}${currency === 'USD' ? '$' : ''}${Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}${currency === 'USD' ? '' : ' ' + currency}`;
}

export function signedMoney(value: number | null | undefined, currency = 'USD'): string {
  const n = Number(value ?? 0);
  if (n > 0) return `+${money(n, currency)}`;
  return money(n, currency);
}

export function pct(value: number | null | undefined, digits = 2): string {
  return `${Number(value ?? 0).toFixed(digits)}%`;
}

export function lots(value: number | null | undefined): string {
  return Number(value ?? 0).toFixed(2);
}

export function price(value: number | null | undefined, symbol?: TradingSymbol | null): string {
  if (value === null || value === undefined) return '—';
  const digits = symbol?.digits ?? 5;
  return Number(value).toFixed(digits);
}

export function relTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function humanise(token: string | null | undefined): string {
  if (!token) return '—';
  return token
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function pnlTone(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  if (n > 0) return 'text-emerald-400';
  if (n < 0) return 'text-rose-400';
  return 'text-muted-foreground';
}

/**
 * Simulated profit/loss for a paper position.
 * Deliberately simple, deliberately transparent: contract-size based, no swap,
 * no commission, no broker margin model. This is NOT a broker calculation.
 */
export function simulatedPnl(
  side: 'BUY' | 'SELL',
  volume: number,
  entry: number,
  current: number,
  symbol?: TradingSymbol | null,
): number {
  const contract = symbol?.contract_size ?? 100000;
  const delta = side === 'BUY' ? current - entry : entry - current;
  const quoteMove = delta * volume * contract;
  // USDJPY-style quote conversion is intentionally approximated for the simulator.
  if (symbol?.quote_asset && symbol.quote_asset !== 'USD' && current > 0) {
    return Math.round((quoteMove / current) * 100) / 100;
  }
  return Math.round(quoteMove * 100) / 100;
}
