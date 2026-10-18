import { cn } from "@/lib/utils";

/**
 * The one card primitive. Everything that looks like a surface uses this.
 *
 * Rules it enforces:
 *   - one of the three sanctioned glass levels, never a custom opacity
 *   - 10px radius (the card default), never larger than 14px
 *   - optional category theming, which sets --cat/--cat-rgb for descendants
 *
 * `lift` adds the hover behaviour: 8px rise, category-tinted edge, brighter
 * glass. It is a CSS transition on purpose — no JS, and reduced-motion keeps
 * the colour feedback while dropping the movement.
 */
export function GlassCard({
  children,
  className,
  level = 1,
  category,
  lift = false,
  radius = "md",
  as: Tag = "div",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  level?: 1 | 2 | 3;
  category?: string | null;
  lift?: boolean;
  radius?: "sm" | "md" | "lg";
  as?: "div" | "article" | "section" | "li" | "button" | "a";
  style?: React.CSSProperties;
}) {
  const glass = level === 1 ? "glass" : level === 2 ? "glass-2" : "glass-3";
  const r =
    radius === "sm" ? "rounded-[var(--r-sm)]" : radius === "lg"
      ? "rounded-[var(--r-lg)]"
      : "rounded-[var(--r-md)]";

  return (
    <Tag
      style={style}
      data-category={category ?? undefined}
      className={cn(
        glass,
        r,
        lift && "card-lift",
        // A button-intended card must not inherit the browser's default styles.
        Tag === "button" && "cursor-pointer text-left",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
