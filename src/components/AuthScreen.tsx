import React, { useState } from 'react';
import { Activity, KeyRound, Lock, ShieldCheck, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePlatform } from '@/contexts/PlatformContext';
import { NoticeBanner } from '@/components/shared/Primitives';

const AuthScreen: React.FC = () => {
  const { signIn, signUp } = usePlatform();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg(null);
    setMessage(null);
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password, fullName.trim());
        setMessage('Account created. If email confirmation is required, confirm it and then sign in.');
        setMode('signin');
      }
      window.supercool?.track('form_submit', { form: mode === 'signin' ? 'sign_in' : 'sign_up' });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-primary/40 bg-primary/10">
            <Activity className="h-6 w-6 text-primary" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">MT5 Adaptive Hedge Trading Platform</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Phase 1 — Foundation, database and paper trading skeleton
          </p>
        </div>

        <div className="panel p-5">
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg border border-border bg-secondary/40 p-1">
            {(['signin', 'signup'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setErrorMsg(null); }}
                className={`h-9 rounded-md text-xs font-semibold transition-colors ${
                  mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {m === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === 'signup' && (
              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-xs">Full name</Label>
                <Input
                  id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)}
                  placeholder="Alex Morgan" autoComplete="name" className="h-11 bg-secondary/40"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">Email</Label>
              <Input
                id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@desk.com" autoComplete="email" className="h-11 bg-secondary/40"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs">Password</Label>
              <Input
                id="password" type="password" required minLength={6} value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} className="h-11 bg-secondary/40"
              />
            </div>

            {errorMsg && (
              <p role="alert" className="rounded-md border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
                {errorMsg}
              </p>
            )}
            {message && (
              <p className="rounded-md border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-300">
                {message}
              </p>
            )}

            <Button type="submit" disabled={busy} className="h-11 w-full text-sm font-semibold">
              {busy ? 'Working…' : mode === 'signin' ? 'Sign in to control center' : 'Create operator account'}
            </Button>
          </form>

          <p className="mt-4 flex items-start gap-1.5 text-[10px] leading-relaxed text-muted-foreground">
            <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
            New accounts are created with the OWNER role for their own isolated workspace, pre-loaded with clearly
            marked demo records. Access is enforced by database row-level security, not by the interface.
          </p>
        </div>

        <div className="mt-4 space-y-2">
          <NoticeBanner tone="warn" title="No live trading in Phase 1" icon={ShieldCheck}>
            This build has no broker connection, no Expert Advisor, no market data feed and no order routing.
            Every number it produces is simulated.
          </NoticeBanner>
          <NoticeBanner title="Architecture" icon={Terminal}>
            Signal / Strategy → Risk Engine (Phase 2) → Execution Queue → MT5 Bridge (Phase 5) → EA (Phase 6).
            Phase 1 stops at: manual test → paper guard rails → paper trade → journal.
          </NoticeBanner>
        </div>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
          <KeyRound className="h-3 w-3" aria-hidden="true" />
          Broker passwords and API secrets are never stored by this platform.
        </p>
      </div>
    </main>
  );
};

export default AuthScreen;
