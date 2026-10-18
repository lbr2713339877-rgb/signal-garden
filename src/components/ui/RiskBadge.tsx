import { SECURITY_LABEL, SECURITY_LABEL_EN } from "@/lib/categories";
import { LANG } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Security state. Never hidden, never collapsed behind a tab.
 *
 * The four levels map onto fixed colours so a user learns them once:
 *   safe    -> lime   未发现明显风险
 *   review  -> amber  需检查
 *   risk    -> coral  存在风险
 *   unknown -> grey   未知
 */
const TONE: Record<string, { color: string; rgb: string }> = {
  safe: { color: "var(--risk-safe)", rgb: "190, 242, 100" },
  review: { color: "var(--risk-review)", rgb: "253, 186, 116" },
  risk: { color: "var(--risk-high)", rgb: "251, 113, 133" },
  unknown: { color: "var(--risk-unknown)", rgb: "119, 119, 126" },
};

export function RiskBadge({
  level,
  className,
  withLabel = true,
}: {
  level: string | null | undefined;
  className?: string;
  withLabel?: boolean;
}) {
  const key = level && TONE[level] ? level : "unknown";
  const tone = TONE[key];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--r-pill)] border",
        "px-2.5 py-0.5 text-[length:var(--fs-tag)] tracking-[var(--ls-tag)] uppercase",
        className,
      )}
      style={{
        color: tone.color,
        borderColor: `rgba(${tone.rgb}, 0.28)`,
      }}
    >
      <span
        aria-hidden
        className="h-1 w-1 rounded-[var(--r-pill)]"
        style={{ background: tone.color }}
      />
      {withLabel ? <LANG zh={SECURITY_LABEL[key] ?? "未知"} en={SECURITY_LABEL_EN[key] ?? "Unknown"} /> : key}
    </span>
  );
}
