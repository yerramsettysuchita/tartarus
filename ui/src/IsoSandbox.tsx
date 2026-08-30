import { motion } from 'framer-motion';

export type IsoState = 'idle' | 'scanning' | 'detonating' | 'done';

const N = 6;          // grid is N x N nodes
const TW = 42, TH = 21;
const OX = 300, OY = 66;
const BASE_H = 7, CORE_H = 24;
const CORE = { i: 3, j: 2 };  // the vulnerable node

interface Tile { i: number; j: number; cx: number; cy: number; h: number; core: boolean; order: number }

const TILES: Tile[] = (() => {
  const out: Tile[] = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const core = i === CORE.i && j === CORE.j;
    out.push({ i, j, cx: OX + (i - j) * TW / 2, cy: OY + (i + j) * TH / 2, h: core ? CORE_H : BASE_H, core, order: i + j });
  }
  return out.sort((a, b) => a.order - b.order); // painter's order: back to front
})();

function facePaths(t: Tile) {
  const { cx, cy, h } = t;
  const top = `M${cx},${cy - TH / 2 - h} L${cx + TW / 2},${cy - h} L${cx},${cy + TH / 2 - h} L${cx - TW / 2},${cy - h} Z`;
  const left = `M${cx - TW / 2},${cy - h} L${cx},${cy + TH / 2 - h} L${cx},${cy + TH / 2} L${cx - TW / 2},${cy} Z`;
  const right = `M${cx + TW / 2},${cy - h} L${cx},${cy + TH / 2 - h} L${cx},${cy + TH / 2} L${cx + TW / 2},${cy} Z`;
  return { top, left, right };
}

const core = TILES.find((t) => t.core)!;
const coreCx = core.cx, coreCy = core.cy - core.h;

/**
 * The signature element: an isometric view of the sandbox as a grid of nodes.
 * At idle it breathes. Scanning sweeps blue across the field. Detonating flashes
 * the vulnerable node red and emits shockwaves, with live telemetry overlaid.
 */
export function IsoSandbox({ state, cpu, mem }: { state: IsoState; cpu: number; mem: number }) {
  const label = { idle: 'Standing by', scanning: 'Scanning', detonating: 'Detonating', done: 'Contained' }[state];
  const labelCls = {
    idle: 'text-mut', scanning: 'text-info', detonating: 'text-critical', done: 'text-success',
  }[state];

  return (
    <div className="glass relative overflow-hidden rounded-2xl">
      {/* header row */}
      <div className="absolute left-5 top-4 z-10 flex items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-mut">Sandbox</span>
        <span className="rounded-full border border-white/70 bg-white/70 px-2 py-0.5 font-mono text-[11px] text-sub">node:22 · isolated</span>
      </div>
      <div className="absolute right-5 top-4 z-10">
        <span className={`inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/80 px-2.5 py-1 text-[11px] font-semibold ${labelCls}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${state === 'detonating' ? 'bg-critical' : state === 'scanning' ? 'bg-info' : state === 'done' ? 'bg-success' : 'bg-slate-400'}`} />
          {label}
        </span>
      </div>

      <motion.svg
        viewBox="0 0 600 250" className={`iso ${state} block w-full`} style={{ height: 250 }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}
      >
        {/* soft platform glow */}
        <ellipse cx={OX} cy={OY + (N - 1) * TH} rx={N * TW * 0.62} ry={N * TH * 0.7} fill="rgba(79,70,229,0.06)" />
        {TILES.map((t) => {
          const f = facePaths(t);
          const c = t.core ? 'core' : '';
          return (
            <g key={`${t.i}-${t.j}`}>
              <path d={f.left} className={t.core ? 'core-l' : 'side'} fill={t.core ? undefined : '#c3d3ef'} />
              <path d={f.right} className={t.core ? 'core-r' : 'side'} fill={t.core ? undefined : '#b3c6ea'} />
              <path d={f.top} className={`tile ${c} ${t.core ? 'core-top' : ''}`} stroke="rgba(255,255,255,0.55)" strokeWidth="1" />
            </g>
          );
        })}
        {/* shockwaves emit from the core, shown only while detonating (CSS-gated) */}
        <g transform={`translate(${coreCx},${coreCy})`}>
          <circle className="shock s1" r="26" />
          <circle className="shock s2" r="26" />
          <circle className="shock s3" r="26" />
        </g>
      </motion.svg>

      {/* live telemetry overlay */}
      <div className="absolute inset-x-5 bottom-4 z-10 flex gap-3">
        {[
          { k: 'CPU', v: Math.round(cpu), u: '%', tone: 'text-brand' },
          { k: 'Memory', v: Math.round(mem), u: 'MB', tone: 'text-cyan' },
          { k: 'Threat', v: state === 'detonating' ? 'ACTIVE' : state === 'done' ? 'PATCHED' : '—', u: '', tone: state === 'detonating' ? 'text-critical' : 'text-mut', str: true },
        ].map((s) => (
          <div key={s.k} className="flex-1 rounded-xl border border-white/70 bg-white/70 px-3 py-2 backdrop-blur">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-mut">{s.k}</div>
            <div className={`font-mono text-[15px] font-bold ${s.tone}`}>
              {s.str ? s.v : s.v}<span className="ml-0.5 text-[10px] font-normal text-slate-400">{s.u}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
