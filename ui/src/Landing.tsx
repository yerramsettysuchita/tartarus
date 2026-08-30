import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { IsoSandbox, type IsoState } from './IsoSandbox.tsx';

const CYCLE: IsoState[] = ['scanning', 'detonating', 'done', 'idle'];

function HeroVisual() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((c) => (c + 1) % CYCLE.length), 2600);
    return () => clearInterval(id);
  }, []);
  const state = CYCLE[i]!;
  const cpu = state === 'detonating' ? 84 : state === 'scanning' ? 34 : 12;
  const mem = state === 'detonating' ? 430 : state === 'scanning' ? 210 : 165;
  return (
    <div className="relative">
      <div className="overflow-hidden rounded-2xl border border-white/80 bg-white/80" style={{ boxShadow: '0 40px 80px -30px rgba(30,41,120,.5), 0 8px 20px -8px rgba(30,41,120,.2)' }}>
        <div className="flex items-center gap-2.5 border-b border-slate-200/70 bg-slate-50/90 px-3 py-2.5">
          <span className="flex gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" /><span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" /><span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" /></span>
          <span className="flex-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-center font-mono text-[11px] text-slate-400">app.tartarus.dev/dashboard</span>
        </div>
        <div className="p-3"><IsoSandbox state={state} cpu={cpu} mem={mem} /></div>
      </div>
      <div className="glass absolute -right-4 top-12 hidden w-40 rounded-xl p-3 sm:block">
        <div className="text-[10px] font-semibold text-mut">Sandbox · CPU</div>
        <div className="font-mono text-lg font-bold text-brand">{Math.round(cpu)}%</div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${cpu}%` }} /></div>
      </div>
      <div className="glass absolute -left-5 bottom-10 hidden w-44 rounded-xl p-3 sm:block">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-gate">🟡 Gold gate</span>
        <div className="mt-1.5 text-[12px] leading-snug text-sub">Human approval required before the PR opens.</div>
      </div>
    </div>
  );
}

function Icon({ d }: { d: string }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}
const Check = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>;
const Cross = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>;

const STACK = ['TrueForge', 'Claude', 'MCP', 'Daytona', 'Qodo', 'GitHub'];
const STEPS = [
  { n: '01', t: 'Scan', d: 'Read the repository and flag the dangerous sinks worth investigating.' },
  { n: '02', t: 'Detonate', d: 'Write an exploit and prove the bug inside an isolated sandbox.' },
  { n: '03', t: 'Approve', d: 'A human authorises the change at the gold gate. Nothing ships without it.' },
  { n: '04', t: 'Patch', d: 'Open a pull request that Qodo reviews, and self-heal if changes are asked.' },
];
const CMP = [
  'Proves the bug in a sandbox', 'Human approval enforced by the runtime', 'Writes the fix as a pull request',
  'Self-heals from reviewer feedback', 'Detonation isolated from your host', 'Zero-click on push via webhook',
  'Open, inspectable agent loop', 'Evidence, not a triage backlog',
];
const ARCH = [
  { t: 'GitHub', s: 'Source and PRs', tone: '', icon: 'M12 3v18M3 12h18' },
  { t: 'TrueForge', s: 'Harness · Claude', tone: '', icon: 'M12 2l3 7 7 .5-5.5 4.5L18 21l-6-4-6 4 1.5-7L2 9.5 9 9z' },
  { t: 'Daytona', s: 'Isolated sandbox', tone: 'red', icon: 'M12 2l9 5v10l-9 5-9-5V7z' },
  { t: 'Qodo', s: 'Reviews the PR', tone: 'green', icon: 'M20 6 9 17l-5-5' },
];
const FEATURES = [
  { t: 'It proves, it never guesses', d: 'Every finding is backed by an exploit that actually triggered the bug in a sandbox. No pile of maybe-vulnerabilities to triage.', icon: 'M9 12l2 2 4-4M12 3l7 4v5c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V7z' },
  { t: 'The gold gate is enforced', d: 'The agent physically cannot open a pull request until a human approves. It is a runtime boundary, not a line in a prompt.', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zM8 11V7a4 4 0 118 0v4' },
  { t: 'Self-healing with Qodo', d: 'When the reviewer asks for changes, Tartarus reads the feedback, revises its own patch, and pushes again. Two agents converging.', icon: 'M4 4v5h.582m15.356 2A8 8 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8 8 0 01-15.357-2m15.357 2H15' },
  { t: 'Sentinel mode, zero clicks', d: 'Connect a GitHub webhook and the hunt triggers itself on every push. A real DevSecOps pipeline, no manual kickoff.', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { t: 'Isolated by design', d: 'Exploit code runs only in an ephemeral Daytona sandbox that is destroyed after each run. Credentials never leave the harness.', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
  { t: 'Built to be trusted', d: '74 tests, CodeQL and Trivy on every pull request, and a WCAG-minded interface. A security tool with a secure supply chain.', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12 12 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
];
const PRICING = [
  { t: 'Platform', n: '$0', d: 'Open source, self-hosted. TrueForge, GitHub, and the Daytona free tier cost nothing.', hi: false },
  { t: 'Model usage', n: '~$5', d: 'Bring your own Claude or OpenAI key. A demo hunt is a few cents of tokens.', hi: true },
  { t: 'Sandbox', n: 'Free', d: 'Daytona free tier is enough to detonate and tear down exploits.', hi: false },
];
const FAQ = [
  ['Do I need my own API key?', 'Yes. Tartarus is vendor-neutral and runs on your infrastructure, so you bring a Claude or OpenAI key. A full demo costs only a few dollars of model usage. Some hackathons and orgs provide credits or a gateway key you can use instead.'],
  ['Is my code sent anywhere unsafe?', 'No. Exploit code runs only inside an ephemeral, isolated Daytona sandbox that is destroyed after each run. Your model and GitHub credentials stay in the harness and never enter the sandbox.'],
  ['Can it open pull requests without me?', 'No, and that is the point. The tool that opens a PR is gated by the TrueForge runtime, which suspends the agent until a human approves.'],
  ['Which models are supported?', 'Any that TrueForge supports, since the harness is vendor-neutral. Claude and OpenAI both work, and you can swap models per task.'],
  ['How is this different from a scanner?', 'A scanner produces a list of possible issues. Tartarus proves each one with a working exploit, drafts the fix, waits for your approval, and opens a reviewed pull request.'],
  ['Is it open source?', 'Yes, MIT licensed. You can read the entire agent loop and run it yourself.'],
];

const rise = { initial: { opacity: 0, y: 16 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { type: 'spring' as const, stiffness: 220, damping: 24 } };
const Kicker = ({ children }: { children: string }) => <span className="block text-center text-xs font-bold uppercase tracking-[0.16em] text-brand">{children}</span>;
const H2 = ({ children }: { children: React.ReactNode }) => <h2 className="font-display mt-2.5 text-center text-3xl font-bold tracking-tight text-ink">{children}</h2>;
const Sub = ({ children }: { children: React.ReactNode }) => <p className="mx-auto mt-2.5 max-w-xl text-center text-[15px] leading-relaxed text-sub">{children}</p>;

export function Landing() {
  return (
    <div className="relative min-h-screen">
      <div className="mesh"><span className="blob b1" /><span className="blob b2" /><span className="blob b3" /></div>
      <div className="grain" />

      <div className="bg-gradient-to-r from-brand to-[#6b6bff] py-2 text-center text-[13px] font-medium text-white">
        <b className="font-bold">New</b> · Self-healing patches that respond to Qodo reviews automatically. <a href="#how" className="underline underline-offset-2">See how it works</a>
      </div>

      <header className="sticky top-0 z-40 mt-3">
        <div className="glass mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-2xl px-6 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ background: 'linear-gradient(145deg,#6b6bff,#4f46e5)', boxShadow: '0 6px 16px -4px rgba(91,91,240,.6)' }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /></svg>
            </div>
            <span className="font-display text-lg font-extrabold tracking-tight" style={{ background: 'linear-gradient(90deg,#4f46e5,#0891b2)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Tartarus</span>
          </div>
          <nav className="hidden items-center gap-7 text-sm font-medium text-sub md:flex">
            <a href="#product" className="hover:text-ink">Product</a><a href="#how" className="hover:text-ink">How it works</a><a href="#security" className="hover:text-ink">Security</a><a href="#pricing" className="hover:text-ink">Pricing</a><a href="#faq" className="hover:text-ink">FAQ</a>
          </nav>
          <a href="#app" className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110" style={{ background: 'linear-gradient(135deg,#6b6bff,#4f46e5)', boxShadow: '0 8px 20px -6px rgba(79,70,229,.6)' }}>Launch app</a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        {/* hero */}
        <section className="grid items-center gap-11 py-14 lg:grid-cols-[1.05fr_1fr] lg:py-16">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 160, damping: 22 }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/60 px-3 py-1.5 text-xs font-semibold text-brand backdrop-blur"><span className="h-1.5 w-1.5 rounded-full bg-brand" /> Autonomous Red-Team and SecOps</span>
            <h1 className="font-display mt-4 text-5xl font-extrabold leading-[1.03] tracking-tight text-ink">Find the bug. Prove it. Fix it. Autonomously.</h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-sub">Tartarus hunts your repository for vulnerabilities, proves each one by detonating an exploit in an isolated sandbox, and opens a fix only after a human approves. It even revises its own patch when the reviewer pushes back.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#app" className="rounded-xl px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110" style={{ background: 'linear-gradient(135deg,#6b6bff,#4f46e5)', boxShadow: '0 10px 24px -8px rgba(79,70,229,.65)' }}>Launch the dashboard</a>
              <a href="#how" className="glass rounded-xl px-5 py-3 text-sm font-semibold text-ink">See how it works</a>
            </div>
            <div className="mt-6 flex flex-wrap gap-4 text-[12.5px] text-mut">
              {['Bring your own model key', 'Open source, MIT', 'Runs on your infra'].map((m) => (
                <span key={m} className="inline-flex items-center gap-1.5"><span className="text-success"><Check /></span>{m}</span>
              ))}
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 140, damping: 20, delay: 0.1 }}><HeroVisual /></motion.div>
        </section>

        {/* logo strip */}
        <section id="product" className="glass mb-2 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 rounded-2xl px-6 py-5">
          <span className="w-full text-center text-xs font-semibold uppercase tracking-wide text-mut">Built on best-in-class infrastructure</span>
          {STACK.map((s) => <span key={s} className="font-display text-[17px] font-bold text-slate-400">{s}</span>)}
        </section>

        {/* how it works */}
        <section id="how" className="py-16">
          <Kicker>The workflow</Kicker><H2>From push to patch, autonomously</H2><Sub>Four steps run on their own, with a human at the single gate that matters.</Sub>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <motion.div key={s.n} {...rise} className="glass rounded-2xl p-6">
                <div className="font-display text-2xl font-extrabold" style={{ background: 'linear-gradient(135deg,#4f46e5,#0891b2)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{s.n}</div>
                <div className="font-display mt-1.5 text-lg font-bold tracking-tight text-ink">{s.t}</div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-sub">{s.d}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* comparison */}
        <section className="pb-16">
          <Kicker>Head to head</Kicker><H2>Not another scanner</H2><Sub>Traditional scanners hand you a backlog. Tartarus hands you a proven, approved fix.</Sub>
          <div className="glass mt-9 overflow-hidden rounded-2xl">
            <div className="grid grid-cols-[1.6fr_1fr_1fr] border-b border-slate-200/70 bg-slate-50/70 font-semibold">
              <div className="px-5 py-4 text-ink">Capability</div>
              <div className="px-5 py-4 text-center text-mut">Traditional scanners</div>
              <div className="font-display px-5 py-4 text-center font-extrabold text-brand">Tartarus</div>
            </div>
            {CMP.map((c, i) => (
              <div key={c} className={`grid grid-cols-[1.6fr_1fr_1fr] ${i < CMP.length - 1 ? 'border-b border-slate-200/60' : ''}`}>
                <div className="px-5 py-3.5 text-sm font-medium text-ink">{c}</div>
                <div className="flex items-center justify-center py-3.5 text-slate-300"><Cross /></div>
                <div className="flex items-center justify-center py-3.5 text-success"><Check /></div>
              </div>
            ))}
          </div>
        </section>

        {/* architecture */}
        <section className="pb-16">
          <Kicker>Architecture</Kicker><H2>The harness does the load-bearing work</H2><Sub>The model reasons. The runtime enforces the boundaries you care about.</Sub>
          <div className="mt-9 flex flex-wrap items-stretch justify-center gap-2">
            {ARCH.map((n, i) => (
              <div key={n.t} className="flex items-center">
                <div className="glass rounded-2xl px-5 py-4 text-center" style={{ minWidth: 130 }}>
                  <div className={`mx-auto flex h-9 w-9 items-center justify-center rounded-xl ${n.tone === 'red' ? 'bg-red-50 text-critical' : n.tone === 'green' ? 'bg-green-50 text-success' : 'bg-brand/10 text-brand'}`}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={n.icon} /></svg></div>
                  <div className="mt-2 text-[12.5px] font-bold text-ink">{n.t}</div>
                  <div className="text-[11px] text-mut">{n.s}</div>
                </div>
                {i < ARCH.length - 1 && <span className="px-1 text-slate-300"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg></span>}
              </div>
            ))}
          </div>
          <div className="mx-auto mt-5 max-w-xl rounded-2xl border border-dashed border-amber-500/40 bg-amber-500/[0.06] px-4 py-3 text-center text-[13px] text-gate">🟡 Before the patch tool can run, TrueForge suspends the agent and waits for a human. <b>require_approval_for_tools</b> makes approval a boundary, not a suggestion.</div>
        </section>

        {/* features */}
        <section id="security" className="pb-16">
          <Kicker>Why teams trust it</Kicker><H2>Security you can actually reason about</H2>
          <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <motion.div key={f.t} {...rise} className="glass rounded-2xl p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand"><Icon d={f.icon} /></div>
                <h3 className="font-display mt-4 text-lg font-bold tracking-tight text-ink">{f.t}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-sub">{f.d}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* stats band */}
        <section className="pb-16">
          <div className="glass overflow-hidden rounded-3xl">
            <div className="grid items-center gap-8 p-10 lg:grid-cols-[1.2fr_1fr]">
              <div>
                <Kicker>Outcomes</Kicker>
                <h2 className="font-display mt-2 text-2xl font-bold tracking-tight text-ink">Evidence over noise, control over autonomy</h2>
                <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-sub">Findings that are proven, not guessed. Fixes that ship as reviewed pull requests. And an agent that is structurally unable to touch your code without a person in the loop.</p>
                <a href="#app" className="mt-6 inline-block rounded-xl px-5 py-3 text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg,#6b6bff,#4f46e5)' }}>Open the dashboard</a>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[['74', 'unit tests'], ['4', 'attack classes proven'], ['2', 'AI reviewers in the loop'], ['0', 'unattended writes']].map(([n, l]) => (
                  <div key={l} className="rounded-2xl border border-white/70 bg-white/50 p-5 text-center">
                    <div className="font-display text-3xl font-extrabold" style={{ background: 'linear-gradient(135deg,#4f46e5,#0891b2)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{n}</div>
                    <div className="mt-1 text-xs text-sub">{l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* pricing */}
        <section id="pricing" className="pb-16">
          <Kicker>Pricing</Kicker><H2>Free and open. You bring the model key.</H2><Sub>Tartarus is MIT licensed and runs on your own infrastructure. The only cost is your model usage, and about five dollars covers a full demo.</Sub>
          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {PRICING.map((p) => (
              <div key={p.t} className={`glass rounded-2xl p-6 ${p.hi ? 'ring-2 ring-brand/40' : ''}`}>
                <div className="font-display text-lg font-bold text-ink">{p.t}</div>
                <div className="font-display mt-1 text-3xl font-extrabold" style={{ background: 'linear-gradient(135deg,#4f46e5,#0891b2)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{p.n}</div>
                <p className="mt-2 text-[13px] leading-relaxed text-sub">{p.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* faq */}
        <section id="faq" className="pb-16">
          <Kicker>Questions</Kicker><H2>Frequently asked</H2>
          <div className="mx-auto mt-9 max-w-3xl space-y-3">
            {FAQ.map(([q, a], i) => (
              <details key={q} open={i === 0} className="glass group rounded-2xl">
                <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-[15px] font-semibold text-ink">{q}<span className="text-xl font-normal text-brand transition group-open:rotate-45">+</span></summary>
                <div className="px-5 pb-4 text-sm leading-relaxed text-sub">{a}</div>
              </details>
            ))}
          </div>
        </section>

        {/* final cta */}
        <section className="pb-16">
          <div className="rounded-3xl px-6 py-14 text-center text-white" style={{ background: 'linear-gradient(135deg,#4f46e5,#6b6bff 60%,#0891b2)', boxShadow: '0 30px 70px -24px rgba(79,70,229,.6)' }}>
            <h2 className="font-display text-4xl font-extrabold tracking-tight">Watch it hunt</h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-white/85">Open the live dashboard and follow a hunt from scan to approved fix, with the sandbox detonating in real time.</p>
            <a href="#app" className="mt-6 inline-block rounded-xl bg-white px-6 py-3 text-sm font-semibold text-brand transition hover:brightness-105">Launch the dashboard</a>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200/70 bg-white/40 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-8 py-11 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
            <div>
              <div className="flex items-center gap-2.5"><div className="flex h-8 w-8 items-center justify-center rounded-lg text-white" style={{ background: 'linear-gradient(145deg,#6b6bff,#4f46e5)' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /></svg></div><span className="font-display text-base font-extrabold" style={{ background: 'linear-gradient(90deg,#4f46e5,#0891b2)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Tartarus</span></div>
              <p className="mt-3 max-w-[30ch] text-[13px] leading-relaxed text-sub">Autonomous Red-Team and SecOps. Findings you can trust, actions you control.</p>
            </div>
            {[['Product', [['Overview', '#product'], ['How it works', '#how'], ['Security', '#security'], ['Pricing', '#pricing']]], ['Resources', [['Dashboard', '#app'], ['FAQ', '#faq'], ['Blog', '#'], ['Docs', '#']]], ['Company', [['About', '#'], ['GitHub', '#'], ['Hackathon', '#']]]].map(([h, links]) => (
              <div key={h as string}>
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-mut">{h as string}</h4>
                {(links as string[][]).map(([l, href]) => <a key={l} href={href} className="block py-1 text-[13.5px] text-sub hover:text-ink">{l}</a>)}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap justify-between gap-2 border-t border-slate-200/70 py-4 text-xs text-mut">
            <span>© 2026 Tartarus. MIT licensed.</span><span>Built with TrueForge · Claude · Daytona · Qodo</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
