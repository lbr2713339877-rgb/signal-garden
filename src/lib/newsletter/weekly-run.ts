/**
 * Live/dry-run decision for scripts/newsletter-weekly.tsx.
 *
 * Dry-run returns before any send or delivery query. Live `--canary` does not
 * send. Live `--real` also requires this edition's date, so a delivered canary
 * from another day cannot mail real recipients early. `--all` still uses
 * planWeeklyAllSend, which does not pick up recipients with no ledger row on
 * a later day.
 *
 * There is no cross-process send lock and no ledger reset. Resend's SDK sets
 * `Idempotency-Key` from our stable edition/subscriber key and does not dedupe
 * in process. The API names `concurrent_idempotent_requests` and
 * `invalid_idempotent_request` are the provider's responses, not a guarantee
 * this process can make. Two overlapping runs can both observe no stored id
 * and both call send. A provider id that never reaches the ledger can be sent
 * again with the same key. That is not absolute duplicate protection.
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
  | { action: "send"; mode: "real" | "all"; exitCode: 0; allPlan: WeeklyAllPlan; plannedIds: readonly string[] };

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
  if (input.mode === "canary") {
    return { action: "refused", exitCode: 7, reason: "canary-live-disabled", allPlan };
  }
  if (input.mode === "all" && allPlan.action === "noop") {
    return { action: "noop", exitCode: 0, reason: allPlan.reason, allPlan };
  }
  if (input.mode === "real" && input.editionDate !== input.today) {
    return { action: "refused", exitCode: 7, reason: "edition-not-due", allPlan };
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
  liveSend: (args: { mode: "real" | "all"; plannedIds: readonly string[]; plan: WeeklyAllPlan }) => Promise<{ exitCode: number }>;
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
