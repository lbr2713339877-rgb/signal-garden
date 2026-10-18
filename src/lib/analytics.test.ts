import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyticsConfig } from '@/lib/analytics';
import { DICT } from '@/lib/dict';

const UMAMI = 'https://analytics.signalgarden.site/script.js';
const WEBSITE = '123e4567-e89b-12d3-a456-426614174000';

test('analytics stays off unless a script url is set', () => {
  assert.equal(analyticsConfig({}), null);
  assert.equal(analyticsConfig({ scriptSrc: '   ', websiteId: WEBSITE, dataDomain: 'signalgarden.site' }), null);
  assert.equal(analyticsConfig({ websiteId: WEBSITE }), null);
  assert.equal(analyticsConfig({ dataDomain: 'signalgarden.site' }), null);
  assert.equal(analyticsConfig({ scriptSrc: 'javascript:alert(1)' }), null);
  assert.equal(analyticsConfig({ scriptSrc: 'https://user:pass@analytics.example/script.js' }), null);
});

test('umami src and website id are passed through', () => {
  assert.deepEqual(analyticsConfig({ scriptSrc: UMAMI, websiteId: WEBSITE }), {
    src: UMAMI,
    websiteId: WEBSITE,
    dataDomain: null,
  });
});

test('a plausible script url can carry data-domain without a built-in host', () => {
  const src = 'https://plausible.io/js/script.js';
  assert.deepEqual(
    analyticsConfig({ scriptSrc: src, dataDomain: 'https://signalgarden.site/path', websiteId: '  ' }),
    { src, websiteId: null, dataDomain: 'signalgarden.site' },
  );
});

test('unsafe attribute values are dropped and the script still loads', () => {
  assert.deepEqual(
    analyticsConfig({ scriptSrc: '/script.js', websiteId: 'id with space', dataDomain: 'not a domain' }),
    { src: '/script.js', websiteId: null, dataDomain: null },
  );
});

test('privacy copy describes an optional script and not a named vendor', () => {
  for (const key of ['privacy.cookiesP1', 'cookies.intro', 'cookies.analyticsP1', 'privacy.share4', 'privacy.storageP1'] as const) {
    const [zh, en] = DICT[key];
    assert.doesNotMatch(zh, /Plausible/i, key);
    assert.doesNotMatch(en, /Plausible/i, key);
    assert.doesNotMatch(en, /[\u4e00-\u9fff]/, key);
    assert.doesNotMatch(en, /we use (?:third-party )?advertising/i, key);
    assert.doesNotMatch(zh, /plausible_ignore/, key);
    assert.doesNotMatch(en, /plausible_ignore/, key);
  }
  assert.match(DICT['cookies.analyticsP1'][1], /first-party or privacy-friendly/);
  assert.match(DICT['cookies.analyticsP1'][1], /When it is not configured, we load nothing/);
  assert.match(DICT['cookies.analyticsP1'][1], /Do Not Track/);
  assert.match(DICT['privacy.cookiesP1'][1], /homepage counters/);
  assert.match(DICT['privacy.cookiesP1'][0], /不使用分析类 Cookie/);
  assert.match(DICT['cookies.analyticsP1'][0], /第一方/);
  assert.match(DICT['privacy.share4'][1], /only when configured/);
});
