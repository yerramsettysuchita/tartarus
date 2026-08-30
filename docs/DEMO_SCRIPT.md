# 🎬 Tartarus, "God Mode" Demo Script (3 minutes)

The winning narrative: a careless developer pushes vulnerable code, and Tartarus
autonomously catches it, proves it, asks a human, patches it, and *heals its own
patch* when Qodo pushes back, all watched live in the browser.

## Pre-flight (before recording)

1. `npm run doctor` → all green.
2. `npm run ui:build` (dashboard built).
3. Terminal A: `npm run mcp` · Terminal B: `npm run sentinel` · Terminal C: `npm run tunnel`.
4. Paste the tunnel's Payload URL into the `Tartarus-Patient-Zero` repo webhook
   (push events, `application/json`, your `GITHUB_WEBHOOK_SECRET`).
5. Open **http://localhost:8799** in the browser (full screen). Pre-open the PR + Qodo tabs.
6. Have a one-line vulnerable edit staged locally in Patient-Zero (don't push yet).

## The 3 minutes

| Time | On screen | Voiceover |
|------|-----------|-----------|
| **0:00 to 0:20**, the careless push | Split screen: your editor and the Command Center dashboard sitting idle. You run `git commit -am "add quick user lookup"` then `git push`. | *"A developer ships a feature with a SQL injection and pushes straight to main. Watch what happens next. I will not touch a terminal again."* |
| **0:20 to 0:45**, Sentinel wakes | The dashboard status flips to Running on its own. The Scan step in the agent stepper turns active, then done, and the Scan findings card lists `src/app.js` with the flagged sinks. | *"Tartarus received a GitHub webhook. Zero clicks. It is already scanning the repository it was just pushed to."* |
| **0:45 to 1:20**, detonation | The Sandbox telemetry card appears and the CPU and memory charts climb under exploit load. The detonation console shows the injection payload, the leaked AWS keys, and the `TARTARUS_EXPLOIT_OK` sentinel. The verdict pill reads Exploit confirmed. | *"It did not just flag a pattern. It wrote an exploit and detonated it inside an isolated sandbox. You can watch the sandbox working, and those are the secrets leaking. The bug is proven."* |
| **1:20 to 1:55**, the gold gate | The security-alert approval modal opens with the vulnerability, the blast radius, a 95 percent confidence meter, and a side-by-side diff of the vulnerable code against the patched version. You click Approve. | *"Now the part that makes this safe for enterprises. The TrueForge runtime physically paused the agent. It cannot open a pull request without me, and I can review the exact diff first. Approved."* |
| **1:55 to 2:20**, the patch | The Patch step completes and the Remediation card shows the pull request link. Cut to the real PR on GitHub. | *"It opens a parameterised-query fix as a pull request and asks Qodo to review it."* |
| **2:20 to 2:50**, the self-healing loop | On the PR, Qodo's `/agentic_review` leaves Changes Requested. Cut to a terminal running `npm run heal -- <PR#>`. It reads Qodo's comments and pushes a second commit. The PR updates. | *"Here is the part I am proud of. Qodo asked for changes, so Tartarus read the feedback, improved its own patch, and pushed a new commit. Two agents converging on a correct fix, by themselves."* |
| **2:50 to 3:00**, close | The architecture diagram, or the dashboard showing status Complete. | *"Push to patch, autonomously, with a human only at the gate. That is Tartarus."* |

## Fallbacks if a live service hiccups

- No webhook? Trigger the same flow manually with `npm run hunt:ui -- <you>/Tartarus-Patient-Zero` and narrate it as the Sentinel result.
- Everything offline? `npm run demo` is a deterministic replay of scan, detonate, gold gate, and PR that never breaks.
- Qodo slow? Pre-record the self-heal segment, or run `npm run heal` against a PR where Qodo has already requested changes.

## Shot tips

- The two shots that land hardest are the telemetry charts spiking during detonation and the approval diff modal. Hold on each for about two seconds.
- Keep the browser full screen. The clean enterprise layout reads as a real product.
- End on the Complete state. Judges remember the last frame.
