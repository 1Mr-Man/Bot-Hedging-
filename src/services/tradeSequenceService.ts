import db from '@/lib/db';
import type { HedgeRecord, Trade, TradeSequence } from '@/lib/types';
import { logEvent } from './systemEventService';

/**
 * tradeSequenceService / tradeService / hedgeService
 *
 * A sequence is the full lifecycle record: PRIMARY -> (adverse move) ->
 * STRUCTURE INVALIDATION -> HEDGE -> MONITOR -> RESOLUTION.
 *
 * Phase 1 writes these records from PAPER actions only. No function in this
 * module talks to a broker, and none of them ever will — Phase 5's
 * executionService is the only component permitted to do that, and it sits
 * behind the Phase 2 Risk Engine.
 */

export async function listSequences(): Promise<TradeSequence[]> {
  const { data, error } = await db.from('trade_sequences').select('*').order('opened_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as TradeSequence[];
}

export async function getSequence(id: string): Promise<TradeSequence | null> {
  const { data, error } = await db.from('trade_sequences').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as TradeSequence) ?? null;
}

export async function createSequence(workspaceId: string, payload: Partial<TradeSequence>): Promise<TradeSequence> {
  const { data, error } = await db
    .from('trade_sequences')
    .insert({
      workspace_id: workspaceId,
      reference: payload.reference ?? null,
      account_id: payload.account_id,
      strategy_id: payload.strategy_id ?? null,
      symbol_id: payload.symbol_id,
      signal_id: payload.signal_id ?? null,
      direction: payload.direction ?? 'BUY',
      state: 'NORMAL',
      initial_risk: payload.initial_risk ?? 0,
      current_exposure: payload.current_exposure ?? 0,
      notes: payload.notes ?? null,
      is_simulated: true,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  const seq = data as TradeSequence;
  await logEvent('TRADE_SEQUENCE_CREATED', `Paper sequence ${seq.reference ?? seq.id.slice(0, 8)} opened (simulated).`, {
    accountId: seq.account_id,
  });
  return seq;
}

export async function updateSequence(id: string, patch: Partial<TradeSequence>): Promise<void> {
  const { error } = await db.from('trade_sequences').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

/* --------------------------------- trades --------------------------------- */

export async function listTrades(): Promise<Trade[]> {
  const { data, error } = await db.from('trades').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Trade[];
}

export async function listTradesForSequence(sequenceId: string): Promise<Trade[]> {
  const { data, error } = await db.from('trades').select('*').eq('sequence_id', sequenceId).order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Trade[];
}

export async function createTrade(workspaceId: string, payload: Partial<Trade>): Promise<Trade> {
  const { data, error } = await db
    .from('trades')
    .insert({
      workspace_id: workspaceId,
      ...payload,
      // Phase 1 records are always PAPER. There is no code path that sets FILLED.
      execution_status: 'PAPER',
      broker_ticket: null,
      broker_deal_id: null,
      broker_order_id: null,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  const t = data as Trade;
  await logEvent('TRADE_CREATED', `Simulated ${t.trade_role} ${t.side} ${Number(t.volume).toFixed(2)} lots recorded.`, {
    accountId: t.account_id,
  });
  return t;
}

export async function updateTrade(id: string, patch: Partial<Trade>): Promise<void> {
  const { error } = await db.from('trades').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

/* ----------------------------- hedge records ------------------------------ */

export async function listHedgeRecords(): Promise<HedgeRecord[]> {
  const { data, error } = await db.from('hedge_records').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as HedgeRecord[];
}

export async function createHedgeRecord(workspaceId: string, payload: Partial<HedgeRecord>): Promise<HedgeRecord> {
  const { data, error } = await db
    .from('hedge_records')
    .insert({ workspace_id: workspaceId, ...payload })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  const h = data as HedgeRecord;
  await logEvent('HEDGE_RECORD_CREATED', `Tier ${h.hedge_tier} hedge recorded. Trigger: ${h.trigger_reason}.`, {
    severity: 'WARNING',
  });
  return h;
}

export async function updateHedgeRecord(id: string, patch: Partial<HedgeRecord>): Promise<void> {
  const { error } = await db.from('hedge_records').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}
