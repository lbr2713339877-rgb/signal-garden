import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/supabase/server';
import { ensureProfile, markWelcomeEmailSent, saveInterests } from '@/lib/user';
import { sendWelcomeEmail } from '@/lib/email';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const categories = Array.isArray(body.categories) ? body.categories : [];
  const me = await ensureProfile(user);
  await saveInterests(user.id, categories);

  // One welcome email per account. Missing mail keys never block onboarding.
  if (user.email && !me.profile?.welcomeEmailSentAt) {
    const result = await sendWelcomeEmail({ email: user.email, username: me.profile?.username });
    if (result.sent) await markWelcomeEmailSent(user.id);
  }

  return NextResponse.json({ ok: true });
}
