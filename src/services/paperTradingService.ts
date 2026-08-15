import db from '@/lib/db';
import { simulatedPnl } from '@/lib/format';
import type {
  Direction, PaperAccount, PaperDecisionLogEntry, PaperPosition, RiskProfile,
  Symbol as TradingSymbol, TradingAccount,
} from '@/lib/types';
import { paperRiskPlaceholder, type PaperRiskCheck } from './futureEngines';
import { createHedgeRecord, createSequence, createTrade, updateSequence, updateTrade } from './tradeSequenceService';
import { logEvent } from './systemEventService';

/**
 * paperTradingService — the ONLY place simulated positions are created.
 *
 * Hard safety guarantees of this module:
 *   - No martingale, no doubling, no averaging, no unlimited recovery.
 *   - Hedge volume is supplied by the operator and is never auto-scaled.
 *   - max_hedge_tiers from the assigned risk profile is enforced before write.
 *   - No broker order is generated. Ever. There is no broker client imported.
 *
 * PHASE 2 INSERTION POINT: replace paperRiskPlaceholder() with
 * riskEngineService.approve() — one call site, one gate, no side doors.
 */

export async function listPaperAccounts(): Promise<PaperAccount[]> {
  const { data, error } = await db.from('paper_accounts').select('*').order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as PaperAccount[];
}

export async function listPaperPositions(): Promise<PaperPosition[]> {
  const { data, error } = await db.from('paper_positions').select('*').order('opened_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as PaperPosition[];
}

export async function listDecisionLog(limit = 100): Promise<PaperDecisionLogEntry[]> {
  const { data, error } = await db
    .from('paper_decision_log').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as PaperDecisionLogEntry[];
}

async function logDecision(
  workspaceId: string,
  entry: Partial<PaperDecisionLogEntry>,
): Promise<void> {
  const { error } = await db.from('paper_decision_log').insert({
    workspace_id: workspaceId,
    origin: 'MANUAL_USER_ACTION',
    ...entry,
  });
  if (error) console.warn('[paper] decision not logged:', error.message);
}

export async function createPaperAccount(
  workspaceId: string, tradingAccountId: string, startingBalance: number,
): Promise<PaperAccount> {
  const { data, error } = await db
    .from('paper_accounts')
    .insert({
      workspace_id: workspaceId,
      trading_account_id: tradingAccountId,
      starting_balance: startingBalance,
      current_balance: startingBalance,
      current_equity: startingBalance,
    })
    .select('*').single();
  if (error) throw new Error(error.message);
  await logEvent('PAPER_POSITION_CREATED', `Paper account created with a simulated starting balance.`, {
    accountId: tradingAccountId, severity: 'SUCCESS',
  });
  return data as PaperAccount;
}

export async function setPaperTradingEnabled(paperAccountId: string, enabled: boolean): Promise<void> {
  const { error } = await db
    .from('paper_accounts')
    .update({ paper_trading_enabled: enabled, status: enabled ? 'ACTIVE' : 'PAUSED', updated_at: new Date().toISOString() })
    .eq('id', paperAccountId);
  if (error) throw new Error(error.message);
  await logEvent('SETTINGS_UPDATED', `Paper trading ${enabled ? 'resumed' : 'PAUSED'} for a paper account.`, {
    severity: enabled ? 'INFO' : 'WARNING',
  });
}

export interface OpenPaperInput {
  workspaceId: string;
  paperAccount: PaperAccount;
  tradingAccount: TradingAccount;
  riskProfile: RiskProfile | null;
  symbol: TradingSymbol;
  side: Direction;
  volume: number;
  entryPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  strategyId?: string | null;
  signalId?: string | null;
  reference?: string;
}

export interface PaperActionResult {
  ok: boolean;
  check: PaperRiskCheck;
  sequenceId?: string;
  positionId?: string;
}

/** Create a simulated PRIMARY position plus its parent sequence and trade leg. */
export async function openPaperPrimary(input: OpenPaperInput): Promise<PaperActionResult> {
  const check = paperRiskPlaceholder({
    paperEnabled: input.paperAccount.paper_trading_enabled && input.paperAccount.status === 'ACTIVE',
    hedgingAllowed: input.tradingAccount.hedging_allowed,
    isHedge: false,
    requestedTier: 0,
    maxHedgeTiers: input.riskProfile?.max_hedge_tiers ?? 0,
    volume: input.volume,
    minVolume: Number(input.symbol.min_volume),
    maxVolume: Number(input.symbol.max_volume),
  });
  if (!check.allowed) {
    await logDecision(input.workspaceId, {
      paper_account_id: input.paperAccount.id, account_id: input.tradingAccount.id,
      symbol_id: input.symbol.id, action: 'OPEN_PAPER_PRIMARY_REJECTED',
      reason: check.message, result: 'Rejected by paper guard rails. Nothing was written.',
    });
    return { ok: false, check };
  }

  const sequence = await createSequence(input.workspaceId, {
    reference: input.reference ?? `PAPER-${Date.now().toString(36).toUpperCase()}`,
    account_id: input.tradingAccount.id,
    strategy_id: input.strategyId ?? null,
    symbol_id: input.symbol.id,
    signal_id: input.signalId ?? null,
    direction: input.side,
  });

  const trade = await createTrade(input.workspaceId, {
    sequence_id: sequence.id,
    account_id: input.tradingAccount.id,
    strategy_id: input.strategyId ?? null,
    signal_id: input.signalId ?? null,
    symbol_id: input.symbol.id,
    side: input.side,
    trade_role: 'PRIMARY',
    status: 'OPEN',
    volume: input.volume,
    entry_price: input.entryPrice,
    stop_loss: input.stopLoss,
    take_profit: input.takeProfit,
    hedge_tier: 0,
    opened_at: new Date().toISOString(),
    client_order_id: `PAPER-${sequence.id.slice(0, 8)}-P`,
    metadata: { simulated: true },
  });

  const { data, error } = await db.from('paper_positions').insert({
    workspace_id: input.workspaceId,
    paper_account_id: input.paperAccount.id,
    sequence_id: sequence.id,
    trade_id: trade.id,
    symbol_id: input.symbol.id,
    side: input.side,
    position_role: 'PRIMARY',
    hedge_tier: 0,
    volume: input.volume,
    entry_price: input.entryPrice,
    current_price: input.entryPrice,
    stop_loss: input.stopLoss,
    take_profit: input.takeProfit,
  }).select('*').single();
  if (error) throw new Error(error.message);

  await logDecision(input.workspaceId, {
    paper_account_id: input.paperAccount.id, account_id: input.tradingAccount.id,
    strategy_id: input.strategyId ?? null, symbol_id: input.symbol.id,
    action: 'OPEN_PAPER_PRIMARY', reason: 'Manual operator action in the paper simulator',
    result: `Simulated primary ${input.side} ${input.volume} lots recorded`,
  });
  await logEvent('PAPER_POSITION_CREATED', `Simulated PRIMARY ${input.side} ${input.volume} ${input.symbol.broker_symbol} opened. No broker order was sent.`, {
    accountId: input.tradingAccount.id, severity: 'SUCCESS',
  });

  return { ok: true, check, sequenceId: sequence.id, positionId: (data as PaperPosition).id };
}

export interface HedgeInput {
  workspaceId: string;
  paperAccount: PaperAccount;
  tradingAccount: TradingAccount;
  riskProfile: RiskProfile | null;
  symbol: TradingSymbol;
  primary: PaperPosition;
  volume: number;
  entryPrice: number;
  triggerReason: string;
}

/**
 * Create a simulated HEDGE leg against an existing primary.
 * The requested tier is always primary tier + 1 and is checked against the
 * risk profile's max_hedge_tiers BEFORE anything is written.
 */
export async function openPaperHedge(input: HedgeInput): Promise<PaperActionResult> {
  const requestedTier = (input.primary.hedge_tier ?? 0) + 1;
  const check = paperRiskPlaceholder({
    paperEnabled: input.paperAccount.paper_trading_enabled && input.paperAccount.status === 'ACTIVE',
    hedgingAllowed: input.tradingAccount.hedging_allowed,
    isHedge: true,
    requestedTier,
    maxHedgeTiers: input.riskProfile?.max_hedge_tiers ?? 0,
    volume: input.volume,
    minVolume: Number(input.symbol.min_volume),
    maxVolume: Number(input.symbol.max_volume),
  });

  if (!check.allowed) {
    await logDecision(input.workspaceId, {
      paper_account_id: input.paperAccount.id, account_id: input.tradingAccount.id,
      symbol_id: input.symbol.id, action: 'OPEN_PAPER_HEDGE_REJECTED',
      reason: check.message, result: 'Rejected. No hedge position was created.',
    });
    await logEvent('PAPER_POSITION_UPDATED', `Simulated hedge rejected: ${check.message}`, {
      accountId: input.tradingAccount.id, severity: 'WARNING',
    });
    return { ok: false, check };
  }

  const hedgeSide: Direction = input.primary.side === 'BUY' ? 'SELL' : 'BUY';
  const sequenceId = input.primary.sequence_id;

  const trade = await createTrade(input.workspaceId, {
    sequence_id: sequenceId!,
    account_id: input.tradingAccount.id,
    symbol_id: input.symbol.id,
    side: hedgeSide,
    trade_role: 'HEDGE',
    status: 'OPEN',
    volume: input.volume,
    entry_price: input.entryPrice,
    hedge_tier: requestedTier,
    opened_at: new Date().toISOString(),
    client_order_id: `PAPER-${String(sequenceId).slice(0, 8)}-H${requestedTier}`,
    metadata: { simulated: true },
  });

  await createHedgeRecord(input.workspaceId, {
    sequence_id: sequenceId!,
    parent_trade_id: input.primary.trade_id,
    hedge_trade_id: trade.id,
    hedge_tier: requestedTier,
    trigger_reason: input.triggerReason,
    hedge_direction: hedgeSide,
    hedge_volume: input.volume,
    hedge_entry_price: input.entryPrice,
    hedge_status: 'ACTIVE',
    opened_at: new Date().toISOString(),
    metadata: { simulated: true },
  });

  const { data, error } = await db.from('paper_positions').insert({
    workspace_id: input.workspaceId,
    paper_account_id: input.paperAccount.id,
    sequence_id: sequenceId,
    trade_id: trade.id,
    symbol_id: input.symbol.id,
    side: hedgeSide,
    position_role: 'HEDGE',
    hedge_tier: requestedTier,
    volume: input.volume,
    entry_price: input.entryPrice,
    current_price: input.entryPrice,
  }).select('*').single();
  if (error) throw new Error(error.message);

  if (sequenceId) {
    await updateSequence(sequenceId, { state: 'HEDGED', current_hedge_tier: requestedTier });
  }
  await logDecision(input.workspaceId, {
    paper_account_id: input.paperAccount.id, account_id: input.tradingAccount.id,
    symbol_id: input.symbol.id, action: 'OPEN_PAPER_HEDGE',
    reason: input.triggerReason, result: `Simulated tier ${requestedTier} hedge recorded`,
  });

  return { ok: true, check, sequenceId: sequenceId ?? undefined, positionId: (data as PaperPosition).id };
}

/** Manually move the simulated price and recompute unrealised P/L. */
export async function updateSimulatedPrice(
  workspaceId: string, position: PaperPosition, symbol: TradingSymbol, newPrice: number,
): Promise<number> {
  const pnl = simulatedPnl(position.side, Number(position.volume), Number(position.entry_price), newPrice, symbol);
  const { error } = await db.from('paper_positions')
    .update({ current_price: newPrice, unrealized_pnl: pnl, updated_at: new Date().toISOString() })
    .eq('id', position.id);
  if (error) throw new Error(error.message);

  if (position.trade_id) await updateTrade(position.trade_id, { floating_pnl: pnl });
  await recalcPaperAccount(position.paper_account_id);
  await logDecision(workspaceId, {
    paper_account_id: position.paper_account_id, symbol_id: symbol.id,
    action: 'UPDATE_SIMULATED_PRICE', reason: 'Operator moved the simulated price',
    result: `Simulated P/L recalculated to ${pnl.toFixed(2)}`,
  });
  return pnl;
}

/** Close a simulated position: realises the simulated P/L and resolves the sequence when empty. */
export async function closePaperPosition(
  workspaceId: string, position: PaperPosition, symbol: TradingSymbol, exitPrice: number,
): Promise<number> {
  const pnl = simulatedPnl(position.side, Number(position.volume), Number(position.entry_price), exitPrice, symbol);
  const now = new Date().toISOString();

  const { error } = await db.from('paper_positions').update({
    status: 'CLOSED', current_price: exitPrice, unrealized_pnl: 0, realized_pnl: pnl,
    closed_at: now, updated_at: now,
  }).eq('id', position.id);
  if (error) throw new Error(error.message);

  if (position.trade_id) {
    await updateTrade(position.trade_id, {
      status: 'CLOSED', exit_price: exitPrice, realized_pnl: pnl, floating_pnl: 0, closed_at: now,
    });
  }

  if (position.sequence_id) {
    const { data: remaining } = await db.from('paper_positions')
      .select('id').eq('sequence_id', position.sequence_id).eq('status', 'OPEN');
    const { data: allPos } = await db.from('paper_positions').select('realized_pnl').eq('sequence_id', position.sequence_id);
    const realized = (allPos ?? []).reduce((sum, p) => sum + Number((p as { realized_pnl: number }).realized_pnl ?? 0), 0);

    if (!remaining || remaining.length === 0) {
      await updateSequence(position.sequence_id, {
        state: 'CLOSED', realized_pnl: realized, floating_pnl: 0, current_exposure: 0, closed_at: now,
      });
      await db.from('hedge_records')
        .update({ hedge_status: 'CLOSED', closed_at: now, updated_at: now })
        .eq('sequence_id', position.sequence_id).eq('hedge_status', 'ACTIVE');
    } else {
      await updateSequence(position.sequence_id, { state: 'FOLLOWHEDGE', realized_pnl: realized });
    }
  }

  await recalcPaperAccount(position.paper_account_id);
  await logDecision(workspaceId, {
    paper_account_id: position.paper_account_id, symbol_id: symbol.id,
    action: 'CLOSE_PAPER_POSITION', reason: 'Operator closed a simulated position',
    result: `Simulated realised result ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}`,
  });
  await logEvent('PAPER_POSITION_CLOSED', `Simulated ${position.position_role} position closed. Simulated result ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}.`, {
    severity: pnl >= 0 ? 'SUCCESS' : 'WARNING',
  });
  return pnl;
}

/** Recompute simulated balance/equity from the position ledger. */
export async function recalcPaperAccount(paperAccountId: string): Promise<void> {
  const { data: acct } = await db.from('paper_accounts').select('*').eq('id', paperAccountId).maybeSingle();
  if (!acct) return;
  const account = acct as PaperAccount;
  const { data: positions } = await db.from('paper_positions').select('unrealized_pnl,realized_pnl,status').eq('paper_account_id', paperAccountId);
  const rows = (positions ?? []) as Array<{ unrealized_pnl: number; realized_pnl: number; status: string }>;
  const realized = rows.reduce((s, p) => s + Number(p.realized_pnl ?? 0), 0);
  const floating = rows.filter((p) => p.status === 'OPEN').reduce((s, p) => s + Number(p.unrealized_pnl ?? 0), 0);
  const balance = Number(account.starting_balance) + realized;
  await db.from('paper_accounts').update({
    current_balance: Math.round(balance * 100) / 100,
    current_equity: Math.round((balance + floating) * 100) / 100,
    simulated_pnl: Math.round((realized + floating) * 100) / 100,
    updated_at: new Date().toISOString(),
  }).eq('id', paperAccountId);
}
