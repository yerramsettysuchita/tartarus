import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.tsx';
import { useWorkspace } from '../workspace/useWorkspace.ts';
import { Dashboard } from './pages/Dashboard.tsx';
import { Hunts } from './pages/Hunts.tsx';
import { Repositories } from './pages/Repositories.tsx';
import { Settings } from './pages/Settings.tsx';

type View = 'dashboard' | 'hunts' | 'repos' | 'settings';

const NAV: { view: View; label: string; icon: string }[] = [
  { view: 'dashboard', label: 'Dashboard', icon: 'M3 12l9-9 9 9M5 10v10h14V10' },
  { view: 'hunts', label: 'Hunts', icon: 'M4 4h16v4H4zM4 12h16v8H4z' },
  { view: 'repos', label: 'Repositories', icon: 'M12 2l9 5v10l-9 5-9-5V7z' },
  { view: 'settings', label: 'Settings', icon: 'M12 15a3 3 0 100-6 3 3 0 000 6z' },
];

function parseView(): View {
  const h = window.location.hash;
  if (!h.startsWith('#app')) return 'dashboard';
  const rest = h.slice(4).replace(/^\//, '');
  return (['hunts', 'repos', 'settings'].includes(rest) ? rest : 'dashboard') as View;
}
function goTo(view: string) {
  window.location.hash = view === 'dashboard' ? 'app' : `app/${view}`;
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);
  const email = user?.email ?? '';
  const avatar = (user?.user_metadata?.avatar_url as string | undefined) ?? '';
  const initial = (email[0] ?? 'U').toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-full border border-white/70 bg-white/60 py-1 pl-1 pr-3 text-sm transition hover:bg-white/80">
        {avatar
          ? <img src={avatar} alt="" className="h-7 w-7 rounded-full" />
          : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">{initial}</span>}
        <span className="hidden max-w-[160px] truncate text-xs font-medium text-sub sm:block">{email}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-mut"><path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-white/70 bg-white/90 shadow-xl backdrop-blur">
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="truncate text-sm font-medium text-ink">{email}</div>
            <div className="text-[11px] text-mut">Signed in</div>
          </div>
          <button onClick={() => { setOpen(false); goTo('settings'); }} className="block w-full px-4 py-2.5 text-left text-sm text-sub hover:bg-slate-50">Settings</button>
          <button onClick={() => { void signOut(); window.location.hash = ''; }} className="block w-full border-t border-slate-100 px-4 py-2.5 text-left text-sm font-medium text-critical hover:bg-red-50">Sign out</button>
        </div>
      )}
    </div>
  );
}

export default function AppShell() {
  const [view, setView] = useState<View>(parseView);
  const { org, profile, loading, reload } = useWorkspace();

  useEffect(() => {
    const onHash = () => setView(parseView());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const orgName = org?.name ?? 'your workspace';

  return (
    <div className="flex min-h-screen">
      <div className="mesh"><span className="blob b1" /><span className="blob b2" /><span className="blob b3" /></div>
      <div className="grain" />

      {/* Sidebar */}
      <aside className="glass sticky top-3.5 m-3.5 mr-0 hidden h-[calc(100vh-28px)] w-56 shrink-0 flex-col rounded-2xl lg:flex">
        <div className="flex items-center gap-3 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ background: 'linear-gradient(145deg,#6b6bff,#4f46e5)', boxShadow: '0 6px 16px -4px rgba(91,91,240,.6)' }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /></svg>
          </div>
          <div className="min-w-0">
            <div className="font-display text-lg font-extrabold leading-none tracking-tight" style={{ background: 'linear-gradient(90deg,#4f46e5,#0891b2)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Tartarus</div>
            <div className="mt-1 truncate text-[11px] text-sub">{orgName}</div>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-2.5">
          {NAV.map((n) => (
            <button key={n.view} onClick={() => goTo(n.view)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${view === n.view ? 'bg-brand/10 font-semibold text-brand' : 'text-sub hover:bg-white/60'}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={n.icon} /></svg>{n.label}
            </button>
          ))}
        </nav>
        <div className="p-3.5 text-center text-[10px] text-mut">v0.1.0 · TrueForge</div>
      </aside>

      {/* Main column */}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-2 lg:hidden">
              <span className="font-display text-lg font-extrabold" style={{ background: 'linear-gradient(90deg,#4f46e5,#0891b2)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Tartarus</span>
            </div>
            <div className="hidden text-sm font-medium capitalize text-ink lg:block">{view}</div>
            <UserMenu />
          </div>
          {/* mobile nav */}
          <div className="flex gap-1 overflow-x-auto px-4 pb-2 lg:hidden">
            {NAV.map((n) => (
              <button key={n.view} onClick={() => goTo(n.view)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ${view === n.view ? 'bg-brand/10 text-brand' : 'text-sub'}`}>{n.label}</button>
            ))}
          </div>
        </header>

        <main className="px-6 pb-12 pt-2">
          {loading ? (
            <div className="py-24 text-center text-sm text-mut">Loading your workspace…</div>
          ) : view === 'dashboard' ? (
            <Dashboard orgName={orgName} goTo={goTo} />
          ) : view === 'hunts' ? (
            <Hunts orgId={org?.id ?? ''} goTo={goTo} />
          ) : view === 'repos' ? (
            <Repositories orgId={org?.id ?? ''} />
          ) : (
            <Settings org={org} profile={profile} onSaved={reload} />
          )}
        </main>
      </div>
    </div>
  );
}
