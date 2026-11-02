/**
 * Copy and send plan for the Monday curated weekly.
 *
 * The message is the latest frozen issue in src/lib/weekly-sample.ts
 * (Top 10 + editor pick). It is not the daily #1-then-#2 sampler.
 */
import {
  latestPublishedWeeklyIssue,
  weeklyIssueByNumber,
  type WeeklyIssue,
} from "@/lib/weekly-sample";

export const WEEKLY_LOCK_PREHEADER =
  "每周一 1 封：本周热度最高的 10 个 GitHub 新项目。免费，随时退订。";

/** Pause between live Resend calls. Matches the issue 2/3 one-offs. */
export const WEEKLY_LIVE_SEND_GAP_MS = 500;

export const WEEKLY_CANARY_PREFERRED = "raynlee@mail.grokbot.com";

export type WeeklyCliMode = "dry-run" | "canary" | "real" | "all";

export type WeeklyCli =
  | { ok: true; mode: WeeklyCliMode; dryRun: boolean }
  | { ok: false; error: string };

const WEEKLY_CLI_FLAGS = ["--dry-run", "--canary", "--real", "--all"] as const;

/** One send mode. `--dry-run` alone prints the plan. It can also prefix a mode. */
export function parseWeeklyCli(argv: readonly string[]): WeeklyCli {
  const unknown = argv.filter((arg) => !WEEKLY_CLI_FLAGS.includes(arg as (typeof WEEKLY_CLI_FLAGS)[number]));
  if (unknown.length > 0) return { ok: false, error: `unknown argument: ${unknown.join(" ")}` };
  const selected = (["--canary", "--real", "--all"] as const).filter((flag) => argv.includes(flag));
  if (selected.length > 1) return { ok: false, error: "pass only one of --canary, --real, --all" };
  const dryRun = argv.includes("--dry-run");
  if (selected.length === 0) {
    if (!dryRun) return { ok: false, error: "usage: --dry-run | --canary | --real | --all [--dry-run]" };
    return { ok: true, mode: "dry-run", dryRun: true };
  }
  const flag = selected[0];
  const mode = flag.slice(2) as Exclude<WeeklyCliMode, "dry-run">;
  return { ok: true, mode, dryRun };
}

/** A row in one of these states was already delivered or must not be retried. */
export const WEEKLY_SEND_TERMINAL = ["sent", "bounced"] as const;

export function weeklyMonthDay(iso: string): string {
  const [, month, day] = iso.split("-");
  if (!month || !day) return iso;
  return `${Number(month)}/${day}`;
}

/** `10/27–11/02`, with an en dash, matching the sent subjects. */
export function weeklyWindowLabel(from: string, to: string): string {
  return `${weeklyMonthDay(from)}\u2013${weeklyMonthDay(to)}`;
}

export function weeklyLockSubject(issue: Pick<WeeklyIssue, "issue" | "from" | "to">): string {
  return `Signal Garden 周刊 #${issue.issue}\uFF5C本周热度最高的 10 个 GitHub 新项目\uFF08${weeklyWindowLabel(issue.from, issue.to)}\uFF09`;
}

/** Drop the `**emphasis**` markers the public page uses. */
export function weeklyPlainCopy(text: string): string {
  return text.replaceAll("**", "");
}

export function weeklyMailCampaign(issue: number): string {
  return `weekly-${issue}`;
}

export function weeklyIdempotencyKey(issue: number, editionDate: string, subscriberId: string): string {
  return `newsletter-weekly-${issue}/${editionDate}/${subscriberId}`;
}

export function weeklyAbsoluteUrl(siteUrl: string, href: string): string {
  const base = siteUrl.endsWith("/") ? siteUrl : `${siteUrl}/`;
  return new URL(href, base).href;
}

export function weeklyWebUrl(siteUrl: string, issue: number): string {
  const url = new URL(weeklyAbsoluteUrl(siteUrl, `/weekly/${issue}`));
  url.searchParams.set("utm_source", "email");
  url.searchParams.set("utm_medium", "weekly");
  url.searchParams.set("utm_campaign", weeklyMailCampaign(issue));
  return url.href;
}

export function weeklyTodayUrl(siteUrl: string): string {
  const url = new URL(weeklyAbsoluteUrl(siteUrl, "/today"));
  url.searchParams.set("utm_source", "email");
  return url.href;
}

export function weeklyRssUrl(siteUrl: string): string {
  return weeklyAbsoluteUrl(siteUrl, "/feed.xml");
}

/** Frozen max-heat issue: Top 10 with heat, an editor note, and an editor pick. */
export function isCuratedWeeklyIssue(issue: WeeklyIssue): boolean {
  return (
    issue.items.length === 10 &&
    issue.items.every((item) => item.heat != null && Boolean(item.peakDate) && Boolean(item.starsLine)) &&
    Boolean(issue.editorNote?.zh && issue.editorNote.en) &&
    Boolean(issue.editorPick)
  );
}

/** Latest published issue, when it is a curated lock. Issue 1 is not. */
export function publishedWeeklyMailIssue(): WeeklyIssue | null {
  const issue = weeklyIssueByNumber(latestPublishedWeeklyIssue());
  if (!issue || !isCuratedWeeklyIssue(issue)) return null;
  return issue;
}

export type WeeklyAudienceKind = "canary" | "real" | "excluded";

export function classifyWeeklyRecipient(input: {
  email: string;
  source: string | null;
  utmSource: string | null;
}): WeeklyAudienceKind {
  const email = input.email.trim().toLowerCase();
  if (email.endsWith("@mail.grokbot.com")) return "canary";
  if (email.includes("lbr2713339877")) return "excluded";
  if (email.endsWith("@resend.dev")) return "excluded";
  if ((input.source ?? "").toLowerCase().includes("test")) return "excluded";
  if ((input.utmSource ?? "").toLowerCase() === "team-test") return "excluded";
  return "real";
}

/** Pending, unconfirmed, and address-less rows never enter a send. */
export function isConfirmedActive(status: string, confirmedAt: Date | string | null, email: string | null): boolean {
  return status === "active" && confirmedAt != null && Boolean(email && email.trim());
}

export interface WeeklyAudienceRow {
  id: string;
  email: string;
  source: string | null;
  utmSource: string | null;
}

export function splitWeeklyAudience(rows: readonly WeeklyAudienceRow[]): {
  canaries: WeeklyAudienceRow[];
  reals: WeeklyAudienceRow[];
  excluded: WeeklyAudienceRow[];
} {
  const canaries: WeeklyAudienceRow[] = [];
  const reals: WeeklyAudienceRow[] = [];
  const excluded: WeeklyAudienceRow[] = [];
  for (const row of rows) {
    const kind = classifyWeeklyRecipient(row);
    if (kind === "canary") canaries.push(row);
    else if (kind === "real") reals.push(row);
    else excluded.push(row);
  }
  canaries.sort((a, b) => {
    const rank = (email: string) => (email.toLowerCase() === WEEKLY_CANARY_PREFERRED ? 0 : 1);
    return rank(a.email) - rank(b.email);
  });
  return { canaries, reals, excluded };
}

export function preferredCanary(canaries: readonly WeeklyAudienceRow[]): WeeklyAudienceRow | undefined {
  return canaries.find((row) => row.email.toLowerCase() === WEEKLY_CANARY_PREFERRED) ?? canaries[0];
}

export function weeklySendBlocker(input: {
  dryRun: boolean;
  weeklyEnabled: boolean;
  sendMode: "mock" | "live";
  unsubSecret?: string;
}): string | null {
  if (input.dryRun) return null;
  if (!input.weeklyEnabled) return "NEWSLETTER_WEEKLY_ENABLED is not true";
  if (input.sendMode !== "live") return "NEWSLETTER_SEND_MODE is not live";
  if (!input.unsubSecret?.trim()) return "NEWSLETTER_UNSUB_SECRET is required when NEWSLETTER_SEND_MODE=live";
  return null;
}

export interface WeeklySendRow {
  subscriberId: string;
  status: string;
}

export type WeeklyAllPlan =
  | { action: "noop"; reason: "no-recipients" | "already-mailed" | "edition-not-due" }
  | { action: "send"; subscriberIds: string[] };

/**
 * Cron `--all` plan.
 *
 * Sends on the edition day (`issue.to` in Asia/Singapore) to anyone not already
 * sent or bounced. A later Monday does not start a new blast and does not pick
 * up subscribers who joined after the edition. It only retries rows left
 * queued or failed. Sent and bounced rows are never mailed again.
 */
export function planWeeklyAllSend(input: {
  editionDate: string;
  today: string;
  eligibleIds: readonly string[];
  rows: readonly WeeklySendRow[];
}): WeeklyAllPlan {
  if (input.eligibleIds.length === 0) return { action: "noop", reason: "no-recipients" };
  const statusById = new Map(input.rows.map((row) => [row.subscriberId, row.status]));
  const due = input.editionDate === input.today;
  const subscriberIds: string[] = [];
  for (const id of input.eligibleIds) {
    const status = statusById.get(id);
    if (status === "sent" || status === "bounced") continue;
    if (!due && status == null) continue;
    subscriberIds.push(id);
  }
  if (subscriberIds.length > 0) return { action: "send", subscriberIds };
  const anyRow = input.eligibleIds.some((id) => statusById.has(id));
  if (!due && !anyRow) return { action: "noop", reason: "edition-not-due" };
  return { action: "noop", reason: "already-mailed" };
}
