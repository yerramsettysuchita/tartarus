import { useEffect, useState } from 'react';
import { listRepos, addRepo, toggleSentinel, removeRepo, subscribe, type Repo } from '../../lib/db.ts';
import { EmptyState, timeAgo } from '../ui.tsx';

export function Repositories({ orgId }: { orgId: string }) {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try { setRepos(await listRepos()); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); const u = subscribe('repositories', load); return () => u(); }, []);

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = input.trim();
    if (!/^[^/\s]+\/[^/\s]+$/.test(name)) { setError('Use the format owner/repo'); return; }
    setBusy(true); setError(null);
    try { await addRepo(orgId, name); setInput(''); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not add repository'); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Repositories</h1>
        <p className="text-sm text-sub">Connect a repository, then run hunts against it or enable Sentinel for zero-click hunting on every push.</p>
      </div>

      <form onSubmit={onAdd} className="glass flex flex-wrap items-center gap-3 rounded-2xl p-4">
        <input
          value={input} onChange={(e) => setInput(e.target.value)} placeholder="owner/repository"
          className="min-w-[220px] flex-1 rounded-xl border border-white/70 bg-white/70 px-4 py-2.5 font-mono text-sm text-ink outline-none placeholder:text-mut focus:border-brand/50 focus:ring-2 focus:ring-brand/20"
        />
        <button type="submit" disabled={busy} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#6b6bff,#4f46e5)' }}>
          {busy ? 'Connecting…' : 'Connect repository'}
        </button>
        {error && <div className="w-full text-[13px] text-critical">{error}</div>}
      </form>

      <div className="glass rounded-2xl p-2">
        {loading ? (
          <div className="py-12 text-center text-sm text-mut">Loading…</div>
        ) : repos.length === 0 ? (
          <EmptyState title="No repositories connected" hint="Add one above to get started, for example your-org/your-repo." />
        ) : (
          <ul className="divide-y divide-slate-200/60">
            {repos.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-mut">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.1-1.47-1.1-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" /></svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-sm font-medium text-ink">{r.full_name}</div>
                  <div className="text-xs text-sub">Added {timeAgo(r.created_at)}</div>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-sub">
                  <span>Sentinel</span>
                  <input type="checkbox" checked={r.sentinel} onChange={(e) => toggleSentinel(r.id, e.target.checked).then(load)} className="peer sr-only" />
                  <span className="relative h-5 w-9 rounded-full bg-slate-300 transition peer-checked:bg-brand after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4" />
                </label>
                <button onClick={() => removeRepo(r.id).then(load)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-sub transition hover:border-red-300 hover:text-critical">Remove</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
