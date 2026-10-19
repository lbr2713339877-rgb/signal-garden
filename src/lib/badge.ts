/** Shields-style "Featured on | Signal Garden" badge for published projects. */

export const BADGE_ORIGIN = "https://signalgarden.site";
const LABEL = "Featured on";
const VALUE = "Signal Garden";

const SEGMENT = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,99})$/;

export type BadgeTheme = "light" | "dark";

export function badgeTheme(value: string | null | undefined): BadgeTheme {
  return value?.trim().toLowerCase() === "dark" ? "dark" : "light";
}

/** GitHub owner/repo segment. Rejects empty, dot, and dot-dot names. */
export function isRepoSegment(value: string): boolean {
  return SEGMENT.test(value) && value !== "." && value !== "..";
}

export function ownerRepo(fullName: string | null | undefined): { owner: string; repo: string } | null {
  if (!fullName) return null;
  const [owner, repo, extra] = fullName.split("/");
  if (!owner || !repo || extra) return null;
  if (!isRepoSegment(owner) || !isRepoSegment(repo)) return null;
  return { owner, repo };
}

export function repoSvgName(segment: string): string | null {
  if (!segment.endsWith(".svg")) return null;
  const repo = segment.slice(0, -".svg".length);
  return isRepoSegment(repo) ? repo : null;
}

function textWidth(text: string): number {
  return [...text].reduce((sum, ch) => sum + (ch === " " ? 4 : 7), 0) + 10;
}

/** Flat two-tone badge. Theme only changes the fills. */
export function featuredBadgeSvg(theme: BadgeTheme = "light"): string {
  const labelWidth = textWidth(LABEL);
  const valueWidth = textWidth(VALUE);
  const width = labelWidth + valueWidth;
  const colors = theme === "dark"
    ? { label: "#111111", value: "#16382a", ink: "#f5f5f5" }
    : { label: "#555555", value: "#2f6f4e", ink: "#ffffff" };
  const labelX = (labelWidth / 2).toFixed(1);
  const valueX = (labelWidth + valueWidth / 2).toFixed(1);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${LABEL}: ${VALUE}">
  <title>${LABEL}: ${VALUE}</title>
  <linearGradient id="sg-shine" x2="0" y2="100%">
    <stop offset="0" stop-color="#fff" stop-opacity=".12"/>
    <stop offset="1" stop-opacity=".12"/>
  </linearGradient>
  <clipPath id="sg-clip"><rect width="${width}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#sg-clip)">
    <rect width="${labelWidth}" height="20" fill="${colors.label}"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${colors.value}"/>
    <rect width="${width}" height="20" fill="url(#sg-shine)"/>
  </g>
  <g fill="${colors.ink}" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${labelX}" y="14">${LABEL}</text>
    <text x="${valueX}" y="14">${VALUE}</text>
  </g>
</svg>
`;
}

/** Markdown a maintainer pastes into a README. Dark adds ?theme=dark. */
export function readmeBadgeMarkdown(input: { owner: string; repo: string; slug: string; theme?: BadgeTheme; origin?: string }): string {
  const origin = (input.origin ?? BADGE_ORIGIN).replace(/\/+$/, "");
  const theme = input.theme ?? "light";
  const svg = `${origin}/badge/${input.owner}/${input.repo}.svg${theme === "dark" ? "?theme=dark" : ""}`;
  const href = `${origin}/p/${input.slug}?utm_source=badge&utm_medium=readme&utm_campaign=featured`;
  return `[![Featured on Signal Garden](${svg})](${href})`;
}
