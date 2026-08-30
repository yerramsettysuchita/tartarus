/**
 * server/sentinel.ts — Sentinel Mode (zero-click continuous hunting).
 *
 * A long-running server that hosts the Command Center dashboard AND a GitHub
 * webhook. When a developer pushes code, GitHub calls our webhook and Tartarus
 * auto-triggers a hunt — no CLI, no human kickoff. The hunt streams into the
 * same dashboard and pauses at the gold gate for a browser approval.
 *
 * This is the real DevSecOps pipeline shape: push → scan → prove → approve →
 * patch, hands-free until the human decision.
 *
 * Run with:  npm run sentinel      (expose the port publicly with npm run tunnel)
 */
import { TrueForge } from '@truefoundry/trueforge-sdk';
import { loadConfig } from '../config.js';
import { paint } from '../theme.js';
import { EventBus } from './eventBus.js';
import { ApprovalRegistry } from './approvals.js';
import { startHub } from './hub.js';
import type { PushInfo } from './webhook.js';
import { runHunt } from '../agent/hunt.js';

const cfg = loadConfig();
const client = new TrueForge({
  baseUrl: cfg.TRUEFORGE_BASE_URL,
  timeoutInSeconds: 900,
  ...(cfg.TRUEFORGE_TOKEN ? { token: cfg.TRUEFORGE_TOKEN } : {}),
});

// One shared bus + approval registry for the lifetime of the server, so every
// triggered hunt streams into the same dashboard.
const bus = new EventBus();
const approvals = new ApprovalRegistry();

// Concurrency guard: run one hunt at a time; coalesce pushes that arrive while
// a hunt is in flight into a single follow-up run.
let running = false;
let queuedRepo: string | null = null;

async function triggerHunt(repo: string): Promise<void> {
  if (running) {
    queuedRepo = repo;
    bus.publish('log', `A hunt is already running — queued a follow-up for ${repo}.`);
    return;
  }
  running = true;
  bus.publish('boot', `🛰  Sentinel triggered — hunting ${repo}`, { repo, source: 'webhook' });
  console.log(paint.scan(`\n🛰  Sentinel: push received → hunting ${repo}`));

  try {
    await runHunt({
      client, cfg, repo, cli: false,
      emit: (kind, message, data) => bus.publish(kind, message, data),
      // hunt.ts emits the rich approval_required/approval_resolved payloads.
      requestApproval: async (id, toolName, args) => (await approvals.await(id, toolName, args)) === 'allow',
    });
    bus.publish('done', `Sentinel hunt complete for ${repo}.`);
  } catch (err) {
    bus.publish('error', err instanceof Error ? err.message : String(err));
    console.error(paint.fail(String(err)));
  } finally {
    running = false;
    if (queuedRepo) { const next = queuedRepo; queuedRepo = null; void triggerHunt(next); }
  }
}

function onPush(info: PushInfo): void {
  // Only hunt the configured target (avoid being triggered by unrelated repos).
  if (info.repo.toLowerCase() !== cfg.TARGET_REPO.toLowerCase()) {
    bus.publish('log', `Ignoring push to ${info.repo} (not the target ${cfg.TARGET_REPO}).`);
    return;
  }
  void triggerHunt(info.repo);
}

async function main(): Promise<void> {
  const hub = await startHub(cfg.TARTARUS_UI_PORT, bus, approvals, {
    secret: cfg.GITHUB_WEBHOOK_SECRET,
    onPush,
  });

  console.log(paint.scan('\n🛰  TARTARUS SENTINEL — continuous hunting online'));
  console.log(paint.gold(`   Command Center : http://localhost:${hub.port}`));
  console.log(paint.info(`   Webhook target : http://localhost:${hub.port}/api/webhook/github`));
  console.log(paint.muted(`   Watching push events for: ${cfg.TARGET_REPO}`));
  if (!cfg.GITHUB_WEBHOOK_SECRET) {
    console.log(paint.crit('   ⚠  GITHUB_WEBHOOK_SECRET is unset — signature verification is DISABLED (dev only).'));
  }
  console.log(paint.muted('\n   Expose this to GitHub with:  npm run tunnel'));
}

main().catch((err) => {
  console.error(paint.fail(String(err instanceof Error ? err.stack ?? err.message : err)));
  process.exit(1);
});
