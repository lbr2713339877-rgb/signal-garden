import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { LangSwitch, ThemeSwitch } from "@/components/ui/Lang";
import { LANG } from "@/lib/i18n";

/**
 * The one nav. 56px, glass, no sidebar — this is a narrative product, not a
 * console. Mobile collapses to wordmark + search; the full menu is a sheet.
 */
const LINKS = [
  { href: "/today", zh: "今日", en: "Today" },
  { href: "/explore", zh: "探索", en: "Explore" },
  { href: "/c/ai-tools", zh: "分类", en: "Categories" },
  { href: "/archive", zh: "归档", en: "Archive" },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-[var(--z-nav)] border-b border-[var(--hairline)] bg-[rgba(11,11,13,0.72)] backdrop-blur-[var(--glass-blur)]">
      <div className="mx-auto flex h-[var(--nav-h)] max-w-[var(--container)] items-center gap-8 px-[var(--gutter)]">
        <Link href="/" className="wordmark shrink-0">
          Signal Garden
        </Link>

        <nav className="hidden items-center gap-6 md:flex" aria-label="主导航">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-[length:var(--fs-sm)] text-[var(--ink-3)] transition-colors duration-[var(--d-fast)] hover:text-[var(--ink-1)]"
            >
              <LANG zh={l.zh} en={l.en} />
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          {/* Mobile menu: a native disclosure, so it works without JS and is
              keyboard/screen-reader accessible by default. */}
          <details className="group relative md:hidden">
            <summary className="cursor-pointer list-none text-[length:var(--fs-sm)] text-[var(--ink-3)] hover:text-[var(--ink-1)] [&::-webkit-details-marker]:hidden">
              菜单
            </summary>
            <nav
              aria-label="主导航"
              className="glass-2 absolute right-0 top-8 flex min-w-40 flex-col gap-1 rounded-[var(--r-md)] p-2"
            >
              {LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded-[var(--r-sm)] px-3 py-2 text-[length:var(--fs-sm)] text-[var(--ink-2)] hover:bg-[var(--glass-2)] hover:text-[var(--ink-1)]"
                >
                  <LANG zh={l.zh} en={l.en} />
                </Link>
              ))}
            </nav>
          </details>
          <Link
            href="/search"
            aria-label="搜索"
            className="text-[var(--ink-3)] transition-colors duration-[var(--d-fast)] hover:text-[var(--ink-1)]"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </Link>
          <Link
            href="/saved"
            className="hidden text-[length:var(--fs-sm)] text-[var(--ink-3)] transition-colors duration-[var(--d-fast)] hover:text-[var(--ink-1)] sm:inline"
          >
            <LANG zh="收藏" en="Saved" />
          </Link>
          {/* Language is an attribute write, so this switches the whole page
              instantly with no reload and no partially translated state. */}
          <LangSwitch />
          <ThemeSwitch />
        </div>
      </div>
    </header>
  );
}

/** Ambient category-coloured wash. The only large-area colour on a page. */
export function Ambient({
  color = "var(--c-skill)",
  size = 720,
  className = "",
  opacity = 0.16,
}: {
  color?: string;
  size?: number;
  className?: string;
  opacity?: number;
}) {
  return (
    <div
      aria-hidden
      className={`ambient ${className}`}
      style={{ background: color, width: size, height: size, opacity }}
    />
  );
}

export function PageShell({
  children,
  ambient,
}: {
  children: React.ReactNode;
  ambient?: string;
}) {
  return (
    // overflow-x-clip contains the ambient washes, which deliberately extend
    // past the container. `clip` (unlike `hidden`) creates no scroll
    // container, and is honoured by mobile Safari where body overflow is not.
    <div className="relative min-h-[100dvh] overflow-x-clip bg-[var(--bg-deep)]">
      <Ambient color={ambient} className="-left-40 -top-40" />
      <Nav />
      <div className="relative z-[var(--z-content)]">{children}</div>
    </div>
  );
}

export function Section({
  kicker,
  title,
  note,
  children,
  className = "",
}: {
  kicker?: string;
  title?: string;
  note?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`py-[var(--s-10)] ${className}`}>
      {kicker ? <p className="kicker">{kicker}</p> : null}
      {title ? (
        <h2 className="mt-3 text-[length:var(--fs-h2)] leading-[var(--lh-tight)] tracking-[var(--ls-title)] text-[var(--ink-1)]">
          {title}
        </h2>
      ) : null}
      {note ? (
        <p className="mt-2 max-w-[62ch] text-[length:var(--fs-sm)] text-[var(--ink-3)]">{note}</p>
      ) : null}
      <div className={kicker || title ? "mt-8" : ""}>{children}</div>
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <GlassCard className="p-10 text-center">
      <p className="text-[length:var(--fs-sm)] text-[var(--ink-3)]">{children}</p>
    </GlassCard>
  );
}
