import { Resend } from 'resend';
import { CONTACT_EMAIL } from './site';
import { emailSiteUrl, renderWelcomeEmail } from './email-template';
import type { EmailLocale } from './email-locale';

export interface WelcomeEmailInput {
  email: string;
  username?: string | null;
  locale?: EmailLocale;
}

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

/** Missing mail keys and bad configuration must never block onboarding. */
export async function sendWelcomeEmail(input: WelcomeEmailInput): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY ?? '';
  if (!apiKey) return { sent: false, reason: 'RESEND_API_KEY not set' };

  try {
    const siteUrl = emailSiteUrl(process.env.NEXT_PUBLIC_SITE_URL ?? '');
    const mail = renderWelcomeEmail({
      siteUrl,
      contact: CONTACT_EMAIL,
      name: safeDisplayName(input.username),
      locale: input.locale,
    });
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: process.env.DIGEST_FROM ?? 'Signal Garden <onboarding@resend.dev>',
      to: input.email,
      ...mail,
    });
    if (error) return { sent: false, reason: error.message };
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
