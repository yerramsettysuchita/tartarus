/**
 * agent/heal.ts — CLI entrypoint for the Self-Healing Loop.
 *
 * Given a PR number, polls its reviews; if Qodo requested changes, it reads the
 * feedback, runs a focused TrueForge turn to regenerate the affected file(s),
 * and commits the improvement to the SAME PR branch — then waits for Qodo to
 * re-review. Repeats up to a bounded number of attempts.
 *
 * Run with:  npm run heal -- <prNumber> [owner/repo?]
 *
 * NOTE: the full loop needs a live Qodo review on a real PR to exercise; the
 * decision + commit logic is unit-tested in test/selfHeal.test.ts.
 */
import { TrueForge } from '@truefoundry/trueforge-sdk';
import { loadConfig } from '../config.js';
import { paint } from '../theme.js';
import { GitHubService, type RepoFile } from '../services/github.js';
import { healLoop, extractFiles } from './selfHeal.js';

const cfg = loadConfig();
const argv = process.argv.slice(2);
const prNumber = Number(argv.find((a) => /^\d+$/.test(a)));
const repo = argv.find((a) => /^[^/]+\/[^/]+$/.test(a)) ?? cfg.TARGET_REPO;

if (!prNumber) {
  console.error(paint.fail('Usage: npm run heal -- <prNumber> [owner/repo]'));
  process.exit(1);
}

const gh = new GitHubService(cfg.GITHUB_TOKEN);
const client = new TrueForge({
  baseUrl: cfg.TRUEFORGE_BASE_URL,
  timeoutInSeconds: 900,
  ...(cfg.TRUEFORGE_TOKEN ? { token: cfg.TRUEFORGE_TOKEN } : {}),
});

/**
 * Ask the agent to produce an improved patch. We give it Qodo's feedback plus
 * the current contents of the files Qodo commented on, and require a strict JSON
 * reply so we can commit the result deterministically.
 */
async function refine(feedback: string): Promise<RepoFile[]> {
  // Read the files Qodo referenced so the model edits the real current source.
  const paths = [...new Set(
    (await gh.listReviewComments(repo, prNumber)).map((c) => c.path).filter(Boolean),
  )];
  const current: RepoFile[] = [];
  for (const p of paths) {
    try { current.push(await gh.readFile(repo, p)); } catch { /* skip unreadable */ }
  }

  const prompt =
    'You are fixing a security patch that a code reviewer (Qodo) asked to change. ' +
    'Apply the feedback and return ONLY a JSON object of the form ' +
    '{"files":[{"path":"...","content":"<full new file contents>"}]} with no prose.\n\n' +
    `REVIEW FEEDBACK:\n${feedback}\n\n` +
    `CURRENT FILES:\n${current.map((f) => `--- ${f.path} ---\n${f.content}`).join('\n\n')}`;

  const { data: session } = await client.sessions.create({
    agent: { spec: { model: { name: cfg.TARTARUS_MODEL, params: { max_tokens: 8192, temperature: 0.1 } } } },
  });
  const stream = await client.sessions.createTurnStream(session.id, {
    input: [{ type: 'user.message', content: prompt }],
  });
  let text = '';
  for await (const { data: event } of stream.withMetadata()) {
    if (event.type === 'model.message.delta') text += event.content ?? '';
  }
  return extractFiles(text);
}

async function main(): Promise<void> {
  console.log(paint.gold(`\n🔁 Tartarus Self-Heal — PR #${prNumber} in ${repo}`));
  const result = await healLoop({
    gh, repo, prNumber, refine,
    emit: (kind, message) => console.log(paint.muted(`[${kind}] `) + message),
    maxAttempts: 3, pollMs: 30_000,
  });
  console.log((result.healed ? paint.gold : paint.scan)(`\n${result.reason}`));
}

main().catch((err) => {
  console.error(paint.fail(String(err instanceof Error ? err.stack ?? err.message : err)));
  process.exit(1);
});
