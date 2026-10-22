/** Outside `(site)` so this stays `/weekly/1/opengraph-image`. A route-group parent makes Next hash the filename. */
import { renderWeeklyOg } from "@/lib/og/render";
import { WEEKLY_ISSUE_1 } from "@/lib/weekly-sample";

export const runtime = "nodejs";
export const alt = "Signal Garden — 第 1 期";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  const issue = WEEKLY_ISSUE_1;
  return renderWeeklyOg({
    issue: issue.issue,
    from: issue.from,
    to: issue.to,
    names: issue.items.map((item) => item.name),
  });
}
