/** Outside `(site)` so this stays `/weekly/<n>/opengraph-image`. A route-group parent makes Next hash the filename. */
import { notFound } from "next/navigation";
import { renderWeeklyOg } from "@/lib/og/render";
import { publicWeeklyIssues, weeklyIssueByNumber } from "@/lib/weekly-sample";

export const runtime = "nodejs";
export const alt = "Signal Garden 每周精选";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return publicWeeklyIssues().map((issue) => ({ issue: String(issue.number) }));
}

export const dynamicParams = false;

export default async function Image({ params }: { params: Promise<{ issue: string }> }) {
  const { issue: raw } = await params;
  const issue = weeklyIssueByNumber(Number(raw));
  if (!issue) notFound();
  return renderWeeklyOg({
    issue: issue.issue,
    from: issue.from,
    to: issue.to,
    names: issue.items.map((item) => item.name),
  });
}
