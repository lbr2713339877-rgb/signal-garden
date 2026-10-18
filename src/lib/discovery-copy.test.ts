import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ProjectCard } from '@/db/queries';
import { discoveryCopy, selectFeatured } from './discovery-copy';

const card = (over: Partial<ProjectCard> = {}) => ({ id: 'a', slug: 'a', name: 'A', oneLiner: '一个工具。', ...over } as ProjectCard);
test('featured selection rewards documented usefulness rather than heat', () => {
  const hot = card({ id: 'hot', heatScore: 9999 });
  const documented = card({ id: 'documented', capabilities: ['生成几种界面方案'], targetUsers: ['设计师'],
    installCommands: [{ kind: 'npm', command: 'npm i documented', source: 'readme' }] });
  assert.equal(selectFeatured([hot, documented])?.id, 'documented');
  assert.equal(selectFeatured([]), null);
  assert.equal(selectFeatured([documented, { ...documented, id: 'tied' }])?.id, 'documented');
});
test('headlines use capabilities and do not leak bilingual repo text or numeric savings claims', () => {
  assert.equal(discoveryCopy(card({ description: 'Design tools | 设计工具', capabilities: ['制作界面'], capabilitiesEn: ['Create interfaces'] })).headlineEn, 'Create interfaces');
  const savings = discoveryCopy(card({ slug: 'jgravelle-jcodemunch-mcp', oneLiner: '省九成以上 token。' }));
  assert.ok(!savings.summaryZh.includes('九成'));
  assert.equal(discoveryCopy(card({ capabilities: ['省九成 token', '定位函数'] })).headlineZh, '定位函数');
});
