/**
 * agent/demo.ts — the "safety net" demo run.
 *
 * A fully deterministic replay of a Tartarus hunt that needs NO live services
 * (no TrueForge, no Daytona, no GitHub, no API keys). It uses the exact same
 * visual language as the real runner — the sigil, phase banners, ora spinners,
 * and a genuine inquirer gold gate — so on camera it is indistinguishable from
 * the live run, but it can never fail because of a network hiccup.
 *
 * Use it as the fallback take for the demo video, or to rehearse timing.
 *
 * Run with:  npm run demo
 */
import ora from 'ora';
import { confirm } from '@inquirer/prompts';
import { stdout } from 'node:process';
import { paint, banner, SIGIL } from '../theme.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Type text out like a streaming model, in the given colour. */
async function type(text: string, color: (s: string) => string, perChar = 8): Promise<void> {
  for (const ch of text) {
    stdout.write(color(ch));
    if (ch !== ' ') await sleep(perChar);
  }
  stdout.write('\n');
}

const REPO = 'acme-corp/Tartarus-Patient-Zero';

/** The confirmed exploit evidence we "observe" from the sandbox. */
const SANDBOX_VERDICT = {
  verdict: '🔴 EXPLOIT CONFIRMED — the vulnerability is real and triggerable.',
  exitCode: 0,
  exploited: true,
  stdout:
    'payload: /users?name=x\' OR \'1\'=\'1\n' +
    'leaked 2 rows incl. secret column:\n' +
    '  alice → AWS_KEY_alice_9f2c\n' +
    '  bob   → AWS_KEY_bob_71ab\n' +
    'TARTARUS_EXPLOIT_OK',
};

async function main(): Promise<void> {
  console.log(SIGIL);
  console.log(paint.scan(`Target: ${REPO}`));
  console.log(paint.muted('(demo mode — deterministic replay, no live services)\n'));

  // ── PHASE 1: SCAN ──────────────────────────────────────────────────────────
  console.log(banner.scan());
  let s = ora({ text: paint.muted('Scanning repository for vulnerabilities…'), color: 'green' }).start();
  await sleep(1900);
  s.succeed(paint.scan('Scan complete — 12 files read, 1 file flagged.'));
  await type(
    'Found a SQL injection in src/app.js (GET /users). The `name` query param is ' +
    "concatenated straight into the query string — classic injection, severity HIGH.",
    paint.info,
  );

  // ── PHASE 2: DETONATE ──────────────────────────────────────────────────────
  console.log('\n' + banner.exploit());
  s = ora({ text: paint.muted('Detonating exploit in isolated Daytona sandbox…'), color: 'red' }).start();
  await sleep(2600);
  s.stopAndPersist({ symbol: '💥', text: paint.crit('Detonation finished.') });
  console.log(paint.crit(JSON.stringify(SANDBOX_VERDICT, null, 2)));

  // ── PHASE 3: GOLD GATE ─────────────────────────────────────────────────────
  console.log('\n' + banner.approve());
  s = ora({ text: paint.muted('Preparing the approval request…'), color: 'yellow' }).start();
  await sleep(1200);
  s.stopAndPersist({ symbol: '⏸', text: paint.gold('Approval requested — awaiting human decision.') });

  console.log(paint.crit('\n  HUMAN APPROVAL REQUIRED') + paint.muted('  →  create_patch_pr'));
  console.log(paint.muted('  vulnerability: SQL injection in src/app.js (GET /users)'));
  console.log(paint.muted('  severity: high   ·   exploit: CONFIRMED in sandbox'));
  console.log(paint.muted('  fix: use a parameterised query (prepared statement)\n'));

  const approved = await confirm({
    message: paint.gold('Approve and open the remediation PR?'),
    default: false,
  });
  if (!approved) {
    console.log(paint.fail('Denied — no PR will be opened. Run ends here.'));
    return;
  }
  console.log(paint.ok('Approved.'));

  // ── PHASE 4: PATCH ─────────────────────────────────────────────────────────
  console.log('\n' + banner.patch());
  s = ora({ text: paint.muted('Opening remediation pull request…'), color: 'cyan' }).start();
  await sleep(1600);
  s.succeed(paint.info('Remediation PR opened.'));
  console.log(
    paint.ok('PR #1 → ') +
    paint.info(`https://github.com/${REPO}/pull/1`) +
    paint.muted('   (comment /agentic_review to trigger Qodo)'),
  );

  console.log(paint.scan('\n✔ Tartarus run complete.'));
}

main().catch((err) => {
  console.error(paint.fail(String(err instanceof Error ? err.message : err)));
  process.exit(1);
});
