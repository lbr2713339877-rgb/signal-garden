import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/supabase/server';
import { projectIdForSlug } from '@/lib/slug-alias';
import { ensureProfile, toggleFollowProject } from '@/lib/user';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, requiresLogin: true }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const slug = typeof body.slug === 'string' ? body.slug : '';
  if (!slug) return NextResponse.json({ ok: false }, { status: 400 });
  const id = await projectIdForSlug(slug);
  if (!id) return NextResponse.json({ ok: false }, { status: 404 });
  await ensureProfile(user);
  const result = await toggleFollowProject(user.id, id);
  return NextResponse.json({ ok: true, ...result });
}
