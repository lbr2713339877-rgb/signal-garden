"use client";

import { useState } from "react";
import { T } from "@/lib/dict";
import { trackEvent } from "@/components/analytics/track";
import { readmeBadgeMarkdown, type BadgeTheme } from "@/lib/badge";

export function ReadmeBadge({
  owner,
  repo,
  slug,
  origin,
}: {
  owner: string;
  repo: string;
  slug: string;
  origin: string;
}) {
  const [theme, setTheme] = useState<BadgeTheme>("light");
  const [copied, setCopied] = useState(false);
  const src = `/badge/${owner}/${repo}.svg${theme === "dark" ? "?theme=dark" : ""}`;

  async function copy() {
    const markdown = readmeBadgeMarkdown({ owner, repo, slug, theme, origin });
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      trackEvent("badge_copy", { repo: `${owner}/${repo}`, theme });
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
      <img src={src} alt="Featured on Signal Garden" width={186} height={20} />
      <button
        type="button"
        onClick={copy}
        className="body inline-flex items-center gap-2 border-b border-[var(--glass-2-border)] pb-1 text-[var(--ink-1)] transition-colors duration-[var(--d-micro)] hover:border-[var(--ink-1)]"
      >
        <T k={copied ? "badge.copied" : "badge.copy"} as="span" fade={false} />
      </button>
      <div className="flex items-center gap-3" role="group">
        <T k="badge.theme" as="span" className="data text-[var(--ink-3)]" fade={false} />
        <button type="button" aria-pressed={theme === "light"} onClick={() => { setTheme("light"); setCopied(false); }} className="data text-[var(--ink-2)] aria-pressed:text-[var(--ink-1)]">
          <T k="badge.light" as="span" fade={false} />
        </button>
        <button type="button" aria-pressed={theme === "dark"} onClick={() => { setTheme("dark"); setCopied(false); }} className="data text-[var(--ink-2)] aria-pressed:text-[var(--ink-1)]">
          <T k="badge.dark" as="span" fade={false} />
        </button>
      </div>
    </div>
  );
}
