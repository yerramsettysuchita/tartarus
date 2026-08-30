/**
 * Tests for the tool input contracts (src/mcp/schemas.ts).
 *
 * Every tool call from Claude is validated against these Zod schemas before our
 * code runs. These tests pin the contract: good payloads parse (with defaults
 * applied) and malformed ones are rejected — so a bad tool call fails loudly at
 * the boundary instead of causing a confusing downstream error.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import {
  scanRepoShape,
  runExploitShape,
  requestApprovalShape,
  createPatchPrShape,
} from '../src/mcp/schemas.ts';

const scan = z.object(scanRepoShape);
const exploit = z.object(runExploitShape);
const approval = z.object(requestApprovalShape);
const patch = z.object(createPatchPrShape);

test('scanRepo: applies the default maxFiles and allows an omitted repo', () => {
  const parsed = scan.parse({});
  assert.equal(parsed.maxFiles, 40);
  assert.equal(parsed.repo, undefined);
});

test('scanRepo: rejects a malformed repo and an over-limit maxFiles', () => {
  assert.equal(scan.safeParse({ repo: 'not-a-repo' }).success, false);
  assert.equal(scan.safeParse({ maxFiles: 9999 }).success, false);
});

test('runExploit: accepts the three languages and defaults the timeout', () => {
  for (const language of ['javascript', 'typescript', 'python'] as const) {
    const p = exploit.parse({ language, targetFilename: 'app.js', targetCode: 'x', exploitCode: 'y' });
    assert.equal(p.timeoutSec, 60);
  }
});

test('runExploit: rejects an unknown language and empty code', () => {
  assert.equal(exploit.safeParse({ language: 'ruby', targetFilename: 'a', targetCode: 'x', exploitCode: 'y' }).success, false);
  assert.equal(exploit.safeParse({ language: 'python', targetFilename: 'a', targetCode: '', exploitCode: 'y' }).success, false);
});

test('requestApproval: requires a valid severity and at least one affected file', () => {
  const good = approval.safeParse({
    vulnerability: 'SQLi', severity: 'high', exploitEvidence: 'ok',
    proposedPatch: 'use params', affectedFiles: ['src/app.js'],
  });
  assert.equal(good.success, true);
  assert.equal(approval.safeParse({
    vulnerability: 'x', severity: 'spicy', exploitEvidence: 'e', proposedPatch: 'p', affectedFiles: ['f'],
  }).success, false);
  assert.equal(approval.safeParse({
    vulnerability: 'x', severity: 'low', exploitEvidence: 'e', proposedPatch: 'p', affectedFiles: [],
  }).success, false);
});

test('createPatchPr: requires at least one file with a path', () => {
  const good = patch.safeParse({
    title: 'fix', summary: 'body', files: [{ path: 'src/app.js', content: '...' }],
  });
  assert.equal(good.success, true);
  assert.equal(patch.safeParse({ title: 'fix', summary: 'body', files: [] }).success, false);
  assert.equal(patch.safeParse({
    title: 'fix', summary: 'body', files: [{ path: '', content: 'x' }],
  }).success, false);
});

test('createPatchPr: repo is optional but validated when present', () => {
  assert.equal(patch.safeParse({
    repo: 'org/name', title: 't', summary: 's', files: [{ path: 'a', content: 'b' }],
  }).success, true);
  assert.equal(patch.safeParse({
    repo: 'bad', title: 't', summary: 's', files: [{ path: 'a', content: 'b' }],
  }).success, false);
});

test('runExploit: rejects a timeout over the 180s ceiling', () => {
  assert.equal(exploit.safeParse({
    language: 'javascript', targetFilename: 'a.js', targetCode: 'x', exploitCode: 'y', timeoutSec: 999,
  }).success, false);
});

test('scanRepo: accepts a well-formed owner/name repo', () => {
  assert.equal(scan.safeParse({ repo: 'octo-org/vuln-app' }).success, true);
});

test('requestApproval: allows every valid severity level', () => {
  for (const severity of ['low', 'medium', 'high', 'critical']) {
    assert.equal(approval.safeParse({
      vulnerability: 'v', severity, exploitEvidence: 'e', proposedPatch: 'p', affectedFiles: ['f'],
    }).success, true);
  }
});
