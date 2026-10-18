import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import type { Database, DbHandle } from '@/db/client';
import { searchProjects } from './index';
import { retaxonomy } from '@/jobs/retaxonomy';

test('catalogue search applies filters and searches published copy', async (t) => {
  const raw = new PGlite();
  for (const file of readdirSync('drizzle').filter((f) => f.endsWith('.sql')).sort()) await raw.exec(readFileSync(`drizzle/${file}`, 'utf8'));
  const d = drizzle(raw, { schema });
  const store = globalThis as typeof globalThis & { __sgDb?: DbHandle | null };
  const previous = store.__sgDb;
  store.__sgDb = { db: d as unknown as Database, driver: 'pglite', raw, close: () => raw.close() };
  async function add(name: string, over: Partial<typeof schema.project.$inferInsert> = {}, text = '生成设计组件') {
    const [p] = await d.insert(schema.project).values({ canonicalProjectId: `repo:${name}`, slug: name, name,
      primaryUrl: `https://github.com/test/${name}`, parseState: 'parsed', primaryCategory: 'design', focusScore: 5, ...over }).returning();
    await d.insert(schema.aiContent).values({ projectId: p.id, locale: 'zh', oneLiner: text, capabilities: ['导出动画效果'], passedGuard: true });
    return p;
  }
  try {
    const a = await add('english-project', { supportedAgents: ['cursor'], difficulty: 'simple_config', securityLevel: 'review' });
    await add('high-score-other-category', { primaryCategory: 'ai-tools', focusScore: 100 });
    await add('hidden-project', { hidden: true });
    await add('literal-100%', {}, '100% utility');
    await t.test('blank keyword returns catalogue and category-only filters work before LIMIT', async () => {
      const cards = await searchProjects('', 1, { cat: 'design', agent: 'cursor' });
      assert.deepEqual(cards.map((p) => p.id), [a.id]);
      assert.ok((await searchProjects('', 100)).length >= 3);
    });
    await t.test('Chinese descriptions and capabilities match English-named repositories', async () => {
      assert.ok((await searchProjects('设计组件', 20)).some((p) => p.id === a.id));
      assert.ok((await searchProjects('动画效果', 20)).some((p) => p.id === a.id));
    });
    await t.test('combined filters and unknown values do not broaden results', async () => {
      assert.deepEqual((await searchProjects('组件', 20, { cat: 'design', agent: 'cursor', difficulty: 'simple_config', security: 'review' })).map((p) => p.id), [a.id]);
      assert.deepEqual(await searchProjects('', 20, { security: 'not-an-enum' }), []);
      assert.ok((await searchProjects('', 20)).every((p) => p.name !== 'hidden-project'));
    });
    await t.test('wildcards and quotes are literal rather than broad matches or SQL', async () => {
      assert.deepEqual((await searchProjects('100%', 20)).map((p) => p.name), ['literal-100%']);
      assert.deepEqual(await searchProjects("' OR true --", 20), []);
    });
    await t.test('stable pages do not repeat rows', async () => {
      const first = await searchProjects('', 2);
      const next = await searchProjects('', 2, { offset: 2 });
      assert.ok(next.every((p) => !first.some((a) => a.id === p.id)));
    });
    await t.test('taxonomy backfill preserves manual overrides', async () => {
      const manual = await add('admin-override', { categorySource: 'admin', primaryCategory: 'design', secondaryCategory: 'motion' });
      await retaxonomy();
      const after = await d.select().from(schema.project);
      const row = after.find((p) => p.id === manual.id)!;
      assert.equal(row.primaryCategory, 'design');
      assert.equal(row.secondaryCategory, 'motion');
      assert.equal(row.categorySource, 'admin');
    });
  } finally { store.__sgDb = previous; await raw.close(); }
});
