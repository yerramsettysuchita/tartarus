// Small shared UI helpers for the app pages.

const STATUS: Record<string, string> = {
  queued: 'bg-slate-100 text-sub ring-slate-500/20',
  scanning: 'bg-indigo-50 text-brand ring-indigo-600/20',
  detonating: 'bg-red-50 text-critical ring-red-600/20',
  awaiting_approval: 'bg-amber-50 text-gate ring-amber-600/20',
  patching: 'bg-cyan-50 text-cyan ring-cyan-600/20',
  done: 'bg-green-50 text-success ring-green-600/20',
  denied: 'bg-slate-100 text-sub ring-slate-500/20',
  error: 'bg-red-50 text-critical ring-red-600/20',
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STATUS[status] ?? STATUS.queued;
  const label = status.replace(/_/g, ' ');
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ring-1 ring-inset ${cls}`}>
      {label}
    </span>
  );
}

export function SeverityDot({ severity }: { severity: string }) {
  const color = /crit/i.test(severity) ? 'bg-red-600' : /high/i.test(severity) ? 'bg-red-500'
    : /med/i.test(severity) ? 'bg-amber-500' : 'bg-slate-400';
  return <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} />;
}

export function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); return `${d}d ago`;
}

export function EmptyState({ title, hint, action }: { title: string; hint: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white/40 py-14 text-center">
      <div className="text-sm font-semibold text-sub">{title}</div>
      <div className="mx-auto mt-1 max-w-xs text-xs text-mut">{hint}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
