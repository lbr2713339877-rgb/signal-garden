import { inArray, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { discoveryMetric, project } from '@/db/schema';
import { signalDate } from '@/lib/day';
import type { DiscoveryEvent } from '@/lib/discovery-metrics';

export async function recordDiscoveryEvents(events: DiscoveryEvent[]) {
  const d = await db();
  const slugs = events.filter((event) => event.placement !== 'task').map((event) => event.target);
  const valid = new Set(slugs.length ? (await d.select({ slug: project.slug }).from(project)
    .where(inArray(project.slug, slugs))).map((p) => p.slug) : []);
  const accepted = events.filter((event) => event.placement === 'task' || valid.has(event.target));
  if (!accepted.length) return;
  await d.insert(discoveryMetric).values(accepted.map((event) => ({ ...event, day: signalDate(), count: 1 })))
    .onConflictDoUpdate({ target: [discoveryMetric.day, discoveryMetric.event, discoveryMetric.placement, discoveryMetric.target],
      set: { count: sql`${discoveryMetric.count} + 1` } });
}
