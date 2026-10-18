import { randomInt, createHash } from 'node:crypto';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { emailVerificationCode } from '@/db/schema';
import { Resend } from 'resend';
import { CONTACT_EMAIL } from './site';
import { emailSiteUrl, renderVerificationEmail } from './email-template';
import type { EmailLocale } from './email-locale';

const TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;

export function normaliseEmail(email: string) {
  return email.trim().toLowerCase();
}

export function hashCode(email: string, code: string) {
  return createHash('sha256').update(`${normaliseEmail(email)}:${code}`).digest('hex');
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normaliseEmail(email));
}

/** True when a code was issued less than 60 seconds ago. */
export async function isCoolingDown(email: string) {
  const d = await db();
  const [last] = await d
    .select({ createdAt: emailVerificationCode.createdAt })
    .from(emailVerificationCode)
    .where(eq(emailVerificationCode.email, normaliseEmail(email)))
    .orderBy(desc(emailVerificationCode.createdAt))
    .limit(1);
  if (!last) return false;
  return Date.now() - new Date(last.createdAt).getTime() < RESEND_COOLDOWN_MS;
}

export async function issueCode(email: string): Promise<string> {
  const d = await db();
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await d.insert(emailVerificationCode).values({
    email: normaliseEmail(email),
    codeHash: hashCode(email, code),
    expiresAt: new Date(Date.now() + TTL_MS),
  });
  return code;
}

export async function verifyCode(email: string, code: string): Promise<boolean> {
  const d = await db();
  const e = normaliseEmail(email);
  const [row] = await d
    .select()
    .from(emailVerificationCode)
    .where(
      and(
        eq(emailVerificationCode.email, e),
        isNull(emailVerificationCode.consumedAt),
        gt(emailVerificationCode.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(emailVerificationCode.createdAt))
    .limit(1);

  if (!row) return false;
  if (row.attempts >= MAX_ATTEMPTS) return false;

  if (row.codeHash !== hashCode(email, code)) {
    await d
      .update(emailVerificationCode)
      .set({ attempts: row.attempts + 1 })
      .where(eq(emailVerificationCode.id, row.id));
    return false;
  }

  await d
    .update(emailVerificationCode)
    .set({ consumedAt: new Date() })
    .where(eq(emailVerificationCode.id, row.id));
  return true;
}

export async function sendVerificationEmail(email: string, code: string, locale: EmailLocale = 'zh') {
  const apiKey = process.env.RESEND_API_KEY ?? '';
  const from = process.env.DIGEST_FROM ?? 'Signal Garden <onboarding@resend.dev>';
  if (!apiKey) return { sent: false, reason: 'RESEND_API_KEY not set' };

  try {
    const siteUrl = emailSiteUrl(process.env.NEXT_PUBLIC_SITE_URL ?? '');
    const mail = renderVerificationEmail({ siteUrl, contact: CONTACT_EMAIL, code, locale });
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({ from, to: email, ...mail });
    if (error) return { sent: false, reason: error.message };
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
