import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseDiscoveryEvents } from './discovery-metrics';

test('discovery counters accept only allowlisted anonymous dimensions', () => {
  const event = { event: 'click', placement: 'grid', target: 'oil-oil-oil-ui' };
  assert.deepEqual(parseDiscoveryEvents([event, event]), [event]);
  assert.equal(parseDiscoveryEvents([{ ...event, userId: 'someone' }]), null);
  assert.equal(parseDiscoveryEvents([{ ...event, target: '/search?q=email@example.com' }]), null);
  assert.equal(parseDiscoveryEvents([{ ...event, placement: 'task', target: 'unknown-task' }]), null);
  assert.equal(parseDiscoveryEvents([{ ...event, event: 'purchase' }]), null);
  assert.equal(parseDiscoveryEvents(Array(25).fill(event)), null);
  assert.equal(parseDiscoveryEvents(null), null);
});
