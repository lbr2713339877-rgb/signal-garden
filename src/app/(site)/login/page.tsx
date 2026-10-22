import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/supabase/server';
import { LoginPanel } from './LoginPanel';

export const metadata: Metadata = { title: 'Sign in · Signal Garden' };
export const revalidate = 0;

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect('/my-garden');
  return (
    <main className="v3-root v3-root min-h-[100dvh] bg-[var(--bg-void)] px-[var(--gutter)] py-20">
      <LoginPanel configured={!!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY} />
    </main>
  );
}
