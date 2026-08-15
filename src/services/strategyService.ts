import db from '@/lib/db';
import type { Signal, Strategy, StrategyAssignment, Symbol as TradingSymbol } from '@/lib/types';
import { logEvent } from './systemEventService';

/** strategyService — strategy definitions + account assignments. Definitions only; nothing executes. */

export async function listStrategies(): Promise<Strategy[]> {
  const { data, error } = await db.from('strategies').select('*').order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Strategy[];
}

export async function createStrategy(workspaceId: string, payload: Partial<Strategy>): Promise<Strategy> {
  const { data, error } = await db
    .from('strategies')
    .insert({
      workspace_id: workspaceId,
      name: payload.name,
      description: payload.description ?? null,
      strategy_type: payload.strategy_type ?? 'CUSTOM',
      version: payload.version ?? 'v1.0.0',
      // New strategies always start as DRAFT. A strategy can never begin life live.
      status: 'DRAFT',
      entry_rules: payload.entry_rules ?? {},
      exit_rules: payload.exit_rules ?? {},
      hedge_rules: payload.hedge_rules ?? {},
      regime_rules: payload.regime_rules ?? {},
      risk_rules: payload.risk_rules ?? { authority: 'Phase 2 Risk Engine', strategy_may_override_risk: false },
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  const s = data as Strategy;
  await logEvent('STRATEGY_CREATED', `Strategy "${s.name}" created with status DRAFT. It cannot trade.`, { severity: 'SUCCESS' });
  return s;
}

export async function updateStrategy(id: string, patch: Partial<Strategy>): Promise<void> {
  const { error } = await db.from('strategies').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
  await logEvent('STRATEGY_UPDATED', 'Strategy definition updated.', { metadata: patch as Record<string, unknown> });
}

export async function archiveStrategy(id: string, name: string): Promise<void> {
  const { error } = await db.from('strategies').update({ status: 'ARCHIVED', updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
  await logEvent('STRATEGY_UPDATED', `Strategy "${name}" archived.`, { severity: 'WARNING' });
}

export async function listAssignments(): Promise<StrategyAssignment[]> {
  const { data, error } = await db.from('strategy_assignments').select('*').order('priority', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as StrategyAssignment[];
}

export async function assignStrategy(
  workspaceId: string,
  accountId: string,
  strategyId: string,
  priority: number,
): Promise<void> {
  const { error } = await db.from('strategy_assignments').insert({
    workspace_id: workspaceId,
    account_id: accountId,
    strategy_id: strategyId,
    priority,
    // Assignments start disabled. Enabling one still routes nothing in Phase 1.
    enabled: false,
  });
  if (error) throw new Error(error.message);
  await logEvent('STRATEGY_ASSIGNED', 'Strategy assigned to account in a disabled state.', { accountId });
}

export async function setAssignmentEnabled(id: string, enabled: boolean): Promise<void> {
  const { error } = await db.from('strategy_assignments').update({ enabled, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
  await logEvent('STRATEGY_ASSIGNED', `Assignment ${enabled ? 'enabled' : 'disabled'}. No execution path exists in Phase 1.`);
}

export async function removeAssignment(id: string): Promise<void> {
  const { error } = await db.from('strategy_assignments').delete().eq('id', id);
  if (error) throw new Error(error.message);
  await logEvent('STRATEGY_ASSIGNED', 'Strategy assignment removed.');
}

/* --------------------------------- symbols -------------------------------- */

export async function listSymbols(): Promise<TradingSymbol[]> {
  const { data, error } = await db.from('symbols').select('*').order('broker_symbol', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as TradingSymbol[];
}

/* --------------------------------- signals -------------------------------- */
/**
 * signalService — Phase 1 accepts MANUAL entry and manual approve/reject ONLY.
 *
 * FUTURE INSERTION POINT: signalAdapterService (Phase 2+) will normalise
 * EMAIL / TELEGRAM / WEBHOOK / DISCORD / API payloads into exactly this shape
 * and write them with source_type set accordingly. No adapter is connected now.
 */

export async function listSignals(): Promise<Signal[]> {
  const { data, error } = await db.from('signals').select('*').order('received_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Signal[];
}

export async function createSignal(workspaceId: string, payload: Partial<Signal>): Promise<Signal> {
  const { data, error } = await db
    .from('signals')
    .insert({
      workspace_id: workspaceId,
      source_type: 'MANUAL',
      source_name: payload.source_name ?? 'Manual entry',
      raw_signal: payload.raw_signal ?? {},
      symbol_id: payload.symbol_id ?? null,
      direction: payload.direction ?? null,
      entry_price: payload.entry_price ?? null,
      stop_loss: payload.stop_loss ?? null,
      take_profit: payload.take_profit ?? null,
      timeframe: payload.timeframe ?? null,
      provider_reference: payload.provider_reference ?? null,
      notes: payload.notes ?? null,
      validation_status: 'PENDING',
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  await logEvent('SIGNAL_CREATED', `Manual signal recorded and queued for human review.`, { severity: 'INFO' });
  return data as Signal;
}

export async function setSignalStatus(id: string, status: Signal['validation_status'], label: string): Promise<void> {
  const { error } = await db.from('signals').update({ validation_status: status }).eq('id', id);
  if (error) throw new Error(error.message);
  await logEvent('SIGNAL_CREATED', `Signal ${label} manually marked ${status}. No order was generated.`, {
    severity: status === 'REJECTED' ? 'WARNING' : 'INFO',
  });
}
