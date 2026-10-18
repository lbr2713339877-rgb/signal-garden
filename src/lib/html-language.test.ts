import { test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Static helper mirroring the server-rendered contract: every localized node
 * carries data-lang, and English nodes never contain Han characters.
 */
export function englishNodesContainHan(html: string): string[] {
  const spans = [...html.matchAll(/<span[^>]*data-lang="en"[^>]*>(.*?)<\/span>/gs)];
  return spans
    .map((m) => m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((text) => /[\u4e00-\u9fff]/.test(text));
}

test('english language nodes must not contain Han characters', () => {
  const good = '<span data-lang="en">English only</span><span data-lang="zh">中文</span>';
  assert.deepEqual(englishNodesContainHan(good), []);
  const bad = '<span data-lang="en">中文 should not be here</span>';
  assert.equal(englishNodesContainHan(bad).length, 1);
});
