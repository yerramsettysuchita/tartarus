/**
 * agent/selfHeal.ts — the Self-Healing Loop (agentic collaboration with Qodo).
 *
 * After Tartarus opens a remediation PR, Qodo reviews it. If Qodo requests
 * changes, Tartarus doesn't stop: it reads Qodo's feedback, asks the agent to
 * produce an improved patch, and pushes a NEW COMMIT to the SAME PR branch —
 * then Qodo re-reviews. Two AIs converging on a correct fix, hands-free.
 *
 * The decision + feedback-extraction logic is pure and unit-tested; the live
 * parts (polling GitHub, running a refine turn, committing) are orchestrated
 * around it. End-to-end exercise requires a real Qodo review on a real PR.
 */
import type { Review, ReviewComment, RepoFile, GitHubService } from '../services/github.js';
import type { HuntEvent } from '../server/eventBus.js';

/** Reviewers whose "changes requested" should trigger a heal (Qodo + humans). */
const HEAL_TRIGGERS = /qodo|codiumai|coderabbit/i;

/**
 * Does the PR need changes? True when the most recent decisive review (by any
 * reviewer) is CHANGES_REQUESTED and hasn't been superseded by a later APPROVED.
 */
export function needsChanges(reviews: Review[]): boolean {
  const decisive = reviews
    .filter((r) => r.state === 'CHANGES_REQUESTED' || r.state === 'APPROVED')
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  const last = decisive.at(-1);
  return last?.state === 'CHANGES_REQUESTED';
}

/** Did an automated reviewer (Qodo et al.) specifically request changes? */
export function qodoRequestedChanges(reviews: Review[]): boolean {
  return reviews.some((r) => r.state === 'CHANGES_REQUESTED' && HEAL_TRIGGERS.test(r.author));
}

/**
 * Collect the actionable feedback from a review round into a single instruction
 * block the agent can act on: the change-request review bodies plus every inline
 * comment (file:line — text).
 */
export function collectFeedback(reviews: Review[], comments: ReviewComment[]): string {
  const parts: string[] = [];
  for (const r of reviews) {
    if (r.state === 'CHANGES_REQUESTED' && r.body.trim()) {
      parts.push(`Review by ${r.author} (changes requested):\n${r.body.trim()}`);
    }
  }
  for (const c of comments) {
    if (c.body.trim()) {
      parts.push(`- ${c.path}${c.line ? `:${c.line}` : ''} — ${c.body.trim()} (${c.author})`);
    }
  }
  return parts.join('\n\n');
}

/** Extract a patch ({files:[{path,content}]}) from a model's (possibly fenced) reply. */
export function extractFiles(text: string): RepoFile[] {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence?.[1] ?? text;
  try {
    const parsed = JSON.parse(raw.trim());
    const files = ((parsed as { files?: RepoFile[] }).files ?? parsed) as RepoFile[];
    return Array.isArray(files) ? files.filter((f) => f?.path && typeof f.content === 'string') : [];
  } catch {
    return [];
  }
}

export type Emit = (kind: HuntEvent['kind'], message: string, data?: unknown) => void;

export interface HealDeps {
  gh: GitHubService;
  repo: string;
  prNumber: number;
  emit?: Emit;
  /**
   * Produce an improved patch given Qodo's feedback. In production this runs a
   * focused TrueForge turn; injected here so the orchestration is testable.
   */
  refine: (feedback: string) => Promise<RepoFile[]>;
}

export interface HealResult {
  healed: boolean;
  reason: string;
}

/**
 * One self-heal iteration: check the PR's reviews; if changes are requested,
 * gather the feedback, generate an improved patch, and commit it to the PR's
 * head branch. Returns whether it pushed a fix.
 */
export async function healOnce(deps: HealDeps): Promise<HealResult> {
  const { gh, repo, prNumber, refine } = deps;
  const emit = deps.emit ?? (() => {});

  const reviews = await gh.listReviews(repo, prNumber);
  if (!needsChanges(reviews)) {
    return { healed: false, reason: 'No changes requested — nothing to heal.' };
  }
  emit('phase', `Qodo requested changes on PR #${prNumber} — self-healing…`, { pr: prNumber });

  const comments = await gh.listReviewComments(repo, prNumber);
  const feedback = collectFeedback(reviews, comments);
  emit('log', `Collected review feedback (${feedback.length} chars). Regenerating patch…`);

  const files = await refine(feedback);
  if (files.length === 0) {
    return { healed: false, reason: 'The refine step produced no file changes.' };
  }

  const branch = await gh.prHeadBranch(repo, prNumber);
  await gh.commitToBranch({
    repo, branch,
    message: `fix(security): address Qodo review feedback (auto-heal)\n\n${feedback.slice(0, 500)}`,
    files,
  });
  await gh.commentOnPr(repo, prNumber,
    '🤖 **Tartarus auto-heal:** pushed an improved patch addressing the review feedback. ' +
    'Re-running `/agentic_review` — please take another look.');

  emit('pr_opened', `Auto-fix committed to PR #${prNumber}`, { pr: prNumber, files: files.map((f) => f.path) });
  return { healed: true, reason: `Committed ${files.length} refined file(s) to ${branch}.` };
}

/**
 * Poll a PR until it's approved or a bounded number of heal attempts is reached.
 * Each attempt that finds "changes requested" pushes a fix and waits for the
 * next review round.
 */
export async function healLoop(deps: HealDeps & {
  maxAttempts?: number;
  pollMs?: number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<HealResult> {
  const maxAttempts = deps.maxAttempts ?? 3;
  const pollMs = deps.pollMs ?? 30_000;
  const sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const emit = deps.emit ?? (() => {});

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await healOnce(deps);
    if (!result.healed) return result; // approved or nothing to do
    emit('log', `Heal attempt ${attempt}/${maxAttempts} pushed a fix; awaiting re-review…`);
    if (attempt < maxAttempts) await sleep(pollMs);
  }
  return { healed: true, reason: `Reached max heal attempts (${maxAttempts}).` };
}
