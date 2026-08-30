/**
 * start-tunnel.mjs — expose the local Sentinel webhook to the public internet.
 *
 * GitHub webhooks can't reach `localhost`, so we open a tunnel and print the
 * exact Payload URL to paste into your repo's webhook settings.
 *
 * Prefers the official ngrok SDK (`@ngrok/ngrok`) if installed + NGROK_AUTHTOKEN
 * is set; otherwise falls back to localtunnel via npx (no install, no account).
 *
 * Run with:  npm run tunnel
 */
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const PORT = Number(process.env.TARTARUS_UI_PORT ?? 8799);
const WEBHOOK_PATH = '/api/webhook/github';

function banner(publicUrl) {
  const payload = `${publicUrl.replace(/\/$/, '')}${WEBHOOK_PATH}`;
  // Persist the URL so `npm run webhook:register` can pick it up automatically.
  try {
    writeFileSync('.tunnel-url', JSON.stringify({ publicUrl, payloadUrl: payload }, null, 2));
  } catch { /* best effort */ }
  console.log('\n' + '═'.repeat(64));
  console.log('  🛰  TARTARUS SENTINEL TUNNEL IS LIVE');
  console.log('═'.repeat(64));
  console.log(`  Public URL     : ${publicUrl}`);
  console.log(`\n  👉 Paste this as the GitHub webhook "Payload URL":`);
  console.log(`     ${payload}`);
  console.log(`\n  GitHub webhook settings (repo → Settings → Webhooks → Add webhook):`);
  console.log(`     • Payload URL : ${payload}`);
  console.log(`     • Content type: application/json`);
  console.log(`     • Secret      : the value of GITHUB_WEBHOOK_SECRET in your .env`);
  console.log(`     • Events      : "Just the push event"`);
  console.log('═'.repeat(64) + '\n');
}

async function viaNgrok() {
  // Dynamic import so the SDK is optional.
  const ngrok = await import('@ngrok/ngrok').catch(() => null);
  if (!ngrok || !process.env.NGROK_AUTHTOKEN) return false;
  const listener = await ngrok.forward({ addr: PORT, authtoken_from_env: true });
  banner(listener.url());
  console.log('  (ngrok) Press Ctrl+C to stop.');
  return true;
}

function viaLocaltunnel() {
  console.log(`Starting localtunnel on port ${PORT} (via npx)…`);
  const lt = spawn('npx', ['--yes', 'localtunnel', '--port', String(PORT)], { shell: true });
  let printed = false;
  lt.stdout.on('data', (buf) => {
    const s = buf.toString();
    const m = s.match(/https?:\/\/[^\s]+/);
    if (m && !printed) { printed = true; banner(m[0]); }
    else process.stdout.write(s);
  });
  lt.stderr.on('data', (buf) => process.stderr.write(buf));
  lt.on('exit', (code) => { console.log(`localtunnel exited (${code}).`); process.exit(code ?? 0); });
}

const ok = await viaNgrok();
if (!ok) {
  console.log('ngrok SDK/authtoken not found — falling back to localtunnel.\n');
  viaLocaltunnel();
}
