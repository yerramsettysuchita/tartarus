/**
 * Tests for the Self-Healing Loop (src/agent/selfHeal.ts).
 *
 * The pure decision/feedback functions are tested directly; the orchestrator is
 * tested against a mock GitHubService so the full "detect → refine → commit"
 * flow is exercised without a live PR.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  needsChanges, qodoRequestedChanges, collectFeedback, extractFiles, healOnce, healLoop,
} from '../src/agent/selfHeal.ts';
import type { Review, ReviewComment, RepoFile } from '../src/services/github.ts';

const rev = (state: string, author = 'qodo-merge-pro', body = '', submittedAt = '2026-08-28T10:00:00Z'): Review =>
  ({ state, author, body, submittedAt });

test('needsChanges: true when the latest decisive review requests changes', () => {
  assert.equal(needsChanges([rev('COMMENTED'), rev('CHANGES_REQUESTED', 'qodo', 'fix it', '2026-08-28T11:00:00Z')]), true);
});

test('needsChanges: false when a later APPROVED supersedes changes requested', () => {
  assert.equal(needsChanges([
    rev('CHANGES_REQUESTED', 'qodo', 'x', '2026-08-28T10:00:00Z'),
    rev('APPROVED', 'qodo', '', '2026-08-28T12:00:00Z'),
  ]), false);
});

test('needsChanges: false when there are no decisive reviews', () => {
  assert.equal(needsChanges([rev('COMMENTED'), rev('PENDING')]), false);
});

test('qodoRequestedChanges: recognises automated reviewers', () => {
  assert.equal(qodoRequestedChanges([rev('CHANGES_REQUESTED', 'qodo-merge-pro', 'x')]), true);
  assert.equal(qodoRequestedChanges([rev('CHANGES_REQUESTED', 'some-human', 'x')]), false);
});

test('collectFeedback: merges change-request bodies and inline comments', () => {
  const reviews: Review[] = [rev('CHANGES_REQUESTED', 'qodo', 'Use parameterised queries.')];
  const comments: ReviewComment[] = [
    { author: 'qodo', path: 'src/app.js', line: 42, body: 'Still concatenating input here.' },
    { author: 'qodo', path: 'src/app.js', line: null, body: '' }, // empty is skipped
  ];
  const fb = collectFeedback(reviews, comments);
  assert.match(fb, /Use parameterised queries/);
  assert.match(fb, /src\/app\.js:42 — Still concatenating/);
  assert.equal(fb.includes('line: null'), false);
});

test('extractFiles: parses a fenced ```json block', () => {
  const text = 'Here is the fix:\n```json\n{"files":[{"path":"a.js","content":"x"}]}\n```\nDone.';
  assert.deepEqual(extractFiles(text), [{ path: 'a.js', content: 'x' }]);
});

test('extractFiles: parses bare JSON and drops malformed entries', () => {
  assert.deepEqual(extractFiles('{"files":[{"path":"a","content":"c"},{"path":"b"}]}'),
    [{ path: 'a', content: 'c' }]);
});

test('extractFiles: returns [] on unparseable text', () => {
  assert.deepEqual(extractFiles('sorry, I could not do that'), []);
});

// ── Orchestrator against a mock GitHubService ────────────────────────────────
function mockGh(overrides: Partial<Record<string, unknown>> = {}) {
  const calls: { commits: Array<{ branch: string; files: RepoFile[] }>; comments: string[] } =
    { commits: [], comments: [] };
  const gh = {
    listReviews: async () => (overrides.reviews as Review[]) ?? [],
    listReviewComments: async () => (overrides.comments as ReviewComment[]) ?? [],
    prHeadBranch: async () => 'tartarus/fix-abc',
    commitToBranch: async (a: { branch: string; files: RepoFile[] }) => { calls.commits.push(a); },
    commentOnPr: async (_r: string, _n: number, body: string) => { calls.comments.push(body); },
  };
  return { gh: gh as never, calls };
}

test('healOnce: does nothing when no changes are requested', async () => {
  const { gh, calls } = mockGh({ reviews: [rev('APPROVED', 'qodo', '')] });
  const res = await healOnce({ gh, repo: 'o/a', prNumber: 1, refine: async () => [{ path: 'x', content: 'y' }] });
  assert.equal(res.healed, false);
  assert.equal(calls.commits.length, 0);
});

test('healOnce: commits a refined patch and comments when changes are requested', async () => {
  const { gh, calls } = mockGh({
    reviews: [rev('CHANGES_REQUESTED', 'qodo', 'Fix SQLi properly.')],
    comments: [{ author: 'qodo', path: 'src/app.js', line: 10, body: 'Use ? placeholder' }],
  });
  let sawFeedback = '';
  const res = await healOnce({
    gh, repo: 'o/a', prNumber: 7,
    refine: async (fb) => { sawFeedback = fb; return [{ path: 'src/app.js', content: 'fixed' }]; },
  });
  assert.equal(res.healed, true);
  assert.match(sawFeedback, /Fix SQLi properly/);
  assert.equal(calls.commits.length, 1);
  assert.equal(calls.commits[0]?.branch, 'tartarus/fix-abc');
  assert.equal(calls.comments.length, 1);
  assert.match(calls.comments[0] ?? '', /auto-heal/i);
});

test('healOnce: reports when refine produces no files', async () => {
  const { gh } = mockGh({ reviews: [rev('CHANGES_REQUESTED', 'qodo', 'x')] });
  const res = await healOnce({ gh, repo: 'o/a', prNumber: 3, refine: async () => [] });
  assert.equal(res.healed, false);
  assert.match(res.reason, /no file changes/i);
});

test('healLoop: stops as soon as a round needs no changes', async () => {
  let round = 0;
  const gh = {
    listReviews: async () => (round++ === 0
      ? [rev('CHANGES_REQUESTED', 'qodo', 'x')]
      : [rev('APPROVED', 'qodo', '')]),
    listReviewComments: async () => [],
    prHeadBranch: async () => 'b',
    commitToBranch: async () => {},
    commentOnPr: async () => {},
  } as never;
  const res = await healLoop({
    gh, repo: 'o/a', prNumber: 1,
    refine: async () => [{ path: 'f', content: 'c' }],
    maxAttempts: 3, sleep: async () => {},
  });
  // Round 1 pushed a fix; round 2 was clean → loop converges and reports done.
  assert.equal(res.healed, false);
  assert.match(res.reason, /No changes requested/);
  assert.equal(round, 2); // exactly two review checks
});
