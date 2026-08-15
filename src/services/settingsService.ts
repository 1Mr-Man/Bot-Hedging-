import db from '@/lib/db';
import type { AppSetting, GrowthJourney, Profile } from '@/lib/types';
import { logEvent } from './systemEventService';

/**
 * growthJourneyService — DASHBOARD / PROGRESS FEATURE ONLY.
 *
 * CRITICAL: no value in this module is ever read by a sizing routine, by the
 * paper simulator, or by the future Risk Engine. The projection below is a
 * geometric reference curve for motivation and reporting. It is displayed
 * separately from actual paper equity and is always labelled
 * "GROWTH JOURNEY — SIMULATION / REFERENCE".
 */

export async function getGrowthJourney(): Promise<GrowthJourney | null> {
  const { data, error } = await db.from('growth_journey').select('*').limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as GrowthJourney) ?? null;
}

export async function updateGrowthJourney(id: string, patch: Partial<GrowthJourney>): Promise<void> {
  const { error } = await db.from('growth_journey').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
  await logEvent('SETTINGS_UPDATED', 'Growth journey reference values updated. This never affects position sizing.');
}

export interface GrowthLevel {
  level: number;
  referenceBalance: number;
}

/** Pure presentation maths. Not risk maths. */
export function buildGrowthLadder(startingBalance: number, targetBalance: number, targetLevel: number): GrowthLevel[] {
  const levels: GrowthLevel[] = [];
  const safeTarget = Math.max(targetLevel, 2);
  const ratio = Math.pow(Math.max(targetBalance, 1) / Math.max(startingBalance, 1), 1 / (safeTarget - 1));
  for (let i = 0; i < safeTarget; i++) {
    levels.push({ level: i + 1, referenceBalance: Math.round(startingBalance * Math.pow(ratio, i) * 100) / 100 });
  }
  return levels;
}

/* ------------------------------- app settings ------------------------------ */
/**
 * settingsService — NON-SENSITIVE CONFIGURATION ONLY.
 * Broker passwords, MT5 master/investor passwords, private API keys and
 * endpoint secrets are never stored here or anywhere else in the database.
 * When the Phase 5 bridge arrives, its credentials belong in server-side
 * secret storage, not in an ordinary table column.
 */

export async function listSettings(): Promise<AppSetting[]> {
  const { data, error } = await db.from('app_settings').select('*').order('setting_key', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AppSetting[];
}

const FORBIDDEN_KEY_PATTERN = /(password|secret|token|api[_-]?key|credential|private)/i;

export async function upsertSetting(
  workspaceId: string, userId: string | null, key: string, value: Record<string, unknown>, description?: string,
): Promise<void> {
  if (FORBIDDEN_KEY_PATTERN.test(key)) {
    throw new Error('Refused: credentials and secrets must never be stored in app settings.');
  }
  const { error } = await db.from('app_settings').upsert(
    {
      workspace_id: workspaceId, setting_key: key, setting_value: value,
      description: description ?? null, updated_by: userId, updated_at: new Date().toISOString(),
    },
    { onConflict: 'workspace_id,setting_key' },
  );
  if (error) throw new Error(error.message);
  await logEvent('SETTINGS_UPDATED', `Setting "${key}" updated.`, { metadata: { key } });
}

/* --------------------------------- profiles -------------------------------- */

export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await db.from('profiles').select('*').order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Profile[];
}

export async function updateProfileRole(id: string, role: Profile['role']): Promise<void> {
  const { error } = await db.from('profiles').update({ role, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
  await logEvent('SETTINGS_UPDATED', `Team member role changed to ${role}.`, { severity: 'WARNING' });
}
