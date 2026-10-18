import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderVerificationEmail, renderWelcomeEmail } from '../src/lib/email-template';
import { renderConfirmMail, renderDailyMail, renderWelcomeDigest } from '../src/emails/render-newsletter';

// Preview only: never instantiates Resend or sends a message.
const root = fileURLToPath(new URL('../', import.meta.url));
const output = `${root}tmp/email-preview`;
mkdirSync(output, { recursive: true });
const brand = { siteUrl: 'https://signalgarden.site', contact: 'hello@signalgarden.site' };
const previews = {
  welcome: renderWelcomeEmail({ ...brand, name: 'Ray' }),
  verification: renderVerificationEmail({ ...brand, code: '084219' }),
  'welcome-en': renderWelcomeEmail({ ...brand, name: 'Ray', locale: 'en' }),
  'verification-en': renderVerificationEmail({ ...brand, code: '084219', locale: 'en' }),
};
const digest = {
  'digest-confirm': await renderConfirmMail({
    locale: 'zh',
    siteUrl: 'https://signalgarden.site',
    confirmUrl: 'https://signalgarden.site/subscribe/confirm?t=preview',
    unsubscribeUrl: 'https://signalgarden.site/unsubscribe?t=preview',
  }),
  'digest-confirm-en': await renderConfirmMail({
    locale: 'en',
    siteUrl: 'https://signalgarden.site',
    confirmUrl: 'https://signalgarden.site/subscribe/confirm?t=preview',
    unsubscribeUrl: 'https://signalgarden.site/unsubscribe?t=preview',
  }),
  'digest-welcome': await renderWelcomeDigest({
    locale: 'zh',
    siteUrl: 'https://signalgarden.site',
    todayUrl: 'https://signalgarden.site/today',
    unsubscribeUrl: 'https://signalgarden.site/unsubscribe?t=preview',
  }),
  'digest-daily': await renderDailyMail({
    locale: 'zh',
    date: '2026-10-17',
    siteUrl: 'https://signalgarden.site',
    unsubscribeUrl: 'https://signalgarden.site/unsubscribe?t=preview',
    items: [{ rank: 1, name: 'Example', oneLiner: '一句话说明这个项目做什么。', forks7d: 12, href: 'https://signalgarden.site/p/example' }],
  }),
};
for (const [name, mail] of Object.entries({ ...previews, ...digest })) {
  writeFileSync(`${output}/${name}.html`, mail.html);
  writeFileSync(`${output}/${name}.txt`, mail.text);
  // Local, portable browser preview; real messages use the HTTPS asset URLs.
  const portable = mail.html.replace(/src="https:\/\/signalgarden\.site\/email\/([a-z]+\.png)"/g, (_, file: string) => {
    const data = readFileSync(`${root}public/email/${file}`).toString('base64');
    return `src="data:image/png;base64,${data}"`;
  });
  writeFileSync(`${output}/${name}-preview.html`, portable);
  console.log(`${name}: ${output}/${name}-preview.html`);
}
