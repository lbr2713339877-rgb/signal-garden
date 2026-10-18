import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { project } from '@/db/schema';
import { getCurrentUser } from '@/lib/supabase/server';
import { ensureProfile, toggleFollowProject } from '@/lib/user';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, requiresLogin: true }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const slug = typeof body.slug === 'string' ? body.slug : '';
  if (!slug) return NextResponse.json({ ok: false }, { status: 400 });
  const d = await db();
  const [p] = await d.select({ id: project.id }).from(project).where(eq(project.slug, slug)).limit(1);
  if (!p) return NextResponse.json({ ok: false }, { status: 404 });
  await ensureProfile(user);
  const result = await toggleFollowProject(user.id, p.id);
  return NextResponse.json({ ok: true, ...result });
}
