import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import db from '@/lib/db';
import type {
  AccountGroup, AccountGroupMember, AppSetting, GrowthJourney, HedgeRecord, PaperAccount,
  PaperDecisionLogEntry, PaperPosition, Profile, RiskProfile, Signal, Strategy,
  StrategyAssignment, Symbol as TradingSymbol, SystemEvent, Trade, TradeSequence, TradingAccount,
} from '@/lib/types';
import { setAuditContext, logEvent, listEvents } from '@/services/systemEventService';
import { listAccounts, listGroupMembers, listGroups, listRiskProfiles } from '@/services/accountService';
import { listAssignments, listSignals, listStrategies, listSymbols } from '@/services/strategyService';
import { listHedgeRecords, listSequences, listTrades } from '@/services/tradeSequenceService';
import { listDecisionLog, listPaperAccounts, listPaperPositions } from '@/services/paperTradingService';
import { getGrowthJourney, listProfiles, listSettings } from '@/services/settingsService';

export interface PlatformData {
  accounts: TradingAccount[];
  groups: AccountGroup[];
  groupMembers: AccountGroupMember[];
  riskProfiles: RiskProfile[];
  strategies: Strategy[];
  assignments: StrategyAssignment[];
  symbols: TradingSymbol[];
  signals: Signal[];
  sequences: TradeSequence[];
  trades: Trade[];
  hedges: HedgeRecord[];
  paperAccounts: PaperAccount[];
  paperPositions: PaperPosition[];
  decisionLog: PaperDecisionLogEntry[];
  events: SystemEvent[];
  growth: GrowthJourney | null;
  settings: AppSetting[];
  team: Profile[];
}

const EMPTY: PlatformData = {
  accounts: [], groups: [], groupMembers: [], riskProfiles: [], strategies: [], assignments: [],
  symbols: [], signals: [], sequences: [], trades: [], hedges: [], paperAccounts: [],
  paperPositions: [], decisionLog: [], events: [], growth: null, settings: [], team: [],
};

interface PlatformContextValue {
  session: Session | null;
  profile: Profile | null;
  authLoading: boolean;
  dataLoading: boolean;
  error: string | null;
  data: PlatformData;
  canWrite: boolean;
  isOwner: boolean;
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const PlatformContext = createContext<PlatformContextValue | undefined>(undefined);

export const usePlatform = (): PlatformContextValue => {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error('usePlatform must be used inside PlatformProvider');
  return ctx;
};

export const PlatformProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PlatformData>(EMPTY);

  useEffect(() => {
    let mounted = true;
    db.auth.getSession().then(({ data: s }) => {
      if (!mounted) return;
      setSession(s.session ?? null);
      setAuthLoading(false);
    });
    const { data: sub } = db.auth.onAuthStateChange((_evt, s) => {
      setSession(s ?? null);
      if (!s) {
        setProfile(null);
        setData(EMPTY);
        setAuditContext(null, null);
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const loadAll = useCallback(async () => {
    setDataLoading(true);
    setError(null);
    try {
      const [
        accounts, groups, groupMembers, riskProfiles, strategies, assignments, symbols, signals,
        sequences, trades, hedges, paperAccounts, paperPositions, decisionLog, events, growth,
        settings, team,
      ] = await Promise.all([
        listAccounts(), listGroups(), listGroupMembers(), listRiskProfiles(), listStrategies(),
        listAssignments(), listSymbols(), listSignals(), listSequences(), listTrades(),
        listHedgeRecords(), listPaperAccounts(), listPaperPositions(), listDecisionLog(),
        listEvents(), getGrowthJourney(), listSettings(), listProfiles(),
      ]);
      setData({
        accounts, groups, groupMembers, riskProfiles, strategies, assignments, symbols, signals,
        sequences, trades, hedges, paperAccounts, paperPositions, decisionLog, events, growth,
        settings, team,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load platform data.');
    } finally {
      setDataLoading(false);
    }
  }, []);

  // Bootstrap profile + workspace once authenticated.
  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;
    (async () => {
      setDataLoading(true);
      try {
        const fullName = (session.user.user_metadata?.full_name as string) ?? '';
        const { error: rpcError } = await db.rpc('ensure_profile', { p_full_name: fullName });
        if (rpcError) throw new Error(rpcError.message);

        const { data: prof, error: profErr } = await db
          .from('profiles').select('*').eq('id', session.user.id).maybeSingle();
        if (profErr) throw new Error(profErr.message);
        if (cancelled) return;

        const p = prof as Profile | null;
        setProfile(p);
        setAuditContext(p?.workspace_id ?? null, session.user.id);
        await loadAll();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Unable to prepare your workspace.');
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [session?.user?.id, loadAll]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error: e } = await db.auth.signInWithPassword({ email, password });
    if (e) throw new Error(e.message);
    await logEvent('LOGIN', `Sign-in for ${email}.`);
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const { error: e } = await db.auth.signUp({
      email, password, options: { data: { full_name: fullName } },
    });
    if (e) throw new Error(e.message);
  }, []);

  const signOut = useCallback(async () => {
    await logEvent('LOGOUT', 'Operator signed out.');
    await db.auth.signOut();
  }, []);

  const value = useMemo<PlatformContextValue>(() => ({
    session, profile, authLoading, dataLoading, error, data,
    canWrite: profile?.role === 'owner' || profile?.role === 'admin',
    isOwner: profile?.role === 'owner',
    refresh: loadAll, signIn, signUp, signOut,
  }), [session, profile, authLoading, dataLoading, error, data, loadAll, signIn, signUp, signOut]);

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
};

/* ------------------------------ lookup helpers ----------------------------- */

export function useLookups() {
  const { data } = usePlatform();
  return useMemo(() => ({
    symbolById: new Map(data.symbols.map((s) => [s.id, s])),
    accountById: new Map(data.accounts.map((a) => [a.id, a])),
    strategyById: new Map(data.strategies.map((s) => [s.id, s])),
    riskProfileById: new Map(data.riskProfiles.map((r) => [r.id, r])),
    sequenceById: new Map(data.sequences.map((s) => [s.id, s])),
    paperAccountById: new Map(data.paperAccounts.map((p) => [p.id, p])),
  }), [data]);
}
