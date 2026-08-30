/**
 * Tests for GitHub webhook helpers (src/server/webhook.ts) and the live
 * Sentinel webhook endpoint (src/server/hub.ts).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyGithubSignature, parsePushEvent } from '../src/server/webhook.ts';
import { startHub, type Hub } from '../src/server/hub.ts';
import type { PushInfo } from '../src/server/webhook.ts';

function sign(secret: string, body: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

test('verifyGithubSignature: accepts a correct signature', () => {
  const body = JSON.stringify({ hello: 'world' });
  assert.equal(verifyGithubSignature('s3cret', body, sign('s3cret', body)), true);
});

test('verifyGithubSignature: rejects a wrong signature and a wrong secret', () => {
  const body = '{"a":1}';
  assert.equal(verifyGithubSignature('s3cret', body, sign('other', body)), false);
  assert.equal(verifyGithubSignature('s3cret', body, 'sha256=deadbeef'), false);
});

test('verifyGithubSignature: rejects a missing/malformed header', () => {
  assert.equal(verifyGithubSignature('s', '{}', undefined), false);
  assert.equal(verifyGithubSignature('s', '{}', 'md5=abc'), false);
});

test('verifyGithubSignature: no secret configured accepts (dev mode)', () => {
  assert.equal(verifyGithubSignature(undefined, '{}', undefined), true);
});

test('parsePushEvent: extracts repo from a push event', () => {
  const info = parsePushEvent('push', { repository: { full_name: 'octo/app' }, ref: 'refs/heads/main', pusher: { name: 'dev' } });
  assert.deepEqual(info, { repo: 'octo/app', ref: 'refs/heads/main', pusher: 'dev' });
});

test('parsePushEvent: ignores non-push events and malformed repos', () => {
  assert.equal(parsePushEvent('pull_request', { repository: { full_name: 'o/a' } }), null);
  assert.equal(parsePushEvent('push', { repository: { full_name: 'not-a-repo' } }), null);
  assert.equal(parsePushEvent('push', {}), null);
});

// ── Live endpoint ────────────────────────────────────────────────────────────
let hub: Hub;
let base: string;
const pushes: PushInfo[] = [];
const SECRET = 'test-secret';

before(async () => {
  hub = await startHub(0, undefined, undefined, { secret: SECRET, onPush: (i) => pushes.push(i) });
  base = `http://localhost:${hub.port}`;
});
after(async () => { await hub.close(); });

test('POST /api/webhook/github: valid signature triggers onPush (202)', async () => {
  const body = JSON.stringify({ repository: { full_name: 'octo/app' }, ref: 'refs/heads/main' });
  const res = await fetch(`${base}/api/webhook/github`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-github-event': 'push', 'x-hub-signature-256': sign(SECRET, body) },
    body,
  });
  assert.equal(res.status, 202);
  assert.ok(pushes.some((p) => p.repo === 'octo/app'));
});

test('POST /api/webhook/github: bad signature is rejected 401', async () => {
  const body = JSON.stringify({ repository: { full_name: 'octo/app' } });
  const res = await fetch(`${base}/api/webhook/github`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-github-event': 'push', 'x-hub-signature-256': 'sha256=nope' },
    body,
  });
  assert.equal(res.status, 401);
});

test('POST /api/webhook/github: ping event pongs', async () => {
  const body = JSON.stringify({ zen: 'Keep it simple' });
  const res = await fetch(`${base}/api/webhook/github`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-github-event': 'ping', 'x-hub-signature-256': sign(SECRET, body) },
    body,
  });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).pong, true);
});

test('POST /api/webhook/github: non-push event is ignored 202', async () => {
  const body = JSON.stringify({ repository: { full_name: 'octo/app' } });
  const res = await fetch(`${base}/api/webhook/github`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-github-event': 'issues', 'x-hub-signature-256': sign(SECRET, body) },
    body,
  });
  assert.equal(res.status, 202);
});
