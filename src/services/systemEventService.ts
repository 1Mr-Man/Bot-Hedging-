import db from '@/lib/db';
import type { Severity, SystemEvent } from '@/lib/types';

/**
 * systemEventService — append-only audit feed.
 * Every meaningful state change in the platform is written here so that the
 * Phase 2 Risk Engine and any future auditor can reconstruct what happened.
 */

export const EVENT_TYPES = [
  'ACCOUNT_CREATED', 'ACCOUNT_UPDATED', 'ACCOUNT_ARCHIVED',
  'RISK_PROFILE_CREATED', 'RISK_PROFILE_UPDATED',
  'STRATEGY_CREATED', 'STRATEGY_UPDATED', 'STRATEGY_ASSIGNED',
  'SIGNAL_CREATED', 'TRADE_SEQUENCE_CREATED', 'TRADE_CREATED', 'HEDGE_RECORD_CREATED',
  'PAPER_POSITION_CREATED', 'PAPER_POSITION_UPDATED', 'PAPER_POSITION_CLOSED',
  'SETTINGS_UPDATED', 'LOGIN', 'LOGOUT',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

let cachedWorkspace: string | null = null;
let cachedUser: string | null = null;

export function setAuditContext(workspaceId: string | null, userId: string | null) {
  cachedWorkspace = workspaceId;
  cachedUser = userId;
}

export async function logEvent(
  eventType: EventType,
  message: string,
  opts: { severity?: Severity; accountId?: string | null; metadata?: Record<string, unknown> } = {},
): Promise<void> {
  if (!cachedWorkspace) return;
  const { error } = await db.from('system_events').insert({
    workspace_id: cachedWorkspace,
    user_id: cachedUser,
    account_id: opts.accountId ?? null,
    event_type: eventType,
    severity: opts.severity ?? 'INFO',
    message,
    metadata: opts.metadata ?? {},
  });
  // Audit writes must never break the user action that caused them.
  if (error) console.warn('[audit] event not recorded:', error.message);
}

export async function listEvents(limit = 200): Promise<SystemEvent[]> {
  const { data, error } = await db
    .from('system_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as SystemEvent[];
}

export async function listEventsForAccount(accountId: string, limit = 25): Promise<SystemEvent[]> {
  const { data, error } = await db
    .from('system_events')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as SystemEvent[];
}
