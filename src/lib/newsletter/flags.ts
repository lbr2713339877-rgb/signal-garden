/** The signup form stays off until this public flag is exactly "true". */
export function newsletterFormEnabled(flag = process.env.NEXT_PUBLIC_NEWSLETTER_ENABLED): boolean {
  return flag === "true";
}
