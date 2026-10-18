import { XHS_URL, X_URL } from './site';
import type { EmailLocale } from './email-locale';

// Literal colors and table layouts remain usable without a client stylesheet.
const C = {
  bg: '#060808', panel: '#101414', footer: '#141c19', ink: '#f2f0ea',
  muted: '#b0b7b2', dim: '#929e97', line: '#2b3430', accent: '#b9d9bd',
} as const;
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Noto Sans SC',Helvetica,Arial,sans-serif";

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/** Reject invalid public origins before inserting them into transactional mail. */
export function emailSiteUrl(raw: string): string {
  const value = raw.trim().replace(/\/+$/, '');
  if (!value) throw new Error('[email] NEXT_PUBLIC_SITE_URL is required');
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('[email] site URL must be a valid HTTPS domain'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('[email] site URL must be an HTTPS origin without credentials, path, query or fragment');
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(url.hostname) || url.hostname.includes(':')) {
    throw new Error('[email] site URL must be a domain, not an IP');
  }
  return url.origin;
}

export interface EmailBrandInput { siteUrl: string; contact: string; year?: number; locale?: EmailLocale }
interface FrameInput extends EmailBrandInput {
  title: string; preheader: string; body: string; reason: string;
}

function frame(input: FrameInput) {
  const base = emailSiteUrl(input.siteUrl);
  const site = escapeHtml(base);
  const contact = escapeHtml(input.contact);
  const domain = escapeHtml(new URL(base).host);
  const year = input.year ?? new Date().getFullYear();
  const en = input.locale === 'en';
  const social = (href: string, icon: string, label: string) => {
    const size = icon === 'xiaohongshu' ? 30 : 22;
    const padding = icon === 'xiaohongshu' ? 7 : 11;
    return `<td width="44" height="44" align="center" valign="middle" style="width:44px;height:44px;">
    <a href="${escapeHtml(href)}" aria-label="${label}" title="${label}" style="display:block;padding:${padding}px;text-decoration:none;color:${C.ink};"><img src="${site}/email/${icon}.png" width="${size}" height="${size}" alt="${label}" style="display:block;width:${size}px;height:${size}px;border:0;color:${C.ink};font-size:10px;"></a>
  </td>`;
  };
  return `<!doctype html>
<html lang="${en ? 'en' : 'zh-CN'}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(input.title)}</title>
<style>
  :root { color-scheme:dark; supported-color-schemes:dark; }
  body,table,td,a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table,td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
  img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
  @media only screen and (max-width:620px) {
    .outer { padding:20px 12px !important; }
    .pad { padding-left:24px !important; padding-right:24px !important; }
    .headline { font-size:24px !important; }
    .brand { width:216px !important; height:36px !important; }
    .code { font-size:34px !important; letter-spacing:6px !important; }
  }
</style></head>
<body bgcolor="${C.bg}" style="margin:0;padding:0;background-color:${C.bg};font-family:${FONT};color:${C.ink};">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(input.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.bg}" style="background-color:${C.bg};">
<tr><td class="outer" align="center" style="padding:48px 16px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.panel}" style="width:100%;max-width:600px;background-color:${C.panel};border:1px solid ${C.line};">
  <tr><td class="pad" style="padding:32px 40px;">
    <a href="${site}" style="text-decoration:none;"><img class="brand" src="${site}/email/logo.png" width="240" height="40" alt="Signal Garden" style="display:block;width:240px;height:40px;color:${C.ink};font-family:${FONT};font-size:18px;"></a>
  </td></tr>
  <tr><td class="pad" style="padding:0 40px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td height="1" bgcolor="${C.line}" style="font-size:0;line-height:1px;">&nbsp;</td></tr></table></td></tr>
  <tr><td class="pad" style="padding:36px 40px 40px;font-family:${FONT};">
    ${input.body}
    <p style="margin:36px 0 0;font-size:13px;line-height:1.8;color:${C.muted};">— Signal Garden</p>
  </td></tr>
  <tr><td class="pad" bgcolor="${C.footer}" style="padding:28px 40px 30px;background-color:${C.footer};border-top:1px solid ${C.line};font-family:${FONT};">
    <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.3;color:${C.ink};">Less noise. More signal.</p>
    <p style="margin:8px 0 22px;font-size:12px;line-height:1.7;color:${C.muted};">${en ? 'Discover projects worth your attention.' : '在噪音之外，发现值得关注的项目。'}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      ${social(XHS_URL, 'xiaohongshu', en ? 'Xiaohongshu' : '小红书')}
      <td width="12" style="width:12px;font-size:0;">&nbsp;</td>
      ${social(X_URL, 'x', 'X')}
    </tr></table>
    <p style="margin:22px 0 0;font-size:12px;line-height:1.9;color:${C.muted};">
      <a href="${site}" style="color:${C.muted};text-decoration:underline;">${domain}</a><br>
      <a href="mailto:${contact}" style="color:${C.muted};text-decoration:underline;">${contact}</a>
    </p>
    <p style="margin:18px 0 0;font-size:11px;line-height:1.8;color:${C.dim};">${escapeHtml(input.reason)}</p>
    <p style="margin:8px 0 0;font-size:10px;line-height:1.8;color:${C.dim};">© ${year} Signal Garden. All rights reserved.</p>
  </td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}

function plainFooter(input: EmailBrandInput, reason: string) {
  const en = input.locale === 'en';
  return `Less noise. More signal.\n\n${en ? 'Website: ' : '网站：'}${emailSiteUrl(input.siteUrl)}\n${en ? 'Contact: ' : '联系邮箱：'}${input.contact}\n${en ? 'Xiaohongshu: ' : '小红书：'}${XHS_URL}\nX: ${X_URL}\n\n${reason}\n© ${input.year ?? new Date().getFullYear()} Signal Garden. All rights reserved.`;
}

export function renderWelcomeEmail(input: EmailBrandInput & { name?: string | null }) {
  const site = emailSiteUrl(input.siteUrl);
  const en = input.locale === 'en';
  const greeting = en ? (input.name ? `Hi ${input.name},` : 'Hello,') : (input.name ? `你好，${input.name}。` : '你好，欢迎你。');
  const copy = en ? {
    heading: 'Welcome.',
    ready: 'Your Signal Garden account is ready.',
    intro: 'We select developer projects worth exploring every day. Save the ones that catch your eye to your garden and come back to them later.',
    action: 'Open my garden',
    today: "Today's signals",
    reason: "You're receiving this email because you signed up for Signal Garden.",
    preheader: 'Welcome to Signal Garden. Your account is ready.',
  } : {
    heading: '欢迎加入。',
    ready: '你的 Signal Garden 账号已准备好。',
    intro: '我们每天筛选值得关注的开发者项目。遇到感兴趣的，你可以收藏到自己的花园，之后再慢慢看。',
    action: '打开我的花园',
    today: '今日信号',
    reason: '你收到这封邮件，是因为你刚刚注册了 Signal Garden 账号。',
    preheader: '欢迎加入 Signal Garden，你的账号已准备好。',
  };
  const subject = en ? 'Your Signal Garden account is ready' : '你的 Signal Garden 账号已准备好';
  const body = `<h1 class="headline" style="margin:0;font-family:'Songti SC','Noto Serif CJK SC',SimSun,Georgia,serif;font-size:26px;line-height:1.6;font-weight:400;color:${C.ink};">${copy.heading}</h1>
    <p style="margin:24px 0 0;font-size:15px;line-height:1.85;color:${C.ink};">${escapeHtml(greeting)}</p>
    <p style="margin:14px 0 0;font-size:15px;line-height:1.85;color:${C.muted};">${copy.ready}</p>
    <p style="margin:14px 0 0;font-size:15px;line-height:1.85;color:${C.muted};">${copy.intro}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;"><tr><td style="border-bottom:1px solid ${C.dim};mso-padding-alt:10px 0;">
      <a href="${escapeHtml(site)}/my-garden" style="display:inline-block;padding:10px 0;font-family:${FONT};font-size:14px;line-height:24px;font-weight:400;color:${C.ink};text-decoration:none;">${copy.action} &nbsp;&nbsp;&nbsp;→</a>
    </td></tr></table>
    <p style="margin:18px 0 0;font-size:12px;line-height:1.8;color:${C.muted};">${en ? 'Or explore ' : '也可以先看看 '}<a href="${escapeHtml(site)}/today" style="color:${C.muted};text-decoration:underline;">${escapeHtml(copy.today)}</a>${en ? '.' : '。'}</p>`;
  return {
    subject,
    html: frame({ ...input, title: subject, preheader: copy.preheader, body, reason: copy.reason }),
    text: `${copy.heading}\n\n${greeting}\n\n${copy.ready}\n${copy.intro}\n\n${copy.action}: ${site}/my-garden\n${copy.today}: ${site}/today\n\n— Signal Garden\n\n${plainFooter(input, copy.reason)}`,
  };
}

export function renderVerificationEmail(input: EmailBrandInput & { code: string }) {
  if (!/^\d{6}$/.test(input.code)) throw new Error('[email] verification code must contain six digits');
  const en = input.locale === 'en';
  const copy = en ? {
    heading: 'Verify your email',
    intro: 'Enter this 6-digit code on the sign-up page:',
    expiry: 'Valid for 10 minutes · Do not share this code',
    ignore: "If you didn't request this, you can ignore this email.",
    reason: "You're receiving this email because someone used this address to sign up for Signal Garden.",
    title: 'Verify your Signal Garden email',
    preheader: 'Your Signal Garden verification code is valid for 10 minutes.',
  } : {
    heading: '邮箱验证',
    intro: '请在注册页面输入下方的 6 位验证码：',
    expiry: '10 分钟内有效 · 请勿向他人分享验证码',
    ignore: '如果不是你本人操作，请忽略这封邮件。',
    reason: '你收到这封邮件，是因为有人使用此邮箱注册 Signal Garden。',
    title: '验证你的 Signal Garden 邮箱',
    preheader: '你的 Signal Garden 验证码，10 分钟内有效。',
  };
  const subject = en ? `${input.code} is your Signal Garden verification code` : `${input.code} 是你的 Signal Garden 验证码`;
  const body = `<h1 class="headline" style="margin:0;font-family:'Songti SC','Noto Serif CJK SC',SimSun,Georgia,serif;font-size:26px;line-height:1.6;font-weight:400;color:${C.ink};">${copy.heading}</h1>
    <p style="margin:22px 0 0;font-size:15px;line-height:1.85;color:${C.muted};">${copy.intro}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:26px;"><tr><td align="center" style="padding:24px 12px;border-top:1px solid ${C.line};border-bottom:1px solid ${C.line};">
      <p class="code" style="margin:0;font-family:Consolas,'Courier New',monospace;font-size:42px;line-height:1.3;font-weight:500;letter-spacing:8px;color:${C.ink};">${input.code}</p>
    </td></tr></table>
    <p style="margin:14px 0 0;font-size:12px;line-height:1.8;color:${C.accent};">${copy.expiry}</p>
    <p style="margin:22px 0 0;font-size:12px;line-height:1.8;color:${C.muted};">${escapeHtml(copy.ignore)}</p>`;
  return {
    subject,
    html: frame({ ...input, title: copy.title, preheader: copy.preheader, body, reason: copy.reason }),
    text: `${copy.heading}\n\n${copy.intro}\n${input.code}\n${copy.expiry}\n${copy.ignore}\n\n— Signal Garden\n\n${plainFooter(input, copy.reason)}`,
  };
}
