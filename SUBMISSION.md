# 📝 Tartarus, Hackathon Submission

> Copy the sections below into the WeMakeDevs submission form. Fill the
> `«placeholders»` with your links before submitting.

**Project name:** Tartarus, Autonomous Red-Team & SecOps Agent
**Tracks:** Best Use of the Agent Harness (NVIDIA DGX Spark) · Best Code Quality (Qodo, Mac Mini) · Best UI (Apple iPads) · Best Blog Post (Keychron)
**Repo (main):** «https://github.com/YOUR_USERNAME/Tartarus»
**Repo (demo target):** «https://github.com/YOUR_USERNAME/Tartarus-Patient-Zero»
**Demo video:** «https://youtu.be/YOUR_VIDEO»

---

## One-liner

Tartarus is an autonomous SecOps agent on TrueForge that finds a real
vulnerability in a GitHub repo, **proves it by detonating an exploit in an
isolated sandbox**, then **pauses, physically, at the runtime level, for a
human to approve** before opening a fix PR that Qodo reviews.

## The problem it solves

Two things are broken in "AI security" today:

1. **False positives.** Most AI scanners pattern-match and dump a pile of
   maybe-bugs a human then has to triage. Signal-to-noise is terrible.
2. **Unsafe autonomy.** "Autonomous" agents will happily push changes to your
   repository with no human in the loop, a non-starter for security work.

Tartarus refuses to report a vulnerability until an exploit **actually triggers
it** in a sandbox, and it is **structurally incapable** of writing to your repo
without human approval. Evidence-backed findings; zero unattended writes.

## ⚡ The three features that make it a product, not a script

1. **Sentinel Mode (zero-click):** a GitHub push webhook auto-triggers the whole
   hunt, no CLI, no human kickoff. `src/server/sentinel.ts`, exposed with ngrok.
2. **Self-Healing Loop (agentic collaboration with Qodo):** when Qodo requests
   changes on the fix PR, Tartarus reads the feedback, regenerates the patch, and
   pushes a new commit to the same PR, two AIs converging on a correct fix.
   `src/agent/selfHeal.ts`.
3. **The Command Center:** an accessible enterprise dashboard (React, Tailwind,
   Framer Motion) with a global nav, live sandbox CPU and memory telemetry during
   detonation, and a GitHub-style side-by-side approval diff with token-level
   highlighting and additions and deletions counts. `ui/`.

## How it works, the pipeline

`SCAN → DETONATE → HUMAN APPROVAL (gold gate) → PATCH → QODO REVIEW`

1. **Scan** (`scan_repo_for_vulns`), reads the repo from GitHub and flags
   dangerous sinks for Claude to confirm.
2. **Detonate** (`run_exploit_in_sandbox`), Claude writes an exploit; it runs
   **only** inside an ephemeral, network-isolated Daytona sandbox (pinned to
   `node:22`). Success requires the exploit to print `TARTARUS_EXPLOIT_OK` , 
   a bug isn't real until it's proven.
3. **Gold gate** (`request_human_approval` + the harness), the agent stops and
   a human decides.
4. **Patch** (`create_patch_pr`), opens a remediation PR.
5. **Review**, the PR triggers Qodo's `/agentic_review`.

## Best Use of TrueForge, the harness does the load-bearing work

The single most important design decision: **the human approval gate is enforced
by TrueForge's runtime, not by a prompt.**

In our AgentSpec (`src/agent/spec.ts`), the world-mutating tool is declared:

```jsonc
"mcp_servers": [{
  "name": "tartarus-tools",
  "require_approval_for_tools": ["create_patch_pr"]
}]
```

Because of this, TrueForge emits a `tool.approval_required` event and **physically
pauses the agent loop** before `create_patch_pr` can execute. Our CLI catches
that event and asks the human on the terminal; only an explicit `allow` resumes
the turn. The model literally cannot open a PR on its own, the harness is what
makes "human-in-the-loop" a guarantee instead of a hope. That is the agent
harness earning its keep, demonstrated end-to-end.

We also lean on TrueForge for what a harness is for: it drives the Claude agent
loop, streams events, manages the session, and treats the **sandbox as a tool**
so untrusted exploit code never touches the host or the credentials.

## Best Code Quality, the "no shortcuts" architecture

- **Real exploitation, not theatre.** The demo target ships a real seeded
  database (Node's built-in `node:sqlite`, zero native deps), so a successful
  SQL injection leaks concrete fake secrets. We verified live: the injection
  leaks three AWS keys and a `UNION` reaches a second `admin_tokens` table.
- **Provider-verified, not hallucinated.** Every SDK binding (TrueForge, Daytona
  `image` pinning, MCP Streamable HTTP, Octokit) was checked against the real
  packages; the project builds clean under strict TypeScript.
- **Production hardening.** Every tool is wrapped in a guard that turns rate
  limits, timeouts, and auth failures into structured, retryable results instead
  of crashes; GitHub calls auto-retry and respect rate limits; sandbox start is
  time-bounded; secrets are redacted from debug logs.
- **Tested.** A `node:test` suite (`npm test`, 74 tests, zero dependencies)
  covers the error classifier, the tool-schema contracts, the vulnerability
  detector, the event bus, the approval registry, the webhook signature check,
  and the self-heal decision logic. It already caught and fixed a real gap in
  the `execSync` sink detection.
- **Ironclad CI.** Every pull request runs type-check, tests with coverage, a
  build, CodeQL static analysis, and a Trivy vulnerability scan. A security tool
  should have a secure supply chain.
- **Operable.** `npm run doctor` pre-flights all four services; `SETUP.md`
  documents the `localhost` versus `host.docker.internal` networking edge case.

## Best UI

The Command Center is a clean, accessible, WCAG-minded enterprise dashboard in
the register of GitHub Advanced Security, Linear, and Datadog. It has a global
navigation sidebar, a summary strip, a two-column workspace with an agent stepper
and a contextual evidence panel, live sandbox telemetry charts during detonation,
and a security-alert approval modal with a GitHub-style side-by-side diff.

## Best Blog Post

`docs/BLOG_POST.md` is a long-form engineering deep dive written for developers,
not a marketing pitch. It covers the two invariants that shaped the design, why
we pushed the approval gate into the runtime, the sandbox execution model, and
the self-healing loop, with code, a Mermaid diagram, and hard-won lessons.

## Qodo integration (required for Code Quality track)

Every PR Tartarus opens ends its body with a `/agentic_review` prompt, so Qodo's
agentic reviewer validates the fix. Our own development followed the same loop:
we pushed `feature/init-tartarus-core`, opened a PR, ran `/agentic_review`, and
addressed Qodo's findings before merge, closing the detect → prove → approve →
patch → **review** loop with the sponsor's own tool.

**Proof:** «link the PR» · screenshots in the repo README.

## Tech stack

TrueForge (agent harness) · Claude Sonnet 4.6 · Model Context Protocol (tools) ·
Daytona (isolated sandbox) · GitHub (Octokit) · Qodo (agentic review) ·
TypeScript / Node 22.

## What we'd do next

- More vulnerability classes (SSRF, path traversal, auth bypass) in the scan heuristic.
- Multi-file patches and automatic re-detonation to confirm the fix closes the exploit.
- A TrueForge scheduled deployment for continuous, nightly repo hunts.
