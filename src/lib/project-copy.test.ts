import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickLocalizedCopy } from './project-copy';

test('localized project copy never falls back from en to zh', () => {
  const out = pickLocalizedCopy({
    zh: {
      oneLiner: '中文简介',
      targetUsers: ['独立开发者'],
      whyNow: ['中文 why'],
      notFor: ['中文不适合'],
      capabilities: ['中文能力'],
      installHint: '中文安装',
      riskNote: '中文风险',
    },
    en: null,
  }, 'English vendor description');

  assert.equal(out.oneLiner.zh, '中文简介');
  assert.equal(out.oneLiner.en, 'English vendor description');
  assert.deepEqual(out.targetUsers.en, []);
  assert.deepEqual(out.capabilities.en, []);
  assert.equal(out.installHint.en, null);
  assert.equal(out.riskNote.en, null);
});

test('localized project copy reads each locale from its own row', () => {
  const out = pickLocalizedCopy({
    zh: {
      oneLiner: '中文简介',
      targetUsers: ['独立开发者'],
      capabilities: ['中文能力'],
    },
    en: {
      oneLiner: 'English one-liner',
      targetUsers: ['Indie developer'],
      capabilities: ['English capability'],
    },
  });

  assert.equal(out.oneLiner.zh, '中文简介');
  assert.equal(out.oneLiner.en, 'English one-liner');
  assert.deepEqual(out.targetUsers.zh, ['独立开发者']);
  assert.deepEqual(out.targetUsers.en, ['Indie developer']);
  assert.deepEqual(out.capabilities.zh, ['中文能力']);
  assert.deepEqual(out.capabilities.en, ['English capability']);
});
