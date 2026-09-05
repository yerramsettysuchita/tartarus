import { useEffect, useState } from 'react';
import { IsoSandbox } from '../../IsoSandbox.tsx';
import { listHunts, listRepos, listFindings, subscribe, type Hunt } from '../../lib/db.ts';
import { StatusBadge, SeverityDot, timeAgo } from '../ui.tsx';

export function Dashboard({ orgName, goTo }: { orgName: string; goTo: (v: string) => void }) {
  const [hunts, setHunts] = useState<Hunt[]>([]);
  const [repos, setRepos] = useState(0);
  const [findings, setFindings] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [h, r, f] = await Promise.all([listHunts(), listRepos(), listFindings()]);
      setHunts(h); setRepos(r.length); setFindings(f.length);
    } finally { setLoading(false); }
  };
  useEffect(() => {
    void load();
    const u1 = subscribe('hunts', load);
    const u2 = subscribe('findings', load);
    return () => { u1(); u2(); };
  }, []);

  const stats = [
    { k: 'Repositories', v: repos },
    { k: 'Hunts', v: hunts.length },
    { k: 'Findings', v: findings },
    { k: 'Running', v: hunts.filter((h) => !['done', 'denied', 'error'].includes(h.status)).length },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Welcome to {orgName}</h1>
        <p className="text-sm text-sub">Your autonomous SecOps workspace.</p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.k} className="glass rounded-2xl px-5 py-4">
            <div className="text-xs font-medium text-sub">{s.k}</div>
            <div className="font-display tnum mt-1 text-3xl font-extrabold text-ink">{loading ? '—' : s.v}</div>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section>
          <IsoSandbox state="idle" cpu={6} mem={120} />
        </section>
        <section className="glass rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Recent hunts</h2>
            <button onClick={() => goTo('hunts')} className="text-xs font-semibold text-brand hover:underline">View all</button>
          </div>
          {loading ? (
            <div className="py-10 text-center text-sm text-mut">Loading…</div>
          ) : hunts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center">
              <div className="text-sm font-medium text-sub">No hunts yet</div>
              <button onClick={() => goTo('hunts')} className="mt-2 text-xs font-semibold text-brand hover:underline">Start your first hunt</button>
            </div>
          ) : (
            <ul className="divide-y divide-slate-200/70">
              {hunts.slice(0, 6).map((h) => (
                <li key={h.id} className="flex items-center gap-3 py-2.5">
                  <SeverityDot severity="high" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-[13px] font-medium text-ink">{h.repo}</div>
                    <div className="text-xs text-sub">{timeAgo(h.created_at)}</div>
                  </div>
                  <StatusBadge status={h.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
