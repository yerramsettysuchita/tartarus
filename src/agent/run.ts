/**
 * agent/run.ts — the CLI entrypoint for a hunt.
 *
 * A thin wrapper over the reusable hunt engine (src/agent/hunt.ts). It wires up
 * the terminal presentation: the ASCII banner, spinners (inside the engine), and
 * the gold gate as an inquirer confirm — or, with `--ui`, the Command Center.
 *
 * Run with:  npm run hunt -- [--debug] [--ui] <owner/repo?>
 */
import { confirm } from '@inquirer/prompts';
import { TrueForge } from '@truefoundry/trueforge-sdk';

import { loadConfig } from '../config.js';
import { paint, SIGIL } from '../theme.js';
import { startHub, type Hub } from '../server/hub.js';
import type { HuntEvent } from '../server/eventBus.js';
import { runHunt } from './hunt.js';

// ── CLI args: npm run hunt -- [--debug] [--ui] [owner/repo] ───────────────────
const argv = process.argv.slice(2);
const DEBUG = argv.includes('--debug');
const UI = argv.includes('--ui');
if (DEBUG) process.env.TARTARUS_DEBUG = 'true';
const repoArg = argv.find((a) => !a.startsWith('--'));

const cfg = loadConfig();
const client = new TrueForge({
  baseUrl: cfg.TRUEFORGE_BASE_URL,
  timeoutInSeconds: 900,
  ...(cfg.TRUEFORGE_TOKEN ? { token: cfg.TRUEFORGE_TOKEN } : {}),
});

let hub: Hub | null = null;
const emit = (kind: HuntEvent['kind'], message: string, data?: unknown): void => {
  hub?.bus.publish(kind, message, data);
};

/** Gold gate: web modal in --ui mode (hunt.ts emits the rich payload), else a terminal confirm. */
async function requestApproval(id: string, toolName: string, args: string): Promise<boolean> {
  if (hub) {
    console.log(paint.gold('  Waiting for approval in the Command Center…'));
    return (await hub.approvals.await(id, toolName, args)) === 'allow';
  }
  console.log(paint.crit('\n  HUMAN APPROVAL REQUIRED') + paint.muted(`  →  ${toolName}`));
  console.log(paint.muted('  ' + args.replace(/\n/g, '\n  ')) + '\n');
  return confirm({ message: paint.gold('Approve and open the remediation PR?'), default: false });
}

async function main(): Promise<void> {
  const repo = repoArg ?? cfg.TARGET_REPO;
  if (DEBUG) console.error(paint.muted('[debug] verbose logging ON (events + MCP tool payloads)'));
  console.log(SIGIL);
  console.log(paint.scan(`Target: ${repo}`));

  if (UI) {
    hub = await startHub(cfg.TARTARUS_UI_PORT);
    console.log(paint.gold(`\n🖥  Command Center: http://localhost:${cfg.TARTARUS_UI_PORT}`));
    console.log(paint.muted('   (approve the gold gate in the browser)\n'));
    emit('boot', `Tartarus online — target ${repo}`, { repo });
  }

  await runHunt({ client, cfg, repo, cli: true, debug: DEBUG, emit, requestApproval });

  console.log(paint.scan('\n✔ Tartarus run complete.'));
  emit('done', 'Tartarus run complete.');
  if (hub) console.log(paint.muted(`Command Center still live at http://localhost:${cfg.TARTARUS_UI_PORT} — Ctrl+C to exit.`));
}

main().catch((err) => {
  emit('error', err instanceof Error ? err.message : String(err));
  console.error(paint.fail(String(err instanceof Error ? err.stack ?? err.message : err)));
  process.exit(1);
});
