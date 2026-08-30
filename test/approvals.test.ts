/**
 * Tests for the gold-gate approval registry (src/server/approvals.ts).
 * Proves an async decision (from the UI or CLI) correctly unblocks the runner.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApprovalRegistry } from '../src/server/approvals.ts';

test('await() resolves when resolve() is called with allow', async () => {
  const reg = new ApprovalRegistry();
  const p = reg.await('id1', 'create_patch_pr', 'open PR?');
  assert.equal(reg.resolve('id1', 'allow'), true);
  assert.equal(await p, 'allow');
});

test('await() resolves with deny', async () => {
  const reg = new ApprovalRegistry();
  const p = reg.await('id2', 'create_patch_pr', 'open PR?');
  reg.resolve('id2', 'deny');
  assert.equal(await p, 'deny');
});

test('resolving an unknown id returns false', () => {
  const reg = new ApprovalRegistry();
  assert.equal(reg.resolve('nope', 'allow'), false);
});

test('a resolved approval is removed and cannot be resolved twice', async () => {
  const reg = new ApprovalRegistry();
  const p = reg.await('id3', 't', 's');
  assert.equal(reg.resolve('id3', 'allow'), true);
  await p;
  assert.equal(reg.has('id3'), false);
  assert.equal(reg.resolve('id3', 'deny'), false);
});

test('list() exposes pending approvals without the resolve fn', () => {
  const reg = new ApprovalRegistry();
  reg.await('id4', 'create_patch_pr', 'summary text');
  const list = reg.list();
  assert.equal(list.length, 1);
  assert.equal(list[0]?.id, 'id4');
  assert.equal(list[0]?.toolName, 'create_patch_pr');
  assert.equal('resolve' in (list[0] as object), false);
});

test('size and has track pending state', () => {
  const reg = new ApprovalRegistry();
  assert.equal(reg.size, 0);
  reg.await('a', 't', 's');
  reg.await('b', 't', 's');
  assert.equal(reg.size, 2);
  assert.equal(reg.has('a'), true);
  reg.resolve('a', 'allow');
  assert.equal(reg.size, 1);
});

test('multiple concurrent approvals resolve independently', async () => {
  const reg = new ApprovalRegistry();
  const p1 = reg.await('x', 't', 's');
  const p2 = reg.await('y', 't', 's');
  reg.resolve('y', 'deny');
  reg.resolve('x', 'allow');
  assert.deepEqual(await Promise.all([p1, p2]), ['allow', 'deny']);
});
