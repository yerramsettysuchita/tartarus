import { useState } from 'react';
import { useAuth } from '../../auth/AuthProvider.tsx';
import { updateMyProfile, type Org, type Profile } from '../../lib/db.ts';

export function Settings({ org, profile, onSaved }: { org: Org | null; profile: Profile | null; onSaved: () => void }) {
  const { user, signOut } = useAuth();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setSaved(false);
    try { await updateMyProfile({ full_name: name.trim() }); setSaved(true); onSaved(); }
    finally { setBusy(false); }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Settings</h1>
        <p className="text-sm text-sub">Manage your profile and workspace.</p>
      </div>

      <section className="glass rounded-2xl p-6">
        <h2 className="mb-4 text-sm font-semibold text-ink">Profile</h2>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-sub">Full name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name"
              className="mt-1 w-full rounded-xl border border-white/70 bg-white/70 px-4 py-2.5 text-sm text-ink outline-none focus:border-brand/50 focus:ring-2 focus:ring-brand/20" />
          </div>
          <div>
            <label className="text-xs font-medium text-sub">Email</label>
            <input value={user?.email ?? ''} disabled
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-mut" />
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={busy} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#6b6bff,#4f46e5)' }}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
            {saved && <span className="text-[13px] font-medium text-success">Saved.</span>}
          </div>
        </form>
      </section>

      <section className="glass rounded-2xl p-6">
        <h2 className="mb-4 text-sm font-semibold text-ink">Workspace</h2>
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white/50 px-4 py-3">
          <div>
            <div className="text-sm font-medium text-ink">{org?.name ?? '—'}</div>
            <div className="font-mono text-xs text-sub">{org?.slug ?? ''}</div>
          </div>
          <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-semibold text-brand">Owner</span>
        </div>
      </section>

      <section className="glass rounded-2xl p-6">
        <h2 className="mb-1 text-sm font-semibold text-ink">Sign out</h2>
        <p className="mb-4 text-xs text-sub">End your session on this device.</p>
        <button onClick={() => { void signOut(); window.location.hash = ''; }}
          className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-critical transition hover:bg-red-50">
          Sign out
        </button>
      </section>
    </div>
  );
}
