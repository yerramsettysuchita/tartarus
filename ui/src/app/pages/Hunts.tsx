import { useEffect, useState } from 'react';
import { listHunts, listRepos, createHunt, subscribe, type Hunt, type Repo } from '../../lib/db.ts';
import { StatusBadge, EmptyState, timeAgo } from '../ui.tsx';

export function Hunts({ orgId, goTo }: { orgId: string; goTo: (v: string) => void }) {
  const [hunts, setHunts] = useState<Hunt[]>([]);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [repo, setRepo] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [h, r] = await Promise.all([listHunts(), listRepos()]);
      setHunts(h); setRepos(r);
      if (!repo && r.length) setRepo(r[0]!.full_name);
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); const u = subscribe('hunts', load); return () => u(); }, []);

  const start = async () => {
    if (!repo) return;
    setBusy(true);
    try { await createHunt(orgId, repo); await load(); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Hunts</h1>
          <p className="text-sm text-sub">Every scan, detonation, approval, and patch is recorded here.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={repo} onChange={(e) => setRepo(e.target.value)} disabled={!repos.length}
            className="rounded-xl border border-white/70 bg-white/70 px-3 py-2.5 text-sm text-ink outline-none focus:border-brand/50 focus:ring-2 focus:ring-brand/20 disabled:opacity-50">
            {repos.length === 0 ? <option>Connect a repo first</option> : repos.map((r) => <option key={r.id} value={r.full_name}>{r.full_name}</option>)}
          </select>
          <button onClick={start} disabled={busy || !repos.length}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#6b6bff,#4f46e5)' }}>
            {busy ? 'Starting…' : 'New hunt'}
          </button>
        </div>
      </div>

      <div className="glass rounded-2xl p-2">
        {loading ? (
          <div className="py-12 text-center text-sm text-mut">Loading…</div>
        ) : hunts.length === 0 ? (
          <EmptyState
            title="No hunts yet"
            hint={repos.length ? 'Pick a repository above and start a hunt.' : 'Connect a repository first, then start a hunt.'}
            action={!repos.length ? <button onClick={() => goTo('repos')} className="text-xs font-semibold text-brand hover:underline">Go to Repositories</button> : undefined}
          />
        ) : (
          <ul className="divide-y divide-slate-200/60">
            {hunts.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-sm font-medium text-ink">{h.repo}</div>
                  <div className="text-xs text-sub">Triggered {h.trigger} · {timeAgo(h.created_at)}</div>
                </div>
                <StatusBadge status={h.status} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-mut">
        New hunts are recorded as queued. Running them autonomously against live code is handled by the hunt engine
        (the CLI and Sentinel service today); wiring the cloud runner into this dashboard is the next milestone.
      </p>
    </div>
  );
}
