import { randomInt, createHash } from 'node:crypto';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { emailVerificationCode } from '@/db/schema';
import { Resend } from 'resend';

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

export async function sendVerificationEmail(email: string, code: string) {
  const apiKey = process.env.RESEND_API_KEY ?? '';
  const from = process.env.DIGEST_FROM ?? 'Signal Garden <onboarding@resend.dev>';
  if (!apiKey) return { sent: false, reason: 'RESEND_API_KEY not set' };

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: `${code} 是你的 Signal Garden 验证码`,
    text: `你的 Signal Garden 验证码是 ${code}，10 分钟内有效。如果不是你本人操作，请忽略这封邮件。`,
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Noto Sans SC',sans-serif;background:#050505;color:#f5f5f2;padding:40px 24px">
      <div style="max-width:520px;margin:0 auto">
        <div style="font-size:12px;letter-spacing:.18em;color:#77777e">SIGNAL GARDEN</div>
        <p style="margin:26px 0 8px;color:#b8b8bd;font-size:15px">你的验证码是</p>
        <p style="margin:0;font-size:40px;letter-spacing:.12em;font-weight:600">${code}</p>
        <p style="margin:22px 0 0;color:#77777e;font-size:13px">10 分钟内有效。如果不是你本人操作，请忽略这封邮件。</p>
      </div>
    </div>`,
  });
  if (error) return { sent: false, reason: error.message };
  return { sent: true };
}
