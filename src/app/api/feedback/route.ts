import { NextResponse } from 'next/server';
import { createFeedback, type FeedbackKind } from '@/db/queries';

export const runtime = 'nodejs';

const KINDS = new Set<FeedbackKind>([
  'dead_link',
  'wrong_category',
  'inaccurate_desc',
  'security_risk',
  'unmaintained',
]);

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const slug = typeof body?.slug === 'string' ? body.slug.trim() : '';
  const kind = typeof body?.kind === 'string' ? body.kind : '';
  const note = typeof body?.note === 'string' ? body.note : null;

  if (!slug) return NextResponse.json({ ok: false, error: 'missing_slug' }, { status: 400 });
  if (!KINDS.has(kind as FeedbackKind)) {
    return NextResponse.json({ ok: false, error: 'invalid_kind' }, { status: 400 });
  }

  const row = await createFeedback({ slug, kind: kind as FeedbackKind, note });
  if (!row) return NextResponse.json({ ok: false, error: 'project_not_found' }, { status: 404 });

  return NextResponse.json({ ok: true, id: row.id, createdAt: row.createdAt });
}
