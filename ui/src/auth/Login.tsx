import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from './AuthProvider.tsx';

/** Sign-in screen, styled to match the product's spatial glass design. */
export function Login() {
  const { signInWithGitHub, signInWithEmail, configured } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true); setError(null);
    const { error } = await signInWithEmail(email.trim());
    setBusy(false);
    if (error) setError(error); else setSent(true);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-6">
      <div className="mesh"><span className="blob b1" /><span className="blob b2" /><span className="blob b3" /></div>
      <div className="grain" />

      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 180, damping: 22 }}
        className="glass w-full max-w-md rounded-3xl p-8"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl text-white" style={{ background: 'linear-gradient(145deg,#6b6bff,#4f46e5)', boxShadow: '0 8px 20px -6px rgba(91,91,240,.6)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /></svg>
          </div>
          <div>
            <div className="font-display text-xl font-extrabold tracking-tight" style={{ background: 'linear-gradient(90deg,#4f46e5,#0891b2)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Tartarus</div>
            <div className="text-[12px] text-sub">Sign in to your workspace</div>
          </div>
        </div>

        {!configured && (
          <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50/70 p-3 text-[13px] text-gate">
            Supabase is not configured yet. Add <code className="font-mono">VITE_SUPABASE_URL</code> and{' '}
            <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> to <code className="font-mono">ui/.env</code>.
          </div>
        )}

        <button
          onClick={signInWithGitHub}
          disabled={!configured}
          className="mt-7 flex w-full items-center justify-center gap-2.5 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:brightness-125 disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.1-1.47-1.1-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" /></svg>
          Continue with GitHub
        </button>

        <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wide text-mut">
          <span className="h-px flex-1 bg-slate-300/60" />or<span className="h-px flex-1 bg-slate-300/60" />
        </div>

        {sent ? (
          <div className="rounded-xl border border-green-300 bg-green-50/70 p-3 text-[13px] text-success">
            Check your inbox. We sent a sign-in link to <span className="font-medium">{email}</span>.
          </div>
        ) : (
          <form onSubmit={onEmail} className="space-y-3">
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com" required disabled={!configured}
              className="w-full rounded-xl border border-white/70 bg-white/70 px-4 py-3 text-sm text-ink outline-none transition placeholder:text-mut focus:border-brand/50 focus:ring-2 focus:ring-brand/20 disabled:opacity-50"
            />
            <button
              type="submit" disabled={busy || !configured}
              className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#6b6bff,#4f46e5)', boxShadow: '0 8px 20px -6px rgba(79,70,229,.6)' }}
            >
              {busy ? 'Sending...' : 'Email me a sign-in link'}
            </button>
          </form>
        )}

        {error && <div className="mt-3 text-[13px] text-critical">{error}</div>}

        <p className="mt-6 text-center text-[12px] text-mut">
          <a href="#" className="text-brand hover:underline">Back to home</a>
        </p>
      </motion.div>
    </div>
  );
}
