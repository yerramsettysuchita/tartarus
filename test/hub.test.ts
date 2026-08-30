/**
 * Integration tests for the Command Center hub (src/server/hub.ts).
 * Spins up the real Express server on an ephemeral port and exercises the API
 * the dashboard depends on: health, state, the approval round-trip, and SSE.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startHub, type Hub } from '../src/server/hub.ts';

let hub: Hub;
let base: string;

before(async () => {
  hub = await startHub(0); // 0 → OS picks a free port
  base = `http://localhost:${hub.port}`;
});

after(async () => { await hub.close(); });

test('GET /api/health reports ok and the current seq', async () => {
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(typeof body.seq, 'number');
});

test('GET /api/state reflects pending approvals', async () => {
  hub.approvals.await('state-1', 'create_patch_pr', 'open PR?');
  const state = await (await fetch(`${base}/api/state`)).json();
  assert.ok(state.pending.some((p: { id: string }) => p.id === 'state-1'));
  hub.approvals.resolve('state-1', 'deny'); // clean up
});

test('POST /api/approvals/:id resolves the awaited decision', async () => {
  const p = hub.approvals.await('call-1', 'create_patch_pr', 'open PR?');
  const res = await fetch(`${base}/api/approvals/call-1`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ decision: 'allow' }),
  });
  assert.equal(res.status, 200);
  assert.equal(await p, 'allow');
});

test('POST with an invalid decision is rejected 400', async () => {
  hub.approvals.await('call-2', 't', 's');
  const res = await fetch(`${base}/api/approvals/call-2`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ decision: 'maybe' }),
  });
  assert.equal(res.status, 400);
  hub.approvals.resolve('call-2', 'deny');
});

test('POST to an unknown approval id returns 404', async () => {
  const res = await fetch(`${base}/api/approvals/ghost`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ decision: 'allow' }),
  });
  assert.equal(res.status, 404);
});

test('GET /api/events streams SSE with the correct content-type and backlog', async () => {
  hub.bus.publish('boot', 'hello-sse');
  const res = await fetch(`${base}/api/events?after=0`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /text\/event-stream/);
  const reader = res.body!.getReader();
  const { value } = await reader.read();
  const text = new TextDecoder().decode(value);
  assert.match(text, /event: boot/);
  assert.match(text, /hello-sse/);
  await reader.cancel();
});
