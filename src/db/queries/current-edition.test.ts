import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import type { Database, DbHandle } from '@/db/client';
import { getCurrentEdition, getTodaysSignals } from './index';
import { signalDate } from '@/lib/day';

test('edition remains available between midnight and the next publication without recycling ranks', async (t) => {
  const raw = new PGlite();
  for (const file of readdirSync('drizzle').filter((file) => file.endsWith('.sql')).sort()) await raw.exec(readFileSync(`drizzle/${file}`, 'utf8'));
  const d = drizzle(raw, { schema });
  const store = globalThis as typeof globalThis & { __sgDb?: DbHandle | null };
  const previous = store.__sgDb;
  store.__sgDb = { db: d as unknown as Database, driver: 'pglite', raw, close: () => raw.close() };
  const today = signalDate();
  const pastDate = (days: number) => signalDate(new Date(Date.now() - days * 86_400_000));
  async function publish(name: string, date: string, rank: number, published = true, hidden = false) {
    const [project] = await d.insert(schema.project).values({ canonicalProjectId: `repo:${name}`, slug: name, name,
      primaryUrl: `https://github.com/test/${name}`, parseState: 'parsed', hidden }).returning();
    await d.insert(schema.dailySignal).values({ projectId: project.id, signalDate: date, rank, heatScore: 50, breakdown: {}, isPublished: published });
    return project;
  }
  try {
    await t.test('no publication anywhere yields a truthful empty edition', async () => {
      assert.deepEqual(await getCurrentEdition(), { date: today, cards: [], isPrevious: false });
    });
    const previousDate = pastDate(2);
    await publish('older-edition', pastDate(3), 1);
    await publish('second', previousDate, 2);
    await publish('first', previousDate, 1);
    await publish('hidden-only-edition', pastDate(1), 1, true, true);
    await publish('unpublished-today', today, 1, false);
    await t.test('skip hidden-only and unpublished editions, keep original date, rank and limit', async () => {
      assert.equal((await getTodaysSignals()).cards.length, 0);
      const edition = await getCurrentEdition(1);
      assert.equal(edition.date, previousDate);
      assert.equal(edition.isPrevious, true);
      assert.deepEqual(edition.cards.map((card) => card.name), ['first']);
      assert.deepEqual((await getCurrentEdition(10)).cards.map((card) => card.name), ['first', 'second']);
      const saved = await d.select().from(schema.dailySignal);
      assert.equal(saved.filter((row) => row.signalDate === today && row.isPublished).length, 0);
    });
    await publish('new-today', today, 2);
    await t.test('publication automatically switches to today without filling a short edition with old projects', async () => {
      const edition = await getCurrentEdition(10);
      assert.equal(edition.date, today);
      assert.equal(edition.isPrevious, false);
      assert.deepEqual(edition.cards.map((card) => card.name), ['new-today']);
    });
  } finally { store.__sgDb = previous; await raw.close(); }
});

test('the edition date changes at Singapore midnight, rather than UTC midnight', () => {
  assert.equal(signalDate(new Date('2026-10-10T15:59:59Z')), '2026-10-10');
  assert.equal(signalDate(new Date('2026-10-10T16:00:00Z')), '2026-10-11');
});
