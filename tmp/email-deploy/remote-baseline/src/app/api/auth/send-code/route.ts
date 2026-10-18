import { NextResponse } from 'next/server';
import { isCoolingDown, isValidEmail, issueCode, normaliseEmail, sendVerificationEmail } from '@/lib/email-code';

export const runtime = 'nodejs';

/**
 * Errors carry a stable `code` so the client can localize them. The Chinese
 * `error` string is kept as a human-readable fallback for older clients.
 */
function fail(code: string, error: string, status: number) {
  return NextResponse.json({ ok: false, code, error }, { status });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? normaliseEmail(body.email) : '';
  if (!isValidEmail(email)) {
    return fail('INVALID_EMAIL', '请输入有效的邮箱地址。', 400);
  }

  if (await isCoolingDown(email)) {
    return fail('COOLDOWN', '验证码刚发过，请 60 秒后再试。', 429);
  }

  const code = await issueCode(email);
  const result = await sendVerificationEmail(email, code);

  if (!result.sent) {
    return fail('SEND_FAILED', result.reason ?? '邮件发送失败。', 500);
  }
  return NextResponse.json({ ok: true });
}
