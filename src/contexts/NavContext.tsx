import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type RouteKey =
  | 'overview' | 'accounts' | 'account-detail' | 'account-groups' | 'risk-profiles'
  | 'strategies' | 'strategy-detail' | 'strategy-assignments' | 'signals'
  | 'trade-sequences' | 'trade-sequence-detail' | 'trades' | 'hedge-records'
  | 'paper-trading' | 'system-events' | 'growth-journey' | 'settings' | 'verification' | 'more';

export interface Route {
  key: RouteKey;
  id?: string;
}

interface NavContextValue {
  route: Route;
  navigate: (key: RouteKey, id?: string) => void;
  back: () => void;
  canGoBack: boolean;
}

const NavContext = createContext<NavContextValue | undefined>(undefined);

export const useNav = (): NavContextValue => {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav must be used inside NavProvider');
  return ctx;
};

export const NavProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [stack, setStack] = useState<Route[]>([{ key: 'overview' }]);

  const navigate = useCallback((key: RouteKey, id?: string) => {
    setStack((prev) => {
      const top = prev[prev.length - 1];
      if (top.key === key && top.id === id) return prev;
      return [...prev, { key, id }];
    });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  const back = useCallback(() => {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const value = useMemo<NavContextValue>(() => ({
    route: stack[stack.length - 1],
    navigate,
    back,
    canGoBack: stack.length > 1,
  }), [stack, navigate, back]);

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
};
