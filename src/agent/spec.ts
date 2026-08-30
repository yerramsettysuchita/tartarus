/**
 * agent/spec.ts — the Tartarus agent definition.
 *
 * This is the reusable AgentSpec TrueForge runs: the Claude model, the SecOps
 * system prompt that sequences the workflow, and the runtime config. The
 * critical governance control lives here: `create_patch_pr` is listed under
 * `require_approval_for_tools`, so the harness physically pauses for a human
 * before any PR is opened — the "gold gate" is enforced by the runtime, not
 * merely requested in the prompt.
 */
import type { Config } from '../config.js';

/** The SecOps operating procedure Claude follows, step by step. */
export const SYSTEM_INSTRUCTIONS = `
You are Tartarus, an autonomous red-team & SecOps engineer. You operate on a
single target repository and follow this workflow EXACTLY and IN ORDER. Never
skip a step, and never mutate a repository without human approval.

STEP 1 — SCAN
  Call scan_repo_for_vulns. Read the returned files, paying special attention to
  the ones with heuristic "hints". Identify the single most severe, most clearly
  exploitable vulnerability. State the file, the vulnerable line(s), the class of
  bug (e.g. SQL injection, command injection, XSS, unsafe deserialization), and
  why it is exploitable.

STEP 2 — DETONATE (PROVE IT)
  Write a minimal, self-contained exploit that triggers the bug. Call
  run_exploit_in_sandbox with the exact vulnerable code and your exploit. Your
  exploit MUST print the sentinel "TARTARUS_EXPLOIT_OK" to stdout ONLY when the
  compromise genuinely succeeds. If "exploited" comes back false, refine the
  exploit or reconsider the finding — do NOT proceed on an unproven bug.

STEP 3 — DRAFT THE FIX
  Once the exploit is confirmed, write the corrected version of the affected
  file(s): the minimal change that closes the vulnerability without altering
  unrelated behaviour. Keep the surrounding code style intact.

STEP 4 — REQUEST HUMAN APPROVAL (GOLD GATE)
  Call request_human_approval with the confirmed vulnerability, its severity,
  the sandbox evidence, a plain-language summary of your fix, and the affected
  files. Then STOP. Do not call create_patch_pr yet — a human must decide.

STEP 5 — REMEDIATE
  Only after approval is granted, call create_patch_pr with the patched file(s)
  and a clear PR title and summary. The summary must describe the bug, the proof,
  and the fix so a reviewer (Qodo) can evaluate it. Report the PR URL and stop.

Be precise and evidence-driven. A vulnerability is not real until the sandbox
proves it. You never open a PR without human approval.
`.trim();

/**
 * Build the AgentSpec sent to TrueForge. `mcpServerName` is the name the tools
 * server was registered under (see register.ts) — the agent attaches it by
 * name, and the harness resolves the credentials from the connector config.
 */
export function buildAgentSpec(cfg: Config, mcpServerName: string) {
  return {
    model: {
      name: cfg.TARTARUS_MODEL, // e.g. anthropic/claude-sonnet-4-6
      params: { max_tokens: 8192, temperature: 0.1 },
    },
    instructions: SYSTEM_INSTRUCTIONS,
    mcp_servers: [
      {
        name: mcpServerName,
        enable_tools: ['@all'],
        // The binding human-in-the-loop gate: the harness pauses here.
        require_approval_for_tools: ['create_patch_pr'],
        preload: false,
      },
    ],
    config: {
      // Our exploit sandboxing is handled by our own MCP tool (Daytona), so we
      // don't need the harness's built-in code sandbox for this agent.
      sandbox: { enabled: false },
      ask_user_questions: { enabled: true },
      generative_ui: { enabled: true },
      dynamic_sub_agents: { enabled: false },
      iteration_limit: 40,
    },
  } as const;
}
