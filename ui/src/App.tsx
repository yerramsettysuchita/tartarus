import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { useHuntStream, sendApproval } from './useHuntStream.ts';
import { ApprovalModal } from './ApprovalModal.tsx';
import { IsoSandbox, type IsoState } from './IsoSandbox.tsx';
import { Gauge } from './Gauge.tsx';
import type { HuntEvent, ApprovalData, ScanFile } from './types.ts';

function lastData<T>(events: HuntEvent[], kind: string): T | undefined {
  for (let i = events.length - 1; i >= 0; i--) if (events[i]!.kind === kind) return events[i]!.data as T;
  return undefined;
}

const STEPS = [
  { key: 'scan', label: 'Scan repository', hint: 'Fetch source and locate candidate vulnerabilities.' },
  { key: 'detonate', label: 'Detonate exploit', hint: 'Prove the bug inside an isolated sandbox.' },
  { key: 'approve', label: 'Human approval', hint: 'The gold gate. A person authorises the change.' },
  { key: 'patch', label: 'Open remediation PR', hint: 'Commit the fix and open a pull request.' },
] as const;

type StepState = 'pending' | 'active' | 'done';

function useStepStates(events: HuntEvent[]): StepState[] {
  return useMemo(() => {
    let reached = -1;
    for (const e of events) {
      const d = e.data as { tool?: string; gate?: boolean } | undefined;
      if ((e.kind === 'phase' && d?.tool === 'scan_repo_for_vulns') || e.kind === 'scan') reached = Math.max(reached, 0);
      if ((e.kind === 'phase' && d?.tool === 'run_exploit_in_sandbox') || e.kind === 'verdict') reached = Math.max(reached, 1);
      if (e.kind === 'approval_required' || (e.kind === 'phase' && d?.gate)) reached = Math.max(reached, 2);
      if (e.kind === 'pr_opened' || (e.kind === 'phase' && d?.tool === 'create_patch_pr')) reached = Math.max(reached, 3);
    }
    const done = events.some((e) => e.kind === 'done');
    return STEPS.map((_, i) => (done && i <= reached ? 'done' : i < reached ? 'done' : i === reached ? 'active' : 'pending'));
  }, [events]);
}

function deriveIso(events: HuntEvent[], states: StepState[]): IsoState {
  if (events.length === 0) return 'idle';
  if (events.some((e) => e.kind === 'pr_opened')) return 'done';
  if (states[1] === 'active' || states[1] === 'done') return 'detonating'; // threat is live until patched
  if (states[0] !== 'pending') return 'scanning';
  return 'idle';
}

/** Smoothly eased sandbox telemetry that tracks the current phase. */
function useTelemetry(state: IsoState): { cpu: number; mem: number } {
  const [t, setT] = useState({ cpu: 6, mem: 120 });
  useEffect(() => {
    const target = state === 'detonating' ? { c: 86, m: 430 } : state === 'scanning' ? { c: 34, m: 220 } : state === 'done' ? { c: 12, m: 175 } : { c: 6, m: 120 };
    const id = setInterval(() => {
      setT((p) => ({
        cpu: Math.max(3, Math.min(99, p.cpu + (target.c - p.cpu) * 0.25 + (Math.random() - 0.5) * 8)),
        mem: Math.max(80, Math.min(512, p.mem + (target.m - p.mem) * 0.25 + (Math.random() - 0.5) * 14)),
      }));
    }, 350);
    return () => clearInterval(id);
  }, [state]);
  return t;
}

const RECENT = [
  { repo: 'acme/payments-api', vuln: 'SQL injection', sev: 'high', status: 'Merged', when: '2h ago' },
  { repo: 'acme/auth-service', vuln: 'Path traversal', sev: 'medium', status: 'Merged', when: 'Yesterday' },
  { repo: 'acme/notifications', vuln: 'SSRF', sev: 'high', status: 'In review', when: '2d ago' },
  { repo: 'acme/billing-worker', vuln: 'Command injection', sev: 'critical', status: 'Merged', when: '3d ago' },
];

const sevPill = (sev: string) =>
  /crit|high/i.test(sev) ? 'bg-red-50 text-critical ring-red-600/20'
    : /med/i.test(sev) ? 'bg-amber-50 text-gate ring-amber-600/20'
    : 'bg-slate-100 text-sub ring-slate-500/20';

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item: Variants = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 24 } } };

const NAV = [
  { label: 'Dashboard', active: true, icon: 'M3 12l9-9 9 9M5 10v10h14V10' },
  { label: 'Hunts', active: false, icon: 'M4 4h16v4H4zM4 12h16v8H4z' },
  { label: 'Sandboxes', active: false, icon: 'M12 2l9 5v10l-9 5-9-5V7z' },
  { label: 'Settings', active: false, icon: 'M12 15a3 3 0 100-6 3 3 0 000 6z' },
];

function Sidebar() {
  return (
    <aside className="glass sticky top-3.5 m-3.5 mr-0 hidden h-[calc(100vh-28px)] w-56 shrink-0 flex-col rounded-2xl lg:flex">
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ background: 'linear-gradient(145deg,#6b6bff,#4f46e5)', boxShadow: '0 6px 16px -4px rgba(91,91,240,.6)' }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /></svg>
        </div>
        <div>
          <div className="font-display text-lg font-extrabold tracking-tight" style={{ background: 'linear-gradient(90deg,#4f46e5,#0891b2)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Tartarus</div>
          <div className="text-[11px] text-sub">SecOps Platform</div>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-2.5">
        {NAV.map((n) => (
          <a key={n.label} href="#" onClick={(e) => e.preventDefault()} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${n.active ? 'bg-brand/10 font-semibold text-brand' : 'text-sub hover:bg-white/60'}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={n.icon} /></svg>{n.label}
          </a>
        ))}
      </nav>
      <div className="p-3.5">
        <div className="rounded-xl border border-white/70 bg-white/50 p-3">
          <div className="text-[11px] font-semibold text-sub">Sentinel</div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-sub"><span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Watching for pushes</div>
        </div>
        <div className="mt-3 text-center text-[10px] text-mut">v0.1.0 · TrueForge</div>
      </div>
    </aside>
  );
}

function StepIndicator({ state, n }: { state: StepState; n: number }) {
  if (state === 'done') return (
    <div className="flex h-7 w-7 items-center justify-center rounded-full text-white" style={{ background: 'linear-gradient(135deg,#6b6bff,#4f46e5)', boxShadow: '0 6px 14px -4px rgba(79,70,229,.5)' }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
    </div>
  );
  if (state === 'active') return (
    <motion.div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-brand bg-white"
      animate={{ boxShadow: ['0 0 0 0 rgba(91,91,240,.35)', '0 0 0 8px rgba(91,91,240,0)'] }} transition={{ duration: 1.8, repeat: Infinity }}>
      <span className="h-2 w-2 rounded-full bg-brand" />
    </motion.div>
  );
  return <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-slate-300 bg-white/70 text-mut"><span className="tnum text-[11px] font-semibold">{n}</span></div>;
}

function Stepper({ events, states }: { events: HuntEvent[]; states: StepState[] }) {
  const lastMsg = [...events].reverse().find((e) => e.kind === 'phase' || e.kind === 'log')?.message;
  return (
    <ol className="space-y-1">
      {STEPS.map((step, i) => {
        const state = states[i]!;
        return (
          <li key={step.key} className="relative flex gap-3 pb-2">
            {i < STEPS.length - 1 && <span className={`absolute left-[13px] top-8 h-[calc(100%-10px)] w-0.5 rounded ${state === 'done' ? 'bg-gradient-to-b from-brand to-cyan' : 'bg-slate-200'}`} />}
            <StepIndicator state={state} n={i + 1} />
            <div className="flex-1 pt-0.5">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold ${state === 'pending' ? 'text-mut' : 'text-ink'}`}>{step.label}</span>
                {state === 'active' && <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">In progress</span>}
                {state === 'done' && <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-success">Done</span>}
              </div>
              <p className="mt-0.5 text-xs text-sub">{step.hint}</p>
              {state === 'active' && lastMsg && <p className="mt-1.5 line-clamp-2 rounded-md border border-white/70 bg-white/60 px-2 py-1 font-mono text-[11px] text-sub">{lastMsg}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Card({ title, tone = 'plain', children }: { title: string; tone?: 'plain' | 'red' | 'green' | 'amber'; children: React.ReactNode }) {
  const border = { plain: '', red: 'ring-1 ring-red-200', green: 'ring-1 ring-green-200', amber: 'ring-1 ring-amber-200' }[tone];
  return (
    <motion.div variants={item} className={`glass rounded-2xl ${border}`}>
      <div className="px-4 pb-2 pt-3.5 text-[11px] font-bold uppercase tracking-wide text-mut">{title}</div>
      <div className="px-4 pb-4">{children}</div>
    </motion.div>
  );
}

function RecentHunts() {
  return (
    <Card title="Recent hunts">
      <div className="divide-y divide-slate-200/70">
        {RECENT.map((h) => (
          <div key={h.repo} className="flex items-center gap-3 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-mut">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.1-1.47-1.1-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" /></svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-mono text-[13px] font-medium text-ink">{h.repo}</div>
              <div className="text-xs text-sub">{h.vuln} · {h.when}</div>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${sevPill(h.sev)}`}>{h.sev[0]!.toUpperCase() + h.sev.slice(1)}</span>
            <span className="hidden text-xs font-medium text-success sm:inline">{h.status}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function EvidencePanel({ events }: { events: HuntEvent[] }) {
  const scan = lastData<{ files?: ScanFile[]; summary?: string }>(events, 'scan');
  const verdict = lastData<{ verdict?: string; exploited?: boolean; stdout?: string; exitCode?: number }>(events, 'verdict');
  const pr = lastData<{ url?: string; number?: number }>(events, 'pr_opened');
  const flagged = (scan?.files ?? []).filter((f) => f.hints?.length);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
      {scan && (
        <Card title="Scan findings">
          <div className="mb-2 text-[13px] text-sub">{scan.summary ?? `${scan.files?.length ?? 0} files scanned`}</div>
          <div className="space-y-1.5">
            {flagged.length === 0 && <div className="text-xs text-mut">No suspicious sinks flagged.</div>}
            {flagged.map((f) => (
              <div key={f.path} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/70 bg-white/50 px-3 py-2">
                <span className="font-mono text-xs font-medium text-sub">{f.path}</span>
                {f.hints.map((h, i) => <span key={i} className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-gate ring-1 ring-amber-600/20">{h}</span>)}
              </div>
            ))}
          </div>
        </Card>
      )}
      {verdict && (
        <Card title="Sandbox detonation" tone={verdict.exploited ? 'red' : 'plain'}>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${verdict.exploited ? 'bg-red-50 text-critical ring-red-600/20' : 'bg-slate-100 text-sub ring-slate-500/20'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${verdict.exploited ? 'bg-critical' : 'bg-slate-400'}`} />{verdict.exploited ? 'Exploit confirmed' : 'Not confirmed'}
            </span>
            <span className="tnum text-xs text-mut">exit {verdict.exitCode ?? 0}</span>
          </div>
          {verdict.stdout && (
            <pre className="scroll-quiet mt-3 max-h-44 overflow-auto rounded-xl bg-slate-900 p-3 font-mono text-[11.5px] leading-relaxed">
              {String(verdict.stdout).split('\n').map((l, i) => (
                <div key={i} className={l.includes('TARTARUS_EXPLOIT_OK') ? 'text-red-300' : l.includes('AKIA') || l.includes('secret') ? 'text-amber-200' : 'text-slate-300'}>{l || ' '}</div>
              ))}
            </pre>
          )}
        </Card>
      )}
      {pr && (
        <Card title="Remediation" tone="green">
          <div className="flex items-center gap-2 text-[13px]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-success"><path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span className="text-sub">Pull request opened</span>
            {pr.url && <a href={pr.url} target="_blank" rel="noreferrer" className="font-mono text-xs text-brand hover:underline">#{pr.number ?? ''}</a>}
          </div>
          <p className="mt-1 text-xs text-sub">Awaiting Qodo <code className="font-mono">/agentic_review</code>. If changes are requested, the self-heal loop pushes an improved patch.</p>
        </Card>
      )}
    </motion.div>
  );
}

function StatusPill({ events, pendingCount }: { events: HuntEvent[]; pendingCount: number }) {
  const hasError = events.some((e) => e.kind === 'error');
  const done = events.some((e) => e.kind === 'done');
  const [label, cls, dot] = hasError ? ['Error', 'bg-red-50 text-critical ring-red-600/20', 'bg-critical']
    : pendingCount > 0 ? ['Awaiting approval', 'bg-amber-50 text-gate ring-amber-600/20', 'bg-amber-500']
    : done ? ['Complete', 'bg-green-50 text-success ring-green-600/20', 'bg-green-500']
    : events.length ? ['Running', 'bg-indigo-50 text-brand ring-indigo-600/20', 'bg-brand']
    : ['Ready', 'bg-slate-100 text-sub ring-slate-500/20', 'bg-slate-400'];
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${cls}`}><span className={`h-1.5 w-1.5 rounded-full ${dot}`} />{label}</span>;
}

export default function App() {
  const { events, connected, pending } = useHuntStream();
  const states = useStepStates(events);
  const iso = deriveIso(events, states);
  const tele = useTelemetry(iso);
  const current = pending[0];
  const idle = events.length === 0;

  const repo = lastData<{ repo?: string }>(events, 'boot')?.repo ?? 'acme/Tartarus-Patient-Zero';
  const approval = current ?? (([...events].reverse().find((e) => e.kind === 'approval_required')?.data) as ApprovalData | undefined);
  const vuln = approval?.vulnerability ?? approval?.title;
  const severity = approval?.severity;
  const confidence = approval?.confidence != null ? Math.round(approval.confidence * 100) : (iso === 'detonating' || iso === 'done' ? 95 : 0);
  const sevPct = severity ? (/crit/i.test(severity) ? 100 : /high/i.test(severity) ? 82 : /med/i.test(severity) ? 55 : 30) : 0;

  const onDecide = async (id: string, d: 'allow' | 'deny') => { await sendApproval(id, d); };

  return (
    <>
      <div className="mesh"><span className="blob b1" /><span className="blob b2" /><span className="blob b3" /></div>
      <div className="grain" />

      <div className="flex min-h-screen">
        <Sidebar />
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30">
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-3">
                <h1 className="font-display text-xl font-bold tracking-tight text-ink">Dashboard</h1>
                <span className="hidden items-center gap-2 rounded-xl border border-white/70 bg-white/60 px-2.5 py-1 font-mono text-xs text-sub shadow-sm sm:inline-flex">{repo}</span>
              </div>
              <div className="flex items-center gap-3">
                <StatusPill events={events} pendingCount={pending.length} />
                <span className="inline-flex items-center gap-1.5 text-xs text-sub"><span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-slate-300'}`} />{connected ? 'Live' : 'Offline'}</span>
              </div>
            </div>
          </header>

          <main className="px-6 pb-10">
            {/* HERO: the isometric sandbox is the signature of the product */}
            <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 26 }} className="mb-5">
              <IsoSandbox state={iso} cpu={tele.cpu} mem={tele.mem} />
            </motion.section>

            {/* Summary strip with gauges */}
            <motion.section variants={container} initial="hidden" animate="show" className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <motion.div variants={item} className="glass rounded-2xl px-4 py-3.5"><div className="text-xs font-medium text-sub">Target</div><div className="mt-1 truncate font-mono text-sm font-bold text-ink">{repo}</div></motion.div>
              <motion.div variants={item} className="glass rounded-2xl px-4 py-3.5"><div className="text-xs font-medium text-sub">Vulnerability</div><div className="mt-1 truncate text-sm font-bold text-ink">{vuln ?? (idle ? 'Awaiting push' : 'Scanning')}</div></motion.div>
              <motion.div variants={item} className="glass rounded-2xl px-4 py-3"><Gauge pct={sevPct} color="#dc2626" center={severity ? severity[0]!.toUpperCase() : '–'} label={severity ? severity[0]!.toUpperCase() + severity.slice(1) : 'Pending'} sub="Risk level" /></motion.div>
              <motion.div variants={item} className="glass rounded-2xl px-4 py-3"><Gauge pct={confidence} color="#15803d" center={confidence ? String(confidence) : '–'} label={confidence ? `${confidence}%` : 'Pending'} sub="Exploit proof" /></motion.div>
            </motion.section>

            {/* Two-column workspace */}
            <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <motion.section variants={item} initial="hidden" animate="show" className="glass h-fit rounded-2xl p-5">
                <h2 className="mb-4 font-display text-[15px] font-bold tracking-tight text-ink">Agent activity</h2>
                <Stepper events={events} states={states} />
              </motion.section>
              <section>
                <h2 className="mb-4 font-display text-[15px] font-bold tracking-tight text-ink">{idle ? 'Recent hunts' : 'Evidence and findings'}</h2>
                <motion.div variants={container} initial="hidden" animate="show">
                  {idle ? <RecentHunts /> : <EvidencePanel events={events} />}
                </motion.div>
              </section>
            </div>
          </main>
        </div>
      </div>

      <AnimatePresence>
        {current && <ApprovalModal key={current.id} data={current} onDecide={onDecide} />}
      </AnimatePresence>
    </>
  );
}
