/**
 * Live/dry-run decision for scripts/newsletter-weekly.tsx.
 *
 * Dry-run returns before any send or delivery query and is not date-limited.
 * Live `--canary` sends only the preferred canary. Live `--all` and live
 * `--real` both refuse unless `issue.to` is today's signal date, including
 * when queued or failed ledger rows exist. Real recipients also require this
 * edition's canary to be delivered.
 *
 * Overlapping sends are stopped by the durable newsletter_send claim, not by
 * a session advisory lock and not by provider idempotency.
 */
import {
  planWeeklyAllSend,
  weeklySendBlocker,
  type WeeklyAllPlan,
  type WeeklyCliMode,
} from "./weekly-lock";
import type { WeeklyEditionSendRow } from "./canary-gate";

export type WeeklyDisposition =
  | { action: "dry-run"; exitCode: 0; allPlan: WeeklyAllPlan }
  | { action: "refused"; exitCode: number; reason: string; allPlan: WeeklyAllPlan }
  | { action: "noop"; exitCode: 0; reason: string; allPlan: WeeklyAllPlan }
  | { action: "send"; mode: "canary" | "real" | "all"; exitCode: 0; allPlan: WeeklyAllPlan; plannedIds: readonly string[] };

export function weeklySendDisposition(input: {
  mode: WeeklyCliMode;
  dryRun: boolean;
  editionDate: string;
  today: string;
  eligibleIds: readonly string[];
  ledger: readonly WeeklyEditionSendRow[];
  weeklyEnabled: boolean;
  sendMode: "mock" | "live";
  unsubSecret?: string;
}): WeeklyDisposition {
  const allPlan = planWeeklyAllSend({
    editionDate: input.editionDate,
    today: input.today,
    eligibleIds: input.eligibleIds,
    rows: input.ledger,
  });
  if (input.dryRun || input.mode === "dry-run") return { action: "dry-run", exitCode: 0, allPlan };
  const blocker = weeklySendBlocker({
    dryRun: false,
    weeklyEnabled: input.weeklyEnabled,
    sendMode: input.sendMode,
    unsubSecret: input.unsubSecret,
  });
  if (blocker) return { action: "refused", exitCode: 2, reason: blocker, allPlan };
  if ((input.mode === "all" || input.mode === "real") && input.editionDate !== input.today) {
    return { action: "refused", exitCode: 7, reason: "edition-not-due", allPlan };
  }
  if (input.mode === "all" && allPlan.action === "noop" && allPlan.reason === "reconciliation-held") {
    return { action: "refused", exitCode: 7, reason: "reconciliation-held", allPlan };
  }
  if (input.mode === "all" && allPlan.action === "noop") {
    return { action: "noop", exitCode: 0, reason: allPlan.reason, allPlan };
  }
  if ((input.mode === "all" || input.mode === "real") && input.ledger.some((row) => row.status === "sent" && !row.resendMessageId?.trim() && input.eligibleIds.includes(row.subscriberId))) {
    return { action: "refused", exitCode: 7, reason: "reconciliation-held", allPlan };
  }
  return {
    action: "send",
    mode: input.mode,
    exitCode: 0,
    allPlan,
    plannedIds: allPlan.action === "send" ? allPlan.subscriberIds : [],
  };
}

export async function runWeeklySnapshot(input: {
  mode: WeeklyCliMode;
  dryRun: boolean;
  editionDate: string;
  today: string;
  eligibleIds: readonly string[];
  ledger: readonly WeeklyEditionSendRow[];
  weeklyEnabled: boolean;
  sendMode: "mock" | "live";
  unsubSecret?: string;
  /** Invoked only for a live `--real` or `--all` send. Dry-run never calls it. */
  liveSend: (args: { mode: "canary" | "real" | "all"; plannedIds: readonly string[]; plan: WeeklyAllPlan }) => Promise<{ exitCode: number }>;
}): Promise<{ exitCode: number; phase: WeeklyDisposition["action"]; reason?: string; allPlan: WeeklyAllPlan }> {
  const disposition = weeklySendDisposition(input);
  if (disposition.action !== "send") {
    return {
      exitCode: disposition.exitCode,
      phase: disposition.action,
      reason: "reason" in disposition ? disposition.reason : undefined,
      allPlan: disposition.allPlan,
    };
  }
  const sent = await input.liveSend({
    mode: disposition.mode,
    plannedIds: disposition.plannedIds,
    plan: disposition.allPlan,
  });
  return { exitCode: sent.exitCode, phase: "send", allPlan: disposition.allPlan };
}
