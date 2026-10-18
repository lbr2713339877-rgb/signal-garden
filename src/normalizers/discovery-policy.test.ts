import assert from 'node:assert/strict';
import { test } from 'node:test';
import { currentDiscoveryReview, DISCOVERY_REVIEW_VERSION, selectEdition, validateDiscoveryReview, discoveryEvidence, quotedDiscoveryEvidence } from './discovery-policy';
import { scoreFocus } from './focus';
import { buildQueryMatrix } from '@/collectors/github/search';

test('a discovery review needs quoted use and usage evidence, and expires with its source', () => {
  const source = 'An AI bot for your Telegram group. Run docker compose up to start the bot.';
  const valid = { isProduct: true, hasClearUse: true, hasUsageEvidence: true, interesting: true,
    quotes: ['An AI bot for your Telegram group.', 'Run docker compose up to start the bot.'] };
  assert.equal(validateDiscoveryReview(valid, source).passed, true);
  assert.equal(validateDiscoveryReview({ ...valid, quotes: ['The best video creator in the world.', valid.quotes[1]] }, source).passed, false);
  assert.equal(validateDiscoveryReview({ ...valid, isProduct: false }, source).passed, false);
  assert.equal(validateDiscoveryReview({ ...valid, quotes: [valid.quotes[0], valid.quotes[0]] }, source).passed, false);
  const docs = { discoveryReview: { ...validateDiscoveryReview(valid, source), version: DISCOVERY_REVIEW_VERSION, hash: 'old' } };
  assert.equal(currentDiscoveryReview(docs, 'new'), null);
  assert.equal(currentDiscoveryReview(docs, 'old')?.passed, true);
});

test('review citations resolve only to distinct actual source excerpts', () => {
  const source = 'A **Telegram bot** that replies in your group.\nRun `docker compose up` to start it.\n' + 'A long official product description '.repeat(30);
  const excerpts = discoveryEvidence(source);
  assert.ok(excerpts.every(s => source.includes(s) && s.length <= 220));
  const quotes = quotedDiscoveryEvidence([1, 2, 1, 0, -1, '2', 1.5, 9999], excerpts);
  assert.deepEqual(quotes, excerpts.slice(0, 2));
  assert.equal(validateDiscoveryReview({ isProduct:true, hasClearUse:true, hasUsageEvidence:true, interesting:true, quotes }, source).passed, true);
});

test('daily editions put two reviewed discoveries in the first ten and do not repeat an official domain', () => {
  const rows = Array.from({ length: 16 }, (_, i) => ({ projectId: String(i), interesting: i >= 12,
    primaryCategory: i % 2 ? 'design' : 'dev-tools', exposureKeys: [`domain:${i}`] }));
  const selected = selectEdition(rows, 15);
  assert.equal(selected.slice(0, 10).filter(r => r.interesting).length, 2);
  assert.equal(selectEdition([{ ...rows[0], exposureKeys: ['same'] }, { ...rows[1], exposureKeys: ['same'] }], 10).length, 1);
  assert.equal(selectEdition(rows.filter(r => !r.interesting).slice(0, 4), 10).length, 4, 'do not fill missing slots with unsuitable items');
});

test('new consumer products stay in scope on subsequent discovery runs', () => {
  for (const p of [
    { name: 'MuseBot', description: 'A Telegram bot with DeepSeek for group chat', topics: ['ai-bot'] },
    { name: 'OneTake AI', description: 'AI video editing for creators', topics: [] },
    { name: 'onetake', description: 'Make cinematic videos', topics: [], queries: ['focus:play:repo:onetake'] },
    { name: 'playground', description: 'A browser game with interactive art', topics: ['creative-coding'] },
  ]) assert.ok(scoreFocus(p).themes.includes('play'), p.name);
  const matrix = buildQueryMatrix();
  assert.ok(matrix.some(q => q.id === 'focus:play:repo:musebot'));
  assert.ok(matrix.filter(q => q.id.startsWith('focus:play:')).length >= 8);
  assert.equal(scoreFocus({ name: 'postgres', description: 'A relational database', topics: [] }).themes.includes('play'), false);
});
