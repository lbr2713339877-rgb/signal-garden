import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isValidEmail, normaliseEmail, verifyCode } from '@/lib/email-code';

export const runtime = 'nodejs';

/**
 * Errors carry a stable `code` so the client can localize them; `error` stays
 * as a Chinese fallback for callers that do not know the codes.
 */
function fail(code: string, error: string, status: number) {
  return NextResponse.json({ ok: false, code, error }, { status });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? normaliseEmail(body.email) : '';
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const confirm = typeof body.confirm === 'string' ? body.confirm : '';

  if (!isValidEmail(email)) {
    return fail('INVALID_EMAIL', '请输入有效的邮箱地址。', 400);
  }
  if (!/^\d{6}$/.test(code)) {
    return fail('CODE_FORMAT', '验证码应为 6 位数字。', 400);
  }
  if (password.length < 8 || password.length > 20) {
    return fail('PASSWORD_LENGTH', '密码需要 8–20 位。', 400);
  }
  if (password !== confirm) {
    return fail('PASSWORD_MISMATCH', '两次输入的密码不一致。', 400);
  }

  const ok = await verifyCode(email, code);
  if (!ok) {
    return fail('CODE_INVALID', '验证码错误或已过期。', 400);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const adminKey = serviceKey || anon;
  if (!url || !adminKey) {
    return fail('NOT_CONFIGURED', '服务未配置。', 500);
  }

  const supabase = createClient(url, adminKey, { auth: { persistSession: false } });
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    if (!/already|registered|exists/i.test(error.message)) {
      return fail('SIGNUP_FAILED', error.message, 400);
    }
    // The address already exists. If it was never confirmed (a leftover from an
    // earlier half-finished signup) the caller just proved ownership with the
    // email code, so finish that account instead of blocking them.
    const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = list?.users.find((u) => u.email?.toLowerCase() === email);
    if (!existing || existing.email_confirmed_at) {
      return fail('EMAIL_TAKEN', '这个邮箱已经注册过了，请直接登录。', 400);
    }
    const { error: upErr } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (upErr) return fail('SIGNUP_FAILED', upErr.message, 400);
    return NextResponse.json({ ok: true, userId: existing.id });
  }

  return NextResponse.json({ ok: true, userId: data.user?.id ?? null });
}
