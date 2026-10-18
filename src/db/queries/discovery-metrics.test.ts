import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import type { Database, DbHandle } from '@/db/client';
import { recordDiscoveryEvents } from './discovery-metrics';
import { POST } from '@/app/api/discovery-events/route';

test('daily counters increment atomically and ignore unknown project slugs', async () => {
  const raw = new PGlite();
  for (const file of readdirSync('drizzle').filter((f) => f.endsWith('.sql')).sort()) await raw.exec(readFileSync(`drizzle/${file}`, 'utf8'));
  const d = drizzle(raw, { schema });
  const store = globalThis as typeof globalThis & { __sgDb?: DbHandle | null };
  const previous = store.__sgDb;
  store.__sgDb = { db: d as unknown as Database, driver: 'pglite', raw, close: () => raw.close() };
  try {
    await d.insert(schema.project).values({ canonicalProjectId: 'repo:documented', slug: 'documented', name: 'Documented', primaryUrl: 'https://github.com/test/documented' });
    await Promise.all([0, 1, 2].map(() => recordDiscoveryEvents([
      { event: 'click', placement: 'featured', target: 'documented' },
      { event: 'impression', placement: 'task', target: 'video' },
      { event: 'click', placement: 'grid', target: 'unknown-project' },
    ])));
    const counters = await d.select().from(schema.discoveryMetric);
    assert.equal(counters.length, 2);
    assert.ok(counters.every((row) => row.count === 3));
    assert.ok(counters.every((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.day)));
    const request = (origin: string, body: unknown) => new Request('http://localhost:3000/api/discovery-events', {
      method: 'POST', headers: { host: '127.0.0.1:3000', origin, 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    const payload = [{ event: 'click', placement: 'featured', target: 'documented' }];
    assert.equal((await POST(request('https://another.site', payload))).status, 403);
    assert.equal((await POST(request('http://127.0.0.1:3000', [{ ...payload[0], userId: 'private' }]))).status, 400);
    assert.equal((await POST(request('http://127.0.0.1:3000', payload))).status, 204);
    const updated = await d.select().from(schema.discoveryMetric);
    assert.equal(updated.find((row) => row.event === 'click')?.count, 4);
  } finally { store.__sgDb = previous; await raw.close(); }
});
