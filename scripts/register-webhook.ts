/**
 * scripts/register-webhook.ts — auto-register the GitHub push webhook.
 *
 * No more clicking through GitHub settings. This reads your repo + token from
 * .env and the public URL from the tunnel (written to .tunnel-url by
 * `npm run tunnel`), then registers/updates the push webhook via the REST API.
 *
 * Run with:  npm run webhook:register [-- <publicUrl>] [owner/repo]
 *   • publicUrl defaults to the value saved in .tunnel-url
 *   • repo defaults to TARGET_REPO
 */
import { readFileSync } from 'node:fs';
import { loadConfig } from '../src/config.js';
import { paint } from '../src/theme.js';
import { GitHubService } from '../src/services/github.js';

const cfg = loadConfig();
const argv = process.argv.slice(2);

const repo = argv.find((a) => /^[^/]+\/[^/]+$/.test(a)) ?? cfg.TARGET_REPO;
let publicUrl = argv.find((a) => /^https?:\/\//.test(a));

if (!publicUrl) {
  try {
    const saved = JSON.parse(readFileSync('.tunnel-url', 'utf8')) as { publicUrl?: string };
    publicUrl = saved.publicUrl;
  } catch { /* no tunnel file */ }
}

if (!publicUrl) {
  console.error(paint.fail(
    'No public URL. Start the tunnel first (npm run tunnel) or pass it:\n' +
    '  npm run webhook:register -- https://<your-tunnel>.ngrok.app',
  ));
  process.exit(1);
}

const payloadUrl = `${publicUrl.replace(/\/$/, '')}/api/webhook/github`;

async function main(): Promise<void> {
  const gh = new GitHubService(cfg.GITHUB_TOKEN);
  const result = await gh.ensureWebhook(repo, { url: payloadUrl, secret: cfg.GITHUB_WEBHOOK_SECRET });
  console.log(paint.ok(
    `${result.created ? 'Created' : 'Updated'} push webhook on ${repo} (id ${result.id})`,
  ));
  console.log(paint.muted(`   → ${payloadUrl}`));
  if (!cfg.GITHUB_WEBHOOK_SECRET) {
    console.log(paint.gold('   ⚠  GITHUB_WEBHOOK_SECRET is unset — the webhook has no signature secret.'));
  }
  console.log(paint.scan('\n✔ Push to the repo and watch the Command Center light up.'));
}

main().catch((err) => {
  const status = (err as { status?: number }).status;
  if (status === 404) {
    console.error(paint.fail(`Cannot manage webhooks on ${repo} (404). The token needs admin/write on the repo.`));
  } else {
    console.error(paint.fail(String(err instanceof Error ? err.message : err)));
  }
  process.exit(1);
});
