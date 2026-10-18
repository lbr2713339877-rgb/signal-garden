import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeDisplayName } from './email';
import { emailSiteUrl, renderVerificationEmail, renderWelcomeEmail } from './email-template';
import { XHS_URL, X_URL } from './site';
import { normalizeEmailLocale, resolveEmailLocale } from './email-locale';

test('rejects random-looking email prefixes', () => {
  assert.equal(safeDisplayName('lbr2713339877'), null);
  assert.equal(safeDisplayName('user123456'), null);
  assert.equal(safeDisplayName('123456'), null);
  assert.equal(safeDisplayName('a123456789'), null);
  assert.equal(safeDisplayName('thisisaverylongusernamethatbreaks'), null);
});

test('keeps real-looking names', () => {
  assert.equal(safeDisplayName('Ray'), 'Ray');
  assert.equal(safeDisplayName('小王'), '小王');
  assert.equal(safeDisplayName('Ray2026'), 'Ray2026');
});

test('returns null for empty input', () => {
  assert.equal(safeDisplayName(null), null);
  assert.equal(safeDisplayName(''), null);
  assert.equal(safeDisplayName('   '), null);
});

const brand = { siteUrl: 'https://signalgarden.site', contact: 'hello@signalgarden.site', year: 2026 };

test('both transactional emails include the correct social links and usable plain text', () => {
  for (const mail of [renderWelcomeEmail(brand), renderVerificationEmail({ ...brand, code: '012345' })]) {
    for (const href of [XHS_URL, X_URL]) {
      assert.ok(mail.text.includes(href));
      assert.ok(mail.html.includes(`href="${href.replaceAll('&', '&amp;')}"`));
    }
    assert.ok(!mail.html.includes('5f4a9a0e000000000100b1a5'));
    assert.match(mail.html, /alt="Signal Garden"/);
    assert.match(mail.html, /alt="小红书"/);
    assert.match(mail.html, /alt="X"/);
    assert.match(mail.html, /© 2026 Signal Garden/);
  }
});

test('welcome mail escapes names and keeps both onboarding destinations', () => {
  const mail = renderWelcomeEmail({ ...brand, name: '<img src=x>' });
  assert.ok(!mail.html.includes('<img src=x>'));
  assert.ok(mail.html.includes('&lt;img src=x&gt;'));
  assert.ok(mail.html.includes('href="https://signalgarden.site/my-garden"'));
  assert.ok(mail.text.includes('https://signalgarden.site/today'));
});

test('verification mail preserves a leading zero and rejects malformed codes', () => {
  const mail = renderVerificationEmail({ ...brand, code: '012345' });
  assert.ok(mail.subject.startsWith('012345'));
  assert.ok(mail.html.includes('>012345</p>'));
  assert.ok(mail.text.includes('10 分钟内有效'));
  assert.throws(() => renderVerificationEmail({ ...brand, code: '<script>' }));
});

test('email images and destinations require a public HTTPS origin', () => {
  assert.equal(emailSiteUrl('https://signalgarden.site/'), brand.siteUrl);
  for (const origin of ['', 'http://signalgarden.site', 'https://127.0.0.1', 'https://[::1]', 'https://user:secret@signalgarden.site', 'https://signalgarden.site/?x=1', 'https://signalgarden.site/path']) {
    assert.throws(() => emailSiteUrl(origin));
  }
});

test('English welcome and verification mail localize the entire message', () => {
  const mails = [
    renderWelcomeEmail({ ...brand, name: 'Ray', locale: 'en' }),
    renderVerificationEmail({ ...brand, code: '012345', locale: 'en' }),
  ];
  for (const mail of mails) {
    assert.match(mail.html, /<html lang="en">/);
    assert.doesNotMatch(mail.html, /[\u4e00-\u9fff]/);
    assert.doesNotMatch(mail.text, /[\u4e00-\u9fff]/);
    assert.doesNotMatch(mail.subject, /[\u4e00-\u9fff]/);
    assert.match(mail.html, /alt="Xiaohongshu"/);
    assert.ok(mail.text.includes(XHS_URL));
    assert.ok(mail.text.includes(X_URL));
  }
  assert.equal(mails[0].subject, 'Your Signal Garden account is ready');
  assert.match(mails[0].html, /Open my garden/);
  assert.match(mails[0].text, /Hi Ray,/);
  assert.match(mails[1].subject, /^012345 is your Signal Garden verification code$/);
  assert.match(mails[1].text, /Valid for 10 minutes/);
});

test('Chinese templates retain their language and leading-zero codes', () => {
  const welcome = renderWelcomeEmail({ ...brand, locale: 'zh' });
  const verification = renderVerificationEmail({ ...brand, locale: 'zh', code: '012345' });
  assert.match(welcome.html, /<html lang="zh-CN">/);
  assert.match(welcome.subject, /账号已准备好/);
  assert.match(verification.text, /10 分钟内有效/);
  assert.match(verification.html, />012345<\/p>/);
});

test('UI language takes priority over saved and browser language', () => {
  assert.equal(resolveEmailLocale('en', 'zh', 'zh-CN'), 'en');
  assert.equal(resolveEmailLocale('zh', 'en', 'en-US'), 'zh');
  assert.equal(resolveEmailLocale(undefined, 'en', 'zh-CN'), 'en');
  assert.equal(resolveEmailLocale(undefined, 'zh', 'en-US'), 'zh');
  assert.equal(normalizeEmailLocale(' zh-Hant-TW '), 'zh');
  assert.equal(normalizeEmailLocale('EN-gb'), 'en');
  assert.equal(normalizeEmailLocale({ locale: 'zh' }), null);
});

test('missing choices follow browser preference with English as the international fallback', () => {
  assert.equal(resolveEmailLocale(undefined, undefined, 'zh-CN,zh;q=0.9,en;q=0.8'), 'zh');
  assert.equal(resolveEmailLocale(undefined, undefined, 'en-US,en;q=0.9,zh;q=0.8'), 'en');
  assert.equal(resolveEmailLocale(undefined, undefined, 'zh;q=0.2,en;q=0.9'), 'en');
  assert.equal(resolveEmailLocale(undefined, undefined, 'fr-FR,zh;q=0.5'), 'en');
  assert.equal(resolveEmailLocale(undefined, undefined, 'zh;q=0,en;q=0.5'), 'en');
  assert.equal(resolveEmailLocale(undefined, undefined, 'en;q=NaN,zh;q=0.8'), 'zh');
  assert.equal(resolveEmailLocale('<script>', null, '*'), 'en');
  assert.equal(resolveEmailLocale(undefined), 'en');
});
