import { useState } from 'react';
import { motion } from 'framer-motion';
import { buildSplitDiff, type Cell } from './diff.ts';
import type { ApprovalData, DiffFile } from './types.ts';

const SEVERITY: Record<string, { label: string; cls: string }> = {
  critical: { label: 'Critical', cls: 'bg-red-50 text-red-700 ring-red-600/20' },
  high: { label: 'High', cls: 'bg-red-50 text-red-700 ring-red-600/20' },
  medium: { label: 'Medium', cls: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  low: { label: 'Low', cls: 'bg-slate-100 text-ink ring-slate-500/20' },
};

const CELL_CLS: Record<Cell['kind'], string> = {
  context: 'diff-context', del: 'diff-del', add: 'diff-add', empty: 'diff-empty',
};
const GUTTER: Record<Cell['kind'], string> = { context: ' ', del: '-', add: '+', empty: ' ' };

function DiffView({ file }: { file: DiffFile }) {
  const isNew = file.before.trim() === '';
  const { rows, added, deleted } = buildSplitDiff(file.before, file.after);
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <svg width="14" height="14" viewBox="0 0 16 16" className="text-slate-400" fill="currentColor"><path d="M4.5 1.5A1.5 1.5 0 0 0 3 3v10a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 13 13V5.5L9 1.5H4.5Z" opacity=".6"/></svg>
        <span className="flex-1 font-mono text-xs font-medium text-ink">{file.path}</span>
        {isNew && <span className="rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 ring-1 ring-green-600/20">new file</span>}
        <span className="rounded bg-green-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-green-700">+{added}</span>
        <span className="rounded bg-red-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-red-700">&minus;{deleted}</span>
      </div>
      <div className="grid grid-cols-2 border-b border-slate-100 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide">
        <div className="border-r border-slate-200 px-3 py-1 text-red-700">Before · vulnerable</div>
        <div className="px-3 py-1 text-green-700">After · patched</div>
      </div>
      <div className="scroll-quiet max-h-72 overflow-auto bg-white font-mono text-[11.5px] leading-relaxed">
        {rows.map((r, i) => (
          <div key={i} className="diff-grid">
            <div className={`diff-cell border-r border-slate-100 ${CELL_CLS[r.left.kind]}`}>
              <span className="gut">{GUTTER[r.left.kind]}</span>
              <span dangerouslySetInnerHTML={{ __html: r.left.html || ' ' }} />
            </div>
            <div className={`diff-cell ${CELL_CLS[r.right.kind]}`}>
              <span className="gut">{GUTTER[r.right.kind]}</span>
              <span dangerouslySetInnerHTML={{ __html: r.right.html || ' ' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Confidence({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const tone = pct >= 85 ? 'text-green-700' : pct >= 65 ? 'text-amber-700' : 'text-sub';
  const bar = pct >= 85 ? 'bg-green-500' : pct >= 65 ? 'bg-amber-500' : 'bg-slate-400';
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-sub">Confidence</span>
        <span className={`tnum text-sm font-semibold ${tone}`}>{pct}%</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ApprovalModal({ data, onDecide }: {
  data: ApprovalData;
  onDecide: (id: string, d: 'allow' | 'deny') => void;
}) {
  const [busy, setBusy] = useState(false);
  const decide = async (d: 'allow' | 'deny') => { setBusy(true); await onDecide(data.id, d); };
  const sev = SEVERITY[(data.severity ?? '').toLowerCase()] ?? SEVERITY.high!;
  const files = data.diffs?.map((f) => f.path) ?? [];

  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ scale: 0.96, y: 16, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className="flex max-h-[90vh] w-[min(880px,96vw)] flex-col overflow-hidden rounded-2xl border border-white/70 bg-white/90 shadow-2xl backdrop-blur-xl"
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-slate-200 bg-amber-50/60 px-6 py-4">
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/></svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-semibold text-slate-900">Human approval required</h2>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${sev.cls}`}>{sev.label}</span>
            </div>
            <p className="mt-0.5 text-[13px] text-sub">
              The harness paused the agent. <span className="font-medium text-ink">{data.tool}</span> cannot run without your approval.
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="scroll-quiet flex-1 space-y-4 overflow-auto px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
              <div className="text-xs font-medium text-sub">Vulnerability</div>
              <div className="mt-1 text-[13px] font-medium text-ink">{data.vulnerability ?? data.title ?? 'Security defect'}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
              <div className="text-xs font-medium text-sub">Blast radius</div>
              <div className="mt-1 text-[13px] font-medium text-ink">{files.length} file{files.length === 1 ? '' : 's'} changed</div>
              <div className="mt-0.5 truncate font-mono text-[11px] text-sub">{files.join(', ') || 'none'}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
              <Confidence value={data.confidence ?? 0.6} />
              <div className="mt-1 text-[11px] text-sub">
                {data.exploitConfirmed ? 'Exploit confirmed in sandbox' : 'Exploit unconfirmed'}
              </div>
            </div>
          </div>

          {data.summary && (
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-[13px] leading-relaxed text-sub">
              {data.summary}
            </div>
          )}

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-sub">Proposed change · review before approving</div>
            <div className="space-y-3">
              {(data.diffs ?? []).map((f) => <DiffView key={f.path} file={f} />)}
              {(!data.diffs || data.diffs.length === 0) && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-sub">No file changes were provided with this request.</div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <span className="text-[11px] text-slate-400">Enforced by TrueForge <code className="font-mono">require_approval_for_tools</code></span>
          <div className="flex gap-3">
            <button
              disabled={busy}
              onClick={() => decide('deny')}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-ink transition hover:bg-slate-50 disabled:opacity-50"
            >
              Reject
            </button>
            <button
              disabled={busy}
              onClick={() => decide('allow')}
              className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-50"
            >
              Approve &amp; open PR
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
