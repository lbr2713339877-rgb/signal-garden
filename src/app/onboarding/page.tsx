import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/supabase/server';
import { getProfile, INTEREST_OPTIONS } from '@/lib/user';
import { OnboardingForm } from './OnboardingForm';

export const revalidate = 0;

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const me = await getProfile(user.id);
  return (
    <main className="v3-root v3-root min-h-[100dvh] bg-[var(--bg-void)] px-[var(--gutter)] py-20">
      <OnboardingForm options={[...INTEREST_OPTIONS]} selected={me.interests} />
    </main>
  );
}
