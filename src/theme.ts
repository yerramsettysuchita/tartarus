/**
 * theme.ts — Tartarus terminal aesthetic.
 *
 * The hackathon brief calls for a dark theme with a deliberate semantic palette:
 *   • Terminal Green → scanning / progress / safe states
 *   • Critical Red   → confirmed vulnerabilities & failures
 *   • Gold           → human-approval gates (the moment a human must decide)
 *
 * We centralise every colour here so the CLI reads consistently and a single
 * NO_COLOR check disables styling for logs / CI.
 */
import pc from 'picocolors';

/** Semantic colour roles — never call picocolors directly elsewhere. */
export const paint = {
  scan: (s: string) => pc.green(s),        // scanning phase
  scanDim: (s: string) => pc.dim(pc.green(s)),
  crit: (s: string) => pc.bold(pc.red(s)), // confirmed bug / danger
  gold: (s: string) => pc.bold(pc.yellow(s)), // human approval
  info: (s: string) => pc.cyan(s),
  muted: (s: string) => pc.dim(s),
  ok: (s: string) => pc.green('✓ ' + s),
  fail: (s: string) => pc.red('✗ ' + s),
} as const;

/** Phase banners printed as the workflow advances. */
export const banner = {
  scan: () => paint.scan('┏━ [ SCAN ] ─ hunting for vulnerabilities ' + '━'.repeat(24)),
  exploit: () => paint.crit('┏━ [ DETONATE ] ─ proving the bug in the sandbox ' + '━'.repeat(16)),
  approve: () => paint.gold('┏━ [ APPROVAL ] ─ human decision required ' + '━'.repeat(23)),
  patch: () => paint.info('┏━ [ PATCH ] ─ raising remediation PR ' + '━'.repeat(28)),
} as const;

/** Cinematic block-letter banner shown on boot — high-end SecOps-tool vibe. */
export const SIGIL = [
  paint.crit(String.raw` ████████╗ █████╗ ██████╗ ████████╗ █████╗ ██████╗ ██╗   ██╗███████╗`),
  paint.crit(String.raw` ╚══██╔══╝██╔══██╗██╔══██╗╚══██╔══╝██╔══██╗██╔══██╗██║   ██║██╔════╝`),
  paint.crit(String.raw`    ██║   ███████║██████╔╝   ██║   ███████║██████╔╝██║   ██║███████╗`),
  paint.crit(String.raw`    ██║   ██╔══██║██╔══██╗   ██║   ██╔══██║██╔══██╗██║   ██║╚════██║`),
  paint.crit(String.raw`    ██║   ██║  ██║██║  ██║   ██║   ██║  ██║██║  ██║╚██████╔╝███████║`),
  paint.crit(String.raw`    ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝`),
  '',
  '   ' + paint.gold('⚔  Autonomous Red-Team & SecOps Agent') +
    paint.muted('   ·   TrueForge · Claude · MCP'),
  '   ' + paint.scanDim('scan') + paint.muted(' → ') + paint.crit('detonate') +
    paint.muted(' → ') + paint.gold('approve') + paint.muted(' → ') + paint.info('patch'),
].join('\n');
