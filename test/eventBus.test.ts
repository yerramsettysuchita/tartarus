/**
 * Tests for the streaming event bus (src/server/eventBus.ts).
 * Proves the dashboard gets a correct, ordered, replayable event stream.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../src/server/eventBus.ts';

test('publish assigns monotonic seq numbers starting at 1', () => {
  const bus = new EventBus();
  assert.equal(bus.publish('boot', 'a').seq, 1);
  assert.equal(bus.publish('log', 'b').seq, 2);
  assert.equal(bus.lastSeq, 2);
});

test('publish stamps kind, message, and an ISO timestamp', () => {
  const bus = new EventBus();
  const e = bus.publish('phase', 'scanning', { tool: 'scan' });
  assert.equal(e.kind, 'phase');
  assert.equal(e.message, 'scanning');
  assert.deepEqual(e.data, { tool: 'scan' });
  assert.ok(!Number.isNaN(Date.parse(e.ts)));
});

test('omits the data field when none is given', () => {
  const bus = new EventBus();
  assert.equal('data' in bus.publish('log', 'x'), false);
});

test('backlog(0) returns everything; backlog(n) returns only newer events', () => {
  const bus = new EventBus();
  bus.publish('boot', 'a');
  bus.publish('log', 'b');
  bus.publish('log', 'c');
  assert.equal(bus.backlog(0).length, 3);
  assert.deepEqual(bus.backlog(1).map((e) => e.message), ['b', 'c']);
  assert.equal(bus.backlog(3).length, 0);
});

test('subscribers receive live events; unsubscribe stops delivery', () => {
  const bus = new EventBus();
  const seen: string[] = [];
  const off = bus.subscribe((e) => seen.push(e.message));
  bus.publish('log', 'one');
  off();
  bus.publish('log', 'two');
  assert.deepEqual(seen, ['one']);
  assert.equal(bus.subscriberCount, 0);
});

test('a throwing subscriber does not break publishing to others', () => {
  const bus = new EventBus();
  const seen: string[] = [];
  bus.subscribe(() => { throw new Error('bad listener'); });
  bus.subscribe((e) => seen.push(e.message));
  assert.doesNotThrow(() => bus.publish('log', 'ok'));
  assert.deepEqual(seen, ['ok']);
});

test('buffer is bounded to bufferLimit (old events drop, seq keeps counting)', () => {
  const bus = new EventBus(3);
  for (let i = 0; i < 5; i++) bus.publish('log', `m${i}`);
  const backlog = bus.backlog(0);
  assert.equal(backlog.length, 3);
  assert.deepEqual(backlog.map((e) => e.message), ['m2', 'm3', 'm4']);
  assert.equal(bus.lastSeq, 5);
});

test('subscriberCount reflects active subscriptions', () => {
  const bus = new EventBus();
  const a = bus.subscribe(() => {});
  const b = bus.subscribe(() => {});
  assert.equal(bus.subscriberCount, 2);
  a(); b();
  assert.equal(bus.subscriberCount, 0);
});
