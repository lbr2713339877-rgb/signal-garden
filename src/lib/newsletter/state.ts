export const NEWSLETTER_STATUSES = ["pending", "active", "unsubscribed", "bounced", "complained"] as const;
export type NewsletterStatus = (typeof NEWSLETTER_STATUSES)[number];

export type SubscribeAction = "create" | "refresh" | "ignore" | "blocked";
export type ConfirmOutcome = "confirmed" | "already" | "expired" | "rejected";
export type UnsubscribeOutcome = "unsubscribed" | "already" | "suppressed";
export type DeliveryEvent = "hard_bounce" | "complaint" | "delivered" | "failed" | "soft_bounce";

/** What a new signup attempt does to an existing row. Active addresses are a silent no-op. */
export function subscribeAction(status: NewsletterStatus | null): SubscribeAction {
  if (status === null) return "create";
  if (status === "pending" || status === "unsubscribed") return "refresh";
  if (status === "active") return "ignore";
  return "blocked";
}

/**
 * Confirmation changes pending → active only. Scanners that GET the link
 * never call this; the page button does.
 */
export function confirmOutcome(status: NewsletterStatus, expired: boolean): ConfirmOutcome {
  if (status === "active") return "already";
  if (status !== "pending") return "rejected";
  return expired ? "expired" : "confirmed";
}

/** Bounced and complained stay suppressed so a later form post cannot revive them. */
export function unsubscribeOutcome(status: NewsletterStatus): UnsubscribeOutcome {
  if (status === "unsubscribed") return "already";
  if (status === "bounced" || status === "complained") return "suppressed";
  return "unsubscribed";
}

export function afterDeliveryEvent(current: NewsletterStatus, event: DeliveryEvent): NewsletterStatus {
  if (event === "delivered" || event === "failed" || event === "soft_bounce") return current;
  if (event === "complaint" || current === "complained") return "complained";
  return "bounced";
}

export function sendStatusAfterEvent(event: DeliveryEvent): "sent" | "failed" | "bounced" | null {
  if (event === "delivered") return "sent";
  if (event === "failed") return "failed";
  if (event === "hard_bounce") return "bounced";
  return null;
}

export function classifyBounce(type: string | undefined): "hard_bounce" | "soft_bounce" {
  const value = (type ?? "").trim().toLowerCase();
  if (value === "temporary" || value === "transient" || value === "soft") return "soft_bounce";
  return "hard_bounce";
}

export type EditionSkip = "ok" | "wrong_date" | "short";

export function editionSendDecision(input: {
  editionDate: string;
  isPrevious: boolean;
  count: number;
  today: string;
  limit: number;
}): EditionSkip {
  if (input.isPrevious || input.editionDate !== input.today) return "wrong_date";
  if (input.count < input.limit) return "short";
  return "ok";
}
