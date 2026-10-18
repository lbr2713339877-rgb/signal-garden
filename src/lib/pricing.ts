/**
 * Public pricing constants.
 *
 * The Pro plan is anchored in USD because checkout is handled by Dodo Payments
 * (Merchant of Record) and most of our audience pays in USD. The CNY figure is
 * a display-equivalent for the zh locale and should track the USD anchor.
 *
 * TODO: keep PRO_PRICE_USD in sync with the Dodo Price ID before purchases
 * open. V1 shows this price for review only and does not expose a working
 * checkout.
 */
export const PRO_PRICE_USD = 5.99;

/** Display-equivalent in CNY for the zh locale (≈ 39 at 1 USD ≈ 6.6 CNY). */
export const PRO_PRICE_CNY = 39;
