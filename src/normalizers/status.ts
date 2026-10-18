import type { ProjectStatus } from "@/db/schema";

/**
 * Activity-based status from repository metadata alone.
 *
 * Growth statuses (快速增长 / 增长放缓 / 维护不稳定) need star history, so the
 * Phase 2 score job assigns them. Until then a repo is only ever archived,
 * stale, new, or steady — nothing here claims growth it cannot see.
 */
export function deriveStatus(meta: {
  isArchived: boolean;
  createdAt: string | Date | null;
  pushedAt: string | Date | null;
}): ProjectStatus {
  if (meta.isArchived) return "archived";
  const now = Date.now();
  const days = (d: string | Date | null) => (d ? (now - new Date(d).getTime()) / 86_400_000 : Infinity);
  if (days(meta.pushedAt) > 90) return "stale";
  if (days(meta.createdAt) <= 14) return "new";
  return "steady";
}
