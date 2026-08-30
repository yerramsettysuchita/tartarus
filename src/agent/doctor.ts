/**
 * agent/doctor.ts — pre-flight health check.
 *
 * Run this BEFORE a live hunt (or a demo recording) to confirm every moving part
 * is reachable and credentialed, so nothing fails on camera. It checks, in order:
 *
 *   0. .env is present and valid.
 *   1. TrueForge harness is up.
 *   2. The Tartarus MCP tool server is listening and accepts our bearer token.
 *   3. The GitHub token can read the target repo AND has push (PR) permission.
 *   4. The Daytona API accepts our credentials (sandbox engine reachable).
 *
 * Exits 0 if everything passes, 1 otherwise. Run with:  npm run doctor
 */
import { Octokit } from '@octokit/rest';
import { Daytona } from '@daytona/sdk';
import { loadConfig, type Config } from '../config.js';
import { paint } from '../theme.js';
import { withTimeout } from '../mcp/guard.js';

type Status = 'pass' | 'fail' | 'warn';
interface Check { name: string; status: Status; detail: string }

const results: Check[] = [];
function record(name: string, status: Status, detail: string): void {
  results.push({ name, status, detail });
  const icon = status === 'pass' ? paint.ok('') : status === 'warn' ? paint.gold('!') : paint.fail('');
  const label = status === 'pass' ? paint.scan(name) : status === 'warn' ? paint.gold(name) : paint.crit(name);
  console.log(`${icon} ${label}\n    ${paint.muted(detail)}`);
}

/** fetch with a hard timeout, distinguishing "down" from "responded with error". */
async function pingHttp(url: string, init: RequestInit, ms = 8000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ── 1. TrueForge harness reachable ───────────────────────────────────────────
async function checkTrueForge(cfg: Config): Promise<void> {
  try {
    const res = await pingHttp(cfg.TRUEFORGE_BASE_URL, { method: 'GET' });
    // Any HTTP response (even 404) means the harness is up and serving.
    record('TrueForge harness', 'pass', `${cfg.TRUEFORGE_BASE_URL} responded (HTTP ${res.status}).`);
  } catch (err) {
    const code = (err as { cause?: { code?: string } })?.cause?.code ?? (err as Error).name;
    record('TrueForge harness', 'fail',
      `Could not reach ${cfg.TRUEFORGE_BASE_URL} (${code}). Start it: npx @truefoundry/trueforge@latest`);
  }
}

// ── 2. Tartarus MCP tool server reachable + authed ───────────────────────────
async function checkMcpServer(cfg: Config): Promise<void> {
  try {
    // A non-initialize JSON-RPC body: the server checks auth first, then returns
    // 400 "No valid session". So 400 ⇒ reachable AND our bearer token matched;
    // 401 ⇒ token mismatch; connection error ⇒ server not running.
    const res = await pingHttp(cfg.TARTARUS_MCP_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${cfg.TARTARUS_MCP_TOKEN}`,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
    });
    if (res.status === 401) {
      record('MCP tool server', 'fail',
        `Reached ${cfg.TARTARUS_MCP_URL} but the bearer token was rejected (401). ` +
        `Check TARTARUS_MCP_TOKEN matches on both sides.`);
    } else {
      record('MCP tool server', 'pass',
        `${cfg.TARTARUS_MCP_URL} is listening and accepted the token (HTTP ${res.status}).`);
    }
  } catch (err) {
    const code = (err as { cause?: { code?: string } })?.cause?.code ?? (err as Error).name;
    record('MCP tool server', 'fail',
      `Could not reach ${cfg.TARTARUS_MCP_URL} (${code}). Start it: npm run mcp`);
  }
}

// ── 3. GitHub token: read + push on the target repo ──────────────────────────
async function checkGitHub(cfg: Config): Promise<void> {
  // Silence Octokit's own request logging — we report failures ourselves.
  const noop = () => {};
  const gh = new Octokit({
    auth: cfg.GITHUB_TOKEN,
    userAgent: 'tartarus-doctor',
    log: { debug: noop, info: noop, warn: noop, error: noop },
  });
  const [owner, name] = cfg.TARGET_REPO.split('/');
  try {
    const me = await gh.request('GET /user');
    const login = (me.data as { login?: string }).login ?? 'unknown';
    // Classic PATs expose scopes in this header; fine-grained PATs won't (that's fine).
    const scopes = me.headers['x-oauth-scopes'];

    const repo = await gh.repos.get({ owner: owner!, repo: name! });
    const perms = repo.data.permissions;
    if (perms?.push) {
      record('GitHub token', 'pass',
        `Authenticated as ${login}; can read AND push to ${cfg.TARGET_REPO}` +
        (scopes ? ` (scopes: ${scopes}).` : ' (fine-grained token).'));
    } else {
      record('GitHub token', 'fail',
        `Authenticated as ${login} and can READ ${cfg.TARGET_REPO}, but NO push permission — ` +
        `PR creation will fail. Grant Contents + Pull requests: read/write.`);
    }
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 401) {
      record('GitHub token', 'fail', 'GITHUB_TOKEN is invalid or expired (401).');
    } else if (status === 404) {
      record('GitHub token', 'fail',
        `Token is valid but cannot see ${cfg.TARGET_REPO} (404). Check the repo name and that the ` +
        `token is scoped to it.`);
    } else {
      record('GitHub token', 'fail', `GitHub check failed: ${(err as Error).message}`);
    }
  }
}

// ── 4. Daytona API credentials valid ─────────────────────────────────────────
async function checkDaytona(cfg: Config): Promise<void> {
  try {
    const daytona = new Daytona({
      apiKey: cfg.DAYTONA_API_KEY,
      apiUrl: cfg.DAYTONA_API_URL,
      target: cfg.DAYTONA_TARGET,
    });
    // list() hits the API and validates the key without provisioning anything.
    await withTimeout('daytona api', 10_000, daytona.list().next());
    record('Daytona sandbox API', 'pass',
      `Credentials accepted at ${cfg.DAYTONA_API_URL}; sandbox engine reachable (image ${cfg.DAYTONA_NODE_IMAGE}).`);
  } catch (err) {
    record('Daytona sandbox API', 'fail',
      `Daytona check failed: ${(err as Error).message}. Verify DAYTONA_API_KEY (needs Snapshots: write).`);
  }
}

async function main(): Promise<void> {
  console.log(paint.scan('\n🩺 Tartarus pre-flight check\n'));

  // 0. Config validity.
  let cfg: Config;
  try {
    cfg = loadConfig();
    record('Environment (.env)', 'pass', 'All required variables present and valid.');
  } catch (err) {
    record('Environment (.env)', 'fail', (err as Error).message);
    console.log(paint.crit('\nFix .env before continuing.\n'));
    process.exit(1);
    return;
  }

  // Run service checks (sequential for readable output).
  await checkTrueForge(cfg);
  await checkMcpServer(cfg);
  await checkGitHub(cfg);
  await checkDaytona(cfg);

  const failed = results.filter((r) => r.status === 'fail');
  console.log('');
  if (failed.length === 0) {
    console.log(paint.scan('✔ All systems go. You are clear for a live hunt.\n'));
    process.exit(0);
  } else {
    console.log(paint.crit(`✗ ${failed.length} check(s) failed: ${failed.map((f) => f.name).join(', ')}.`));
    console.log(paint.muted('Fix the above, then re-run: npm run doctor\n'));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(paint.fail(String(err instanceof Error ? err.stack ?? err.message : err)));
  process.exit(1);
});
