import { Resend } from 'resend';

export interface WelcomeEmailInput {
  email: string;
  username?: string | null;
}

/* V3 tokens, frozen as literals: email clients cannot read CSS variables. */
const T = {
  bg: '#030303',
  panel: '#0c0c0f',
  ink1: '#f2f0ea',
  ink2: 'rgba(242,240,234,0.58)',
  ink3: 'rgba(242,240,234,0.38)',
  line: 'rgba(242,240,234,0.10)',
} as const;

const XHS_URL = 'https://www.xiaohongshu.com/user/profile/5f4a9a0e000000000100b1a5';

/**
 * A display name is only used when it reads like a real name. Random email
 * prefixes ("lbr2713339877") made the greeting look like an error message, so
 * anything numeric, over 20 chars, or containing a 6+ digit run is rejected.
 */
export function safeDisplayName(username?: string | null): string | null {
  const v = (username ?? '').trim();
  if (!v) return null;
  if (/^[A-Za-z]?\d{6,}$/.test(v)) return null;
  if (v.length > 20) return null;
  if (/\d{6,}/.test(v)) return null;
  if (!/[A-Za-z\u4e00-\u9fff]/.test(v)) return null;
  return v;
}

/** Every link in the mail must be HTTPS. A non-HTTPS site URL fails the build. */
function httpsBase(raw: string): string {
  const value = (raw ?? '').trim().replace(/\/+$/, '');
  if (!value) throw new Error('[email] NEXT_PUBLIC_SITE_URL is required');
  if (!/^https:\/\//i.test(value)) {
    throw new Error(
      `[email] site URL must start with https:// — received "${value}". ` +
        'Plain-HTTP and IP-address links are not allowed in transactional mail.',
    );
  }
  if (/^https?:\/\/\d{1,3}(\.\d{1,3}){3}/i.test(value)) {
    throw new Error(`[email] site URL must be a domain, not an IP — received "${value}"`);
  }
  return value;
}

/**
 * Reads mail configuration. The HTTPS rule is only enforced when a key is
 * present, so local development without mail keys never fails on it.
 */
function config() {
  const apiKey = process.env.RESEND_API_KEY ?? '';
  return {
    apiKey,
    from: process.env.DIGEST_FROM ?? 'Signal Garden <onboarding@resend.dev>',
    contact: process.env.CONTACT_EMAIL ?? 'hello@signalgarden.site',
    siteUrl: apiKey ? httpsBase(process.env.NEXT_PUBLIC_SITE_URL ?? '') : '',
  };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Noto Sans SC',Helvetica,Arial,sans-serif";

/**
 * Transactional welcome mail: confirm the account, then point at one next step.
 * No feature panels, no secondary buttons — one goal per email.
 */
export async function sendWelcomeEmail(input: WelcomeEmailInput): Promise<{ sent: boolean; reason?: string }> {
  // A bad site URL must never block signup: report it and let onboarding finish.
  let apiKey: string, from: string, contact: string, siteUrl: string;
  try {
    ({ apiKey, from, contact, siteUrl } = config());
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : String(err) };
  }
  if (!apiKey) return { sent: false, reason: 'RESEND_API_KEY not set' };

  const name = safeDisplayName(input.username);
  const greeting = name ? `你好，${escapeHtml(name)}` : '欢迎你';
  const greetingText = name ? `你好，${name}` : '欢迎你';

  const garden = `${siteUrl}/my-garden`;
  const today = `${siteUrl}/today`;
  const domain = siteUrl.replace(/^https:\/\//, '');
  const year = new Date().getFullYear();

  const html = `<!doctype html>
<html lang="zh-CN"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<title>你的 Signal Garden 账号已准备好</title>
</head>
<body style="margin:0;padding:0;background:${T.bg};">
<div style="display:none;font-size:1px;color:${T.bg};max-height:0;overflow:hidden;">你的 Signal Garden 账号已准备好。</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${T.bg};">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;">

  <tr><td style="padding:0 0 32px;">
    <img src="${siteUrl}/logo-email.png" width="128" height="21" alt="Signal Garden" style="display:block;border:0;outline:none;text-decoration:none;width:128px;height:21px;">
  </td></tr>

  <tr><td style="height:1px;background:${T.line};line-height:1px;font-size:0;">&nbsp;</td></tr>

  <tr><td style="padding:40px 0 0;font-family:${FONT};">
    <h1 style="margin:0;font-size:28px;line-height:1.35;font-weight:600;color:${T.ink1};">${greeting}</h1>
    <p style="margin:20px 0 0;font-size:16px;line-height:1.75;color:${T.ink2};">
      Signal Garden 每天从全网噪音里筛出值得点开的开发者项目。你的账号已准备好。
    </p>
  </td></tr>

  <tr><td style="padding:32px 0 0;font-family:${FONT};">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="background:${T.ink1};border-radius:8px;">
        <a href="${escapeHtml(garden)}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:14px;font-weight:600;color:${T.bg};text-decoration:none;">进入我的花园</a>
      </td>
    </tr></table>
    <p style="margin:18px 0 0;font-size:13px;line-height:1.7;color:${T.ink2};font-family:${FONT};">
      想先看看？<a href="${escapeHtml(today)}" style="color:${T.ink1};text-decoration:underline;">今日信号</a>
    </p>
  </td></tr>

  <tr><td style="padding:40px 0 0;"><div style="height:1px;background:${T.line};line-height:1px;font-size:0;">&nbsp;</div></td></tr>

  <tr><td style="padding:24px 0 0;font-family:${FONT};">
    <p style="margin:0;font-size:12px;line-height:2;color:${T.ink2};">
      联系邮箱：<a href="mailto:${escapeHtml(contact)}" style="color:${T.ink1};text-decoration:none;">${escapeHtml(contact)}</a><br>
      小红书：<a href="${XHS_URL}" style="color:${T.ink1};text-decoration:none;">95682614775</a><br>
      网站：<a href="${escapeHtml(siteUrl)}" style="color:${T.ink1};text-decoration:none;">${escapeHtml(domain)}</a>
    </p>
    <p style="margin:18px 0 0;font-size:11px;line-height:1.8;color:${T.ink3};">
      你收到这封信，是因为你刚刚注册了 Signal Garden 账号。© ${year} Signal Garden
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;

  const text = `${greetingText}

Signal Garden 每天从全网噪音里筛出值得点开的开发者项目。你的账号已准备好。

进入我的花园：${garden}

想先看看？今日信号：${today}

联系邮箱：${contact}
小红书：95682614775
网站：${domain}

你收到这封信，是因为你刚刚注册了 Signal Garden 账号。
© ${year} Signal Garden`;

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: input.email,
      subject: '你的 Signal Garden 账号已准备好',
      html,
      text,
    });
    if (error) return { sent: false, reason: error.message };
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
