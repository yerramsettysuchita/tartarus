/**
 * agent/hunt.ts — the reusable hunt engine.
 *
 * The core scan→detonate→approve→patch loop, extracted so it can be driven by
 * BOTH entrypoints:
 *   • the CLI runner (src/agent/run.ts) — spinners + terminal gold gate, and
 *   • the Sentinel server (src/server/sentinel.ts) — triggered by a GitHub
 *     webhook, streaming to the Command Center with a web gold gate.
 *
 * Presentation is injected: `emit` streams events to the dashboard, and
 * `requestApproval` resolves the gold gate (inquirer in the CLI, a web POST in
 * Sentinel mode). `cli` toggles the terminal spinners/narration.
 */
import ora, { type Ora } from 'ora';
import { stdout } from 'node:process';
import {
  TrueForge,
  TrueForgeApi,
  isEventDelta,
  mergeEventDelta,
} from '@truefoundry/trueforge-sdk';
import type { Config } from '../config.js';
import { paint, banner } from '../theme.js';
import { buildAgentSpec } from './spec.js';
import { MCP_SERVER_NAME } from './register.js';
import type { HuntEvent } from '../server/eventBus.js';

/** Per-tool cinematic presentation for the CLI. */
const PHASES: Record<string, { start: string; color: Ora['color']; done: (s: Ora) => void }> = {
  scan_repo_for_vulns: {
    start: 'Scanning repository for vulnerabilities…',
    color: 'green',
    done: (s) => s.succeed(paint.scan('Scan complete — candidate vulnerabilities identified.')),
  },
  run_exploit_in_sandbox: {
    start: 'Detonating exploit in isolated Daytona sandbox…',
    color: 'red',
    done: (s) => s.stopAndPersist({ symbol: '💥', text: paint.crit('Detonation finished — see verdict above.') }),
  },
  request_human_approval: {
    start: 'Preparing the approval request…',
    color: 'yellow',
    done: (s) => s.stopAndPersist({ symbol: '⏸', text: paint.gold('Approval requested — awaiting human decision.') }),
  },
  create_patch_pr: {
    start: 'Opening remediation pull request…',
    color: 'cyan',
    done: (s) => s.succeed(paint.info('Remediation PR opened.')),
  },
};

/** Resolve the tool name for a given tool-call id from captured messages. */
function toolNameForCall(
  events: Map<string, TrueForgeApi.TurnStreamingEvent>,
  toolCallId: string,
): string | undefined {
  for (const ev of events.values()) {
    if (ev.type !== 'model.message') continue;
    const call = ev.toolCalls?.find((tc) => tc.id === toolCallId);
    if (call) return call.toolInfo.name;
  }
  return undefined;
}

/** Parse a JSON string, returning null on failure (for tool-call arguments). */
function safeParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return null; }
}

/** Parse a tool-result content blob to JSON when possible (for the dashboard). */
export function tryJson(content: unknown): unknown {
  const text = Array.isArray(content)
    ? (content.find((c) => (c as { type?: string })?.type === 'text') as { text?: string } | undefined)?.text
    : typeof content === 'string' ? content : undefined;
  if (!text) return content;
  try { return JSON.parse(text); } catch { return text; }
}

export interface HuntDeps {
  client: TrueForge;
  cfg: Config;
  repo: string;
  /** Render terminal spinners + narration (CLI mode). */
  cli: boolean;
  /** Verbose event logging. */
  debug?: boolean;
  /** Optional extra guidance appended to the kickoff message (used by self-heal). */
  extraInstruction?: string;
  /** Stream an event to the dashboard (no-op if not in --ui/sentinel mode). */
  emit: (kind: HuntEvent['kind'], message: string, data?: unknown) => void;
  /** Resolve the gold gate. Returns true to approve opening the PR. */
  requestApproval: (id: string, toolName: string, args: string) => Promise<boolean>;
}

/** Run one full hunt to completion (may include multiple gold-gate resolutions). */
export async function runHunt(deps: HuntDeps): Promise<void> {
  const { client, cfg, repo, cli, debug, emit } = deps;

  // Context captured during the hunt, used to build a rich approval payload
  // (a real before/after diff + confidence) for the Command Center's gold gate.
  const scannedFiles = new Map<string, string>();   // path → original content
  let exploitConfirmed = false;
  let approvalCtx: { vulnerability?: string; severity?: string; exploitEvidence?: string } = {};

  async function drainTurn(
    stream: Awaited<ReturnType<typeof client.sessions.createTurnStream>>,
    events: Map<string, TrueForgeApi.TurnStreamingEvent>,
  ): Promise<TrueForgeApi.ToolApprovalRequiredEvent[]> {
    const pendingApprovals: TrueForgeApi.ToolApprovalRequiredEvent[] = [];
    let spinner: Ora | null = null;
    const stopSpinner = () => { if (spinner) { spinner.stop(); spinner = null; } };

    for await (const { data: event } of stream.withMetadata()) {
      if (debug && event.type !== 'model.message.delta') {
        console.error(paint.muted(`[debug event] ${event.type} ${JSON.stringify(event).slice(0, 600)}`));
      }
      if (isEventDelta(event)) {
        const base = events.get(event.id);
        if (base) mergeEventDelta(base, event);
      } else {
        events.set(event.id, event);
      }

      switch (event.type) {
        case 'model.message.delta': {
          const text = event.content ?? '';
          if (text) {
            if (cli) { stopSpinner(); stdout.write(paint.info(text)); }
            emit('log', text);
          }
          break;
        }

        case 'model.message': {
          const msg = event as TrueForgeApi.ModelMessageEvent;
          const call = msg.toolCalls?.find((tc) => PHASES[tc.toolInfo.name]);
          if (call) {
            const phase = PHASES[call.toolInfo.name]!;
            if (cli) { stopSpinner(); spinner = ora({ text: paint.muted(phase.start), color: phase.color }).start(); }
            emit('phase', phase.start, { tool: call.toolInfo.name });
          }
          // Capture the vulnerability context the model reported to the human.
          const approvalCall = msg.toolCalls?.find((tc) => tc.toolInfo.name === 'request_human_approval');
          if (approvalCall) {
            const a = safeParse(approvalCall.function.arguments) as typeof approvalCtx;
            if (a) approvalCtx = { ...approvalCtx, ...a };
          }
          break;
        }

        case 'tool.response': {
          const done = event as TrueForgeApi.ToolResponseEvent;
          const name = toolNameForCall(events, done.toolCallId);
          const phase = name ? PHASES[name] : undefined;
          if (cli && spinner && phase) { phase.done(spinner); spinner = null; }
          else if (cli) stopSpinner();
          if (name === 'scan_repo_for_vulns') {
            // Remember original file contents so we can diff against the patch.
            const data = tryJson(done.content) as { files?: Array<{ path: string; content: string }> };
            for (const f of data?.files ?? []) if (f?.path) scannedFiles.set(f.path, f.content ?? '');
            emit('scan', `Scanned ${data?.files?.length ?? 0} files`, data);
          } else if (name === 'run_exploit_in_sandbox') {
            const v = tryJson(done.content) as { exploited?: boolean };
            if (v?.exploited) exploitConfirmed = true;
            emit('verdict', 'Exploit detonation result', v);
          } else if (name === 'create_patch_pr') {
            emit('pr_opened', 'Remediation PR opened', tryJson(done.content));
          } else if (name) emit('log', `${name} completed`);
          break;
        }

        case 'tool.approval_required':
          if (cli) { stopSpinner(); console.log('\n' + banner.approve()); }
          emit('phase', 'Human approval required', { gate: true });
          pendingApprovals.push(event as TrueForgeApi.ToolApprovalRequiredEvent);
          break;

        case 'turn.done':
          if (cli) { stopSpinner(); console.log(paint.muted(`\n— turn ${((event as TrueForgeApi.TurnDoneEvent).state?.status) ?? 'done'} —`)); }
          break;
      }
    }
    if (cli) stopSpinner();
    return pendingApprovals;
  }

  // 1. Session bound to the Tartarus agent definition.
  const { data: session } = await client.sessions.create({
    agent: { spec: buildAgentSpec(cfg, MCP_SERVER_NAME) },
  });

  // 2. Kick off the hunt.
  const kickoff = `Hunt for and remediate the most severe vulnerability in ${repo}. Follow your workflow.` +
    (deps.extraInstruction ? `\n\n${deps.extraInstruction}` : '');
  const events = new Map<string, TrueForgeApi.TurnStreamingEvent>();
  let stream = await client.sessions.createTurnStream(session.id, {
    input: [{ type: 'user.message', content: kickoff }],
  });

  // 3. Drive the loop, resolving each gold-gate pause until the turn completes.
  let pending = await drainTurn(stream, events);
  while (pending.length > 0) {
    const approvals: TrueForgeApi.UserToolApprovalEvent[] = [];
    for (const pause of pending) {
      for (const ref of pause.toolCalls) {
        const msg = events.get(ref.sourceEventId);
        if (msg?.type !== 'model.message') continue;
        const call = msg.toolCalls?.find((tc) => tc.id === ref.id);
        if (!call) continue;

        // Build a rich approval payload for the dashboard: a real before/after
        // diff (scanned original vs proposed patch) + a confidence signal.
        const args = safeParse(call.function.arguments) as {
          title?: string; summary?: string; files?: Array<{ path: string; content: string }>;
        } | null;
        const diffs = (args?.files ?? []).map((f) => ({
          path: f.path,
          before: scannedFiles.get(f.path) ?? '',
          after: f.content ?? '',
        }));
        emit('approval_required', `Approve ${call.toolInfo.name}?`, {
          id: ref.id,
          tool: call.toolInfo.name,
          title: args?.title,
          summary: args?.summary,
          vulnerability: approvalCtx.vulnerability,
          severity: approvalCtx.severity,
          evidence: approvalCtx.exploitEvidence,
          confidence: exploitConfirmed ? 0.95 : 0.6,
          exploitConfirmed,
          diffs,
        });

        const approved = await deps.requestApproval(ref.id, call.toolInfo.name, call.function.arguments);
        emit('approval_resolved', `Approval ${approved ? 'allow' : 'deny'}`, { id: ref.id, decision: approved ? 'allow' : 'deny' });
        approvals.push({
          type: 'user.tool_approval',
          threadId: pause.threadId,
          toolCallId: ref.id,
          approval: { status: approved ? 'allow' : 'deny' },
        });
        if (cli) console.log(approved ? paint.ok('Approved.') : paint.fail('Denied — no PR will be opened.'));
      }
    }
    if (cli) console.log('\n' + banner.patch());
    stream = await client.sessions.createTurnStream(session.id, { input: approvals });
    pending = await drainTurn(stream, events);
  }
}
