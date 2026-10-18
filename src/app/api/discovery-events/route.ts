import { NextResponse } from 'next/server';
import { parseDiscoveryEvents } from '@/lib/discovery-metrics';
import { recordDiscoveryEvents } from '@/db/queries/discovery-metrics';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  // Next can normalize the request URL to localhost behind its server/proxy.
  // The public Host header is the authority the browser actually visited.
  const origin = request.headers.get('origin');
  try {
    const source = new URL(origin ?? '');
    if (!['http:', 'https:'].includes(source.protocol) || source.host !== request.headers.get('host')) return new NextResponse(null, { status: 403 });
  } catch { return new NextResponse(null, { status: 403 }); }
  const text = await request.text();
  if (text.length > 8192) return new NextResponse(null, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(text); } catch { return new NextResponse(null, { status: 400 }); }
  const events = parseDiscoveryEvents(body);
  if (!events) return new NextResponse(null, { status: 400 });
  try {
    await recordDiscoveryEvents(events);
    return new NextResponse(null, { status: 204 });
  } catch {
    // Analytics must never interrupt discovery or reveal database diagnostics.
    return new NextResponse(null, { status: 503 });
  }
}
