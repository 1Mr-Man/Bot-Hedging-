/**
 * RISK CHECK PREVIEW — READ ONLY.
 *
 * This module is a *preview* of the Phase 2 Risk Engine. It exists so an
 * operator can see, before simulating a position, which stored risk-profile
 * limits that position would eventually be measured against and whether the
 * draft would sit inside or outside each one.
 *
 * HARD BOUNDARIES — none of these may ever change:
 *   - It NEVER sizes a position. No lot size, no multiplier, no suggestion.
 *   - It NEVER approves, blocks or modifies anything. Nothing here is written
 *     to the database and no caller may gate an action on its output.
 *   - It is arithmetic over already-stored configuration and already-stored
 *     simulated positions, using the same transparent formula the paper
 *     simulator uses for P/L. It is not a broker margin model.
 *
 * The only limits actually enforced in Phase 1 remain the paper guard rails in
 * futureEngines.ts (max hedge tiers, symbol volume bounds, paused flag).
 */

import { simulatedPnl } from '@/lib/format';
import type {
  Direction, PaperAccount, PaperPosition, RiskProfile, Symbol as TradingSymbol, TradingAccount,
} from '@/lib/types';

export type PreviewVerdict = 'PASS' | 'FAIL' | 'NOT_MEASURABLE';

export interface RiskCheckRow {
  key: string;
  label: string;
  /** The stored configuration value this draft would be measured against. */
  limit: string;
  /** What the draft measures today, using the simulator's transparent formula. */
  measured: string;
  verdict: PreviewVerdict;
  /** One honest sentence explaining the verdict. */
  detail: string;
  /** 0..1 fill of the limit, for the meter. Null when nothing can be measured. */
  usage: number | null;
}

export interface RiskPreviewInput {
  riskProfile: RiskProfile | null;
  tradingAccount: TradingAccount | null;
  paperAccount: PaperAccount | null;
  symbol: TradingSymbol | null | undefined;
  side: Direction;
  volume: number;
  entryPrice: number;
  stopLoss: number | null;
  isHedge: boolean;
  /** Tier this draft would occupy. 0 for a primary leg. */
  requestedTier: number;
  /** Currently OPEN simulated positions on the same paper account. */
  openPositions: PaperPosition[];
  symbolFor: (symbolId: string) => TradingSymbol | null | undefined;
}

export interface RiskPreviewResult {
  /** True when there is enough draft detail to measure anything at all. */
  ready: boolean;
  /** Why the preview cannot measure yet (only set when ready is false). */
  blockedReason: string | null;
  rows: RiskCheckRow[];
  passCount: number;
  failCount: number;
  unknownCount: number;
  /** Open positions carrying no stop loss, so their risk cannot be measured. */
  unmeasuredPositions: number;
  equity: number;
  riskAmount: number | null;
  notional: number | null;
}

const EMPTY: RiskPreviewResult = {
  ready: false,
  blockedReason: null,
  rows: [],
  passCount: 0,
  failCount: 0,
  unknownCount: 0,
  unmeasuredPositions: 0,
  equity: 0,
  riskAmount: null,
  notional: null,
};

function fmtPct(value: number, digits = 2): string {
  return `${value.toFixed(digits)}%`;
}

function fmtMoney(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Approximate account-currency notional. Deliberately simple and disclosed as
 * an approximation: base-quoted USD pairs are taken at face value, everything
 * else is converted at the draft price. No broker contract specification is
 * consulted because Phase 1 has no broker connection.
 */
export function approxNotional(volume: number, price: number, symbol?: TradingSymbol | null): number {
  const contract = Number(symbol?.contract_size ?? 100000);
  const base = volume * contract;
  if (symbol?.base_asset === 'USD') return base;
  return base * (price > 0 ? price : 0);
}

/** Loss at the stop, in account currency, using the simulator's own P/L formula. */
function riskAtStop(
  side: Direction, volume: number, entry: number, stop: number, symbol?: TradingSymbol | null,
): number {
  return simulatedPnl(side, volume, entry, stop, symbol);
}

function verdictFor(measured: number, limit: number): PreviewVerdict {
  if (!Number.isFinite(limit) || limit <= 0) return 'NOT_MEASURABLE';
  return measured <= limit + 1e-9 ? 'PASS' : 'FAIL';
}

export function evaluateRiskPreview(input: RiskPreviewInput): RiskPreviewResult {
  const { riskProfile, tradingAccount, paperAccount, symbol, openPositions } = input;

  if (!paperAccount || !tradingAccount) {
    return { ...EMPTY, blockedReason: 'Select a paper account to preview its limits.' };
  }
  if (!riskProfile) {
    return {
      ...EMPTY,
      blockedReason: 'This trading account has no risk profile assigned, so there are no stored limits to measure against. Assign one on the Accounts screen.',
    };
  }
  if (!symbol || !(input.volume > 0) || !(input.entryPrice > 0)) {
    return {
      ...EMPTY,
      blockedReason: 'Choose a symbol and enter a simulated volume and entry price — the preview measures a draft, it never invents one.',
    };
  }

  const equity = Number(paperAccount.current_equity) || 0;
  const leverage = Number(tradingAccount.leverage) > 0 ? Number(tradingAccount.leverage) : 1;

  /* ---------------------------- candidate measures --------------------------- */

  const rawRisk = input.stopLoss && input.stopLoss > 0
    ? riskAtStop(input.side, input.volume, input.entryPrice, input.stopLoss, symbol)
    : null;
  const stopIsProtective = rawRisk !== null && rawRisk < 0;
  const riskAmount = stopIsProtective ? Math.abs(rawRisk as number) : null;
  const riskPct = riskAmount !== null && equity > 0 ? (riskAmount / equity) * 100 : null;

  const notional = approxNotional(input.volume, input.entryPrice, symbol);
  const marginNeeded = notional / leverage;

  /* ----------------------------- book aggregates ----------------------------- */

  let openRisk = 0;
  let unmeasuredPositions = 0;
  let openMargin = 0;
  let correlatedRisk = 0;
  let correlatedLegs = 0;

  const candidateBase = symbol.base_asset ?? symbol.broker_symbol;
  const candidateQuote = symbol.quote_asset ?? '';

  for (const p of openPositions) {
    const s = input.symbolFor(p.symbol_id);
    const legNotional = approxNotional(Number(p.volume), Number(p.current_price) || Number(p.entry_price), s);
    openMargin += legNotional / leverage;

    let legRisk: number | null = null;
    if (p.stop_loss && p.stop_loss > 0) {
      const value = riskAtStop(p.side, Number(p.volume), Number(p.entry_price), Number(p.stop_loss), s);
      if (value < 0) legRisk = Math.abs(value);
    }
    if (legRisk === null) {
      unmeasuredPositions += 1;
    } else {
      openRisk += legRisk;
    }

    const sameGroup = s
      ? (s.base_asset ?? s.broker_symbol) === candidateBase
        || (candidateQuote !== '' && s.quote_asset === candidateQuote)
        || s.id === symbol.id
      : false;
    if (sameGroup) {
      correlatedLegs += 1;
      if (legRisk !== null) correlatedRisk += legRisk;
    }
  }

  const rows: RiskCheckRow[] = [];

  /* ------------------------------ risk per setup ----------------------------- */

  const perSetupLimit = Number(input.isHedge ? riskProfile.risk_per_hedge : riskProfile.risk_per_setup);
  const perSetupLabel = input.isHedge ? 'Risk per hedge' : 'Risk per setup';
  if (riskPct === null) {
    rows.push({
      key: 'risk_per_setup',
      label: perSetupLabel,
      limit: `${fmtPct(perSetupLimit)} of equity`,
      measured: 'No measurable stop',
      verdict: 'NOT_MEASURABLE',
      detail: rawRisk !== null && !stopIsProtective
        ? 'The stop sits on the profitable side of entry, so it defines no loss. The engine would reject the draft as unmeasurable, not resize it.'
        : 'Without a stop loss there is no defined loss to compare against the limit. Add one to the draft — the preview will never assume a distance for you.',
      usage: null,
    });
  } else {
    rows.push({
      key: 'risk_per_setup',
      label: perSetupLabel,
      limit: `${fmtPct(perSetupLimit)} of equity (${fmtMoney((perSetupLimit / 100) * equity)})`,
      measured: `${fmtPct(riskPct)} (${fmtMoney(riskAmount as number)})`,
      verdict: verdictFor(riskPct, perSetupLimit),
      detail: verdictFor(riskPct, perSetupLimit) === 'PASS'
        ? `Loss at stop is ${fmtMoney(riskAmount as number)} against a ceiling of ${fmtMoney((perSetupLimit / 100) * equity)} on ${fmtMoney(equity)} simulated equity.`
        : `Loss at stop exceeds the ceiling by ${fmtMoney((riskAmount as number) - (perSetupLimit / 100) * equity)}. The Phase 2 engine would refuse this draft — it would not shrink the volume for you.`,
      usage: perSetupLimit > 0 ? riskPct / perSetupLimit : null,
    });
  }

  /* --------------------------- max open positions ---------------------------- */

  const maxOpen = Number(riskProfile.max_open_positions);
  const projectedOpen = openPositions.length + 1;
  rows.push({
    key: 'max_open_positions',
    label: 'Max open positions',
    limit: `${maxOpen} concurrent`,
    measured: `${projectedOpen} after this entry`,
    verdict: verdictFor(projectedOpen, maxOpen),
    detail: verdictFor(projectedOpen, maxOpen) === 'PASS'
      ? `${openPositions.length} open now on this paper account; this draft would leave ${Math.max(maxOpen - projectedOpen, 0)} slot(s) free.`
      : `${openPositions.length} already open. This draft would be number ${projectedOpen} against a cap of ${maxOpen}.`,
    usage: maxOpen > 0 ? projectedOpen / maxOpen : null,
  });

  /* ----------------------------- max hedge tiers ----------------------------- */

  const maxTiers = Number(riskProfile.max_hedge_tiers);
  const tierVerdict: PreviewVerdict = input.requestedTier <= maxTiers ? 'PASS' : 'FAIL';
  rows.push({
    key: 'max_hedge_tiers',
    label: 'Max hedge tiers',
    limit: `${maxTiers} tier(s)`,
    measured: input.isHedge ? `Tier ${input.requestedTier} requested` : 'Tier 0 — primary leg',
    verdict: tierVerdict,
    detail: input.isHedge
      ? (tierVerdict === 'PASS'
        ? `Tier ${input.requestedTier} of ${maxTiers} permitted. This is the one limit the Phase 1 simulator already enforces for real.`
        : `Tier ${input.requestedTier} is above the configured maximum of ${maxTiers}. The simulator already refuses this today with HEDGE TIER LIMIT REACHED.`)
      : `A primary leg occupies no hedge tier. ${tradingAccount.hedging_allowed ? `Up to ${maxTiers} hedge tier(s) would remain available on the resulting sequence.` : 'Hedging is disabled on this account, so no hedge tier could follow.'}`,
    usage: maxTiers > 0 ? input.requestedTier / maxTiers : null,
  });

  /* ---------------------------- total exposure cap --------------------------- */

  const totalLimit = Number(riskProfile.max_total_exposure);
  if (riskPct === null) {
    rows.push({
      key: 'max_total_exposure',
      label: 'Max total exposure',
      limit: `${fmtPct(totalLimit)} of equity`,
      measured: `${fmtPct(equity > 0 ? (openRisk / equity) * 100 : 0)} booked, draft unmeasured`,
      verdict: 'NOT_MEASURABLE',
      detail: 'Open legs with stops account for the booked figure. This draft carries no measurable stop, so its contribution to total exposure cannot be stated.',
      usage: null,
    });
  } else {
    const projectedTotalPct = equity > 0 ? ((openRisk + (riskAmount as number)) / equity) * 100 : 0;
    rows.push({
      key: 'max_total_exposure',
      label: 'Max total exposure',
      limit: `${fmtPct(totalLimit)} of equity (${fmtMoney((totalLimit / 100) * equity)})`,
      measured: `${fmtPct(projectedTotalPct)} (${fmtMoney(openRisk + (riskAmount as number))})`,
      verdict: verdictFor(projectedTotalPct, totalLimit),
      detail: `Combined loss-at-stop across ${openPositions.length - unmeasuredPositions} measurable open leg(s) plus this draft.${unmeasuredPositions > 0 ? ` ${unmeasuredPositions} open leg(s) carry no stop and are excluded — the real figure is higher.` : ''}`,
      usage: totalLimit > 0 ? projectedTotalPct / totalLimit : null,
    });
  }

  /* -------------------------- correlated exposure cap ------------------------ */

  const corrLimit = Number(riskProfile.max_correlated_exposure);
  const corrGroupLabel = candidateBase || symbol.broker_symbol;
  if (riskPct === null) {
    rows.push({
      key: 'max_correlated_exposure',
      label: 'Max correlated exposure',
      limit: `${fmtPct(corrLimit)} of equity`,
      measured: `${correlatedLegs} related leg(s), draft unmeasured`,
      verdict: 'NOT_MEASURABLE',
      detail: `Legs sharing ${corrGroupLabel} are grouped by asset overlap only — Phase 1 stores no correlation matrix. A stop is needed before this draft can be grouped in.`,
      usage: null,
    });
  } else {
    const projectedCorrPct = equity > 0 ? ((correlatedRisk + (riskAmount as number)) / equity) * 100 : 0;
    rows.push({
      key: 'max_correlated_exposure',
      label: 'Max correlated exposure',
      limit: `${fmtPct(corrLimit)} of equity (${fmtMoney((corrLimit / 100) * equity)})`,
      measured: `${fmtPct(projectedCorrPct)} across ${correlatedLegs + 1} leg(s)`,
      verdict: verdictFor(projectedCorrPct, corrLimit),
      detail: `Grouped by shared asset (${corrGroupLabel}) because Phase 1 stores no correlation matrix. ${correlatedLegs} open leg(s) share it with this draft.`,
      usage: corrLimit > 0 ? projectedCorrPct / corrLimit : null,
    });
  }

  /* --------------------------- margin utilisation cap ------------------------ */

  const marginLimit = Number(riskProfile.max_margin_utilization);
  const projectedMarginPct = equity > 0 ? ((openMargin + marginNeeded) / equity) * 100 : 0;
  rows.push({
    key: 'max_margin_utilization',
    label: 'Max margin utilisation',
    limit: `${fmtPct(marginLimit)} of equity`,
    measured: `${fmtPct(projectedMarginPct)} (${fmtMoney(openMargin + marginNeeded)})`,
    verdict: verdictFor(projectedMarginPct, marginLimit),
    detail: `Approximate: ${fmtMoney(notional)} notional at 1:${leverage} leverage, added to ${fmtMoney(openMargin)} already committed. No broker margin model exists in Phase 1, so treat this as indicative.`,
    usage: marginLimit > 0 ? projectedMarginPct / marginLimit : null,
  });

  return {
    ready: true,
    blockedReason: null,
    rows,
    passCount: rows.filter((r) => r.verdict === 'PASS').length,
    failCount: rows.filter((r) => r.verdict === 'FAIL').length,
    unknownCount: rows.filter((r) => r.verdict === 'NOT_MEASURABLE').length,
    unmeasuredPositions,
    equity,
    riskAmount,
    notional,
  };
}
