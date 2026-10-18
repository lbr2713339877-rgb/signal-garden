export const DISCOVERY_PLACEMENTS = ['featured', 'grid', 'task'] as const;
export const DISCOVERY_EVENTS = ['impression', 'click'] as const;
export const DISCOVERY_TASKS = ['website', 'agent', 'video', 'dashboard'] as const;
export interface DiscoveryEvent {
  event: typeof DISCOVERY_EVENTS[number];
  placement: typeof DISCOVERY_PLACEMENTS[number];
  target: string;
}

/** Accept only anonymous homepage counters, never URLs, queries or user IDs. */
export function parseDiscoveryEvents(body: unknown): DiscoveryEvent[] | null {
  if (!Array.isArray(body) || !body.length || body.length > 24) return null;
  const events: DiscoveryEvent[] = [];
  for (const item of body) {
    if (!item || typeof item !== 'object' || Object.keys(item).some((k) => !['event', 'placement', 'target'].includes(k))) return null;
    const { event, placement, target } = item;
    if (!DISCOVERY_EVENTS.includes(event) || !DISCOVERY_PLACEMENTS.includes(placement)
      || typeof target !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,159}$/.test(target)
      || (placement === 'task' && !DISCOVERY_TASKS.includes(target as typeof DISCOVERY_TASKS[number]))) return null;
    events.push({ event, placement, target });
  }
  // One page load can contribute once per card and action, even in a batch.
  return events.filter((event, index) => events.findIndex((candidate) =>
    candidate.event === event.event && candidate.placement === event.placement && candidate.target === event.target) === index);
}
