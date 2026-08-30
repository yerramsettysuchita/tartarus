/**
 * Tests for the resilience layer (src/mcp/guard.ts).
 *
 * These prove the behaviour Tartarus depends on during a live run: transient
 * failures become structured, retryable tool results — the tool server never
 * crashes on a rate limit, timeout, or auth error.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { classifyError, errorResult, guard, withTimeout } from '../src/mcp/guard.ts';

test('classifyError: GitHub rate limit (429) is actionable', () => {
  const msg = classifyError('scan_repo_for_vulns', { status: 429 });
  assert.match(msg, /rate limit/i);
  assert.match(msg, /scan_repo_for_vulns/);
});

test('classifyError: 403 with "rate limit" text is treated as rate limiting', () => {
  const msg = classifyError('t', { status: 403, message: 'API rate limit exceeded' });
  assert.match(msg, /rate limit/i);
});

test('classifyError: plain 403/401 is an auth problem, not a rate limit', () => {
  assert.match(classifyError('t', { status: 401 }), /authorization failed/i);
  assert.match(classifyError('t', { status: 403, message: 'forbidden' }), /authorization failed/i);
});

test('classifyError: 404 mentions verifying the repo', () => {
  assert.match(classifyError('t', { status: 404 }), /not found/i);
});

test('classifyError: timeouts are flagged retryable', () => {
  assert.match(classifyError('t', { code: 'ETIMEDOUT' }), /timed out/i);
  assert.match(classifyError('t', { message: 'operation timeout' }), /timed out/i);
});

test('classifyError: connection refused points at an upstream service', () => {
  assert.match(classifyError('t', { code: 'ECONNREFUSED' }), /reach an upstream/i);
});

test('classifyError: unknown error falls back to its message, no stack', () => {
  const msg = classifyError('t', new Error('boom'));
  assert.match(msg, /t failed: boom/);
});

test('errorResult produces an isError tool result', () => {
  const r: CallToolResult = errorResult('t', { status: 429 });
  assert.equal(r.isError, true);
  assert.equal(r.content[0]?.type, 'text');
});

test('guard: a throwing handler becomes an isError result, never throws', async () => {
  const wrapped = guard('t', async () => { throw new Error('kaboom'); });
  const r = await wrapped({});
  assert.equal(r.isError, true);
  assert.match((r.content[0] as { text: string }).text, /kaboom/);
});

test('guard: a successful handler passes its result through untouched', async () => {
  const ok: CallToolResult = { content: [{ type: 'text', text: 'hi' }] };
  const wrapped = guard('t', async () => ok);
  const r = await wrapped({});
  assert.equal(r.isError, undefined);
  assert.equal((r.content[0] as { text: string }).text, 'hi');
});

test('withTimeout: resolves when the promise is fast', async () => {
  const v = await withTimeout('fast', 1000, Promise.resolve(42));
  assert.equal(v, 42);
});

test('withTimeout: rejects with an ETIMEDOUT-classified error when slow', async () => {
  const slow = new Promise((res) => setTimeout(res, 100));
  await assert.rejects(
    () => withTimeout('slow', 10, slow),
    (err: unknown) => {
      assert.equal((err as { code?: string }).code, 'ETIMEDOUT');
      assert.match(classifyError('t', err), /timed out/i);
      return true;
    },
  );
});
