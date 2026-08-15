import db from '@/lib/db';
import type { AccountGroup, AccountGroupMember, RiskProfile, TradingAccount } from '@/lib/types';
import { logEvent } from './systemEventService';

/** accountService — trading account CRUD. Soft delete only (ACTIVE -> ARCHIVED). */

export async function listAccounts(): Promise<TradingAccount[]> {
  const { data, error } = await db.from('trading_accounts').select('*').order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as TradingAccount[];
}

export async function getAccount(id: string): Promise<TradingAccount | null> {
  const { data, error } = await db.from('trading_accounts').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as TradingAccount) ?? null;
}

export async function createAccount(
  workspaceId: string,
  payload: Partial<TradingAccount>,
): Promise<TradingAccount> {
  const { data, error } = await db
    .from('trading_accounts')
    .insert({
      workspace_id: workspaceId,
      name: payload.name,
      broker: payload.broker ?? null,
      server: payload.server ?? null,
      account_reference: payload.account_reference ?? null,
      account_mode: payload.account_mode ?? 'MONITORONLY',
      currency: payload.currency ?? 'USD',
      leverage: payload.leverage ?? 30,
      margin_mode: payload.margin_mode ?? 'HEDGING',
      hedging_allowed: payload.hedging_allowed ?? true,
      risk_profile_id: payload.risk_profile_id ?? null,
      notes: payload.notes ?? null,
      // Phase 1 never connects an execution path.
      trading_enabled: false,
      execution_status: 'NOT_CONNECTED',
      execution_mode: 'PAPER',
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  const account = data as TradingAccount;
  await logEvent('ACCOUNT_CREATED', `Account "${account.name}" created in ${account.account_mode} mode. Live execution remains disconnected.`, {
    severity: 'SUCCESS',
    accountId: account.id,
  });
  return account;
}

export async function updateAccount(id: string, patch: Partial<TradingAccount>): Promise<TradingAccount> {
  const { data, error } = await db
    .from('trading_accounts')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  const account = data as TradingAccount;
  await logEvent('ACCOUNT_UPDATED', `Account "${account.name}" updated.`, { accountId: account.id, metadata: patch as Record<string, unknown> });
  return account;
}

/** Soft delete. Financial history is preserved and stays queryable. */
export async function archiveAccount(id: string, name: string): Promise<void> {
  const { error } = await db
    .from('trading_accounts')
    .update({ status: 'ARCHIVED', trading_enabled: false, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
  await logEvent('ACCOUNT_ARCHIVED', `Account "${name}" archived. History retained; nothing was deleted.`, {
    severity: 'WARNING',
    accountId: id,
  });
}

export async function setManualStop(id: string, name: string, active: boolean): Promise<void> {
  const { error } = await db
    .from('trading_accounts')
    .update({ manual_stop_active: active, trading_enabled: false, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
  await logEvent('ACCOUNT_UPDATED', `Manual stop ${active ? 'ENGAGED' : 'released'} on "${name}".`, {
    severity: active ? 'WARNING' : 'INFO',
    accountId: id,
  });
}

/* ----------------------------- account groups ----------------------------- */

export async function listGroups(): Promise<AccountGroup[]> {
  const { data, error } = await db.from('account_groups').select('*').order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AccountGroup[];
}

export async function listGroupMembers(): Promise<AccountGroupMember[]> {
  const { data, error } = await db.from('account_group_members').select('*');
  if (error) throw new Error(error.message);
  return (data ?? []) as AccountGroupMember[];
}

export async function createGroup(workspaceId: string, name: string, description: string): Promise<AccountGroup> {
  const { data, error } = await db
    .from('account_groups')
    .insert({ workspace_id: workspaceId, name, description })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  await logEvent('ACCOUNT_UPDATED', `Account group "${name}" created.`, { severity: 'SUCCESS' });
  return data as AccountGroup;
}

export async function updateGroup(id: string, patch: Partial<AccountGroup>): Promise<void> {
  const { error } = await db.from('account_groups').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function addGroupMember(workspaceId: string, groupId: string, accountId: string): Promise<void> {
  const { error } = await db
    .from('account_group_members')
    .insert({ workspace_id: workspaceId, group_id: groupId, account_id: accountId });
  if (error) throw new Error(error.message);
  await logEvent('ACCOUNT_UPDATED', 'Account added to group.', { accountId });
}

export async function removeGroupMember(memberId: string): Promise<void> {
  const { error } = await db.from('account_group_members').delete().eq('id', memberId);
  if (error) throw new Error(error.message);
  await logEvent('ACCOUNT_UPDATED', 'Account removed from group. No financial records were deleted.');
}

/* ------------------------------ risk profiles ----------------------------- */
/**
 * riskProfileService — CONFIGURATION RECORDS ONLY.
 * Nothing in this module performs a risk calculation. The Phase 2 Risk Engine
 * is the only component that will ever read these values to size an action.
 */

export async function listRiskProfiles(): Promise<RiskProfile[]> {
  const { data, error } = await db.from('risk_profiles').select('*').order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as RiskProfile[];
}

export async function createRiskProfile(workspaceId: string, payload: Partial<RiskProfile>): Promise<RiskProfile> {
  const { data, error } = await db
    .from('risk_profiles')
    .insert({ workspace_id: workspaceId, ...payload, trading_enabled: false })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  const rp = data as RiskProfile;
  await logEvent('RISK_PROFILE_CREATED', `Risk profile "${rp.name}" stored as configuration. No live risk calculation runs in Phase 1.`, {
    severity: 'SUCCESS',
  });
  return rp;
}

export async function updateRiskProfile(id: string, patch: Partial<RiskProfile>): Promise<void> {
  const { error } = await db.from('risk_profiles').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
  await logEvent('RISK_PROFILE_UPDATED', `Risk profile configuration updated.`, { metadata: patch as Record<string, unknown> });
}

export async function archiveRiskProfile(id: string, name: string): Promise<void> {
  const { error } = await db.from('risk_profiles').update({ status: 'ARCHIVED', updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
  await logEvent('RISK_PROFILE_UPDATED', `Risk profile "${name}" archived.`, { severity: 'WARNING' });
}
