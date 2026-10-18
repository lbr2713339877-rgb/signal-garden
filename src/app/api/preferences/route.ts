import { NextResponse } from 'next/server';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { ensureProfile, markWelcomeEmailSent, saveInterests } from '@/lib/user';
import { sendWelcomeEmail } from '@/lib/email';
import { resolveEmailLocale } from '@/lib/email-locale';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const categories = Array.isArray(body.categories) ? body.categories : [];
  const locale = resolveEmailLocale(body.locale, user.user_metadata?.locale, request.headers.get('accept-language'));
  const me = await ensureProfile(user);
  await saveInterests(user.id, categories);

  // Persist the onboarding choice for later account mail, including OAuth users.
  // A metadata-service failure must not block onboarding or the welcome mail.
  if (user.user_metadata?.locale !== locale) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.updateUser({ data: { locale } });
      if (error) console.error('[preferences] could not save email locale:', error.message);
    } catch (error) {
      console.error('[preferences] could not save email locale:', error instanceof Error ? error.message : String(error));
    }
  }

  // One welcome email per account. Missing mail keys never block onboarding.
  if (user.email && !me.profile?.welcomeEmailSentAt) {
    const result = await sendWelcomeEmail({ email: user.email, username: me.profile?.username, locale });
    if (result.sent) await markWelcomeEmailSent(user.id);
  }

  return NextResponse.json({ ok: true });
}
