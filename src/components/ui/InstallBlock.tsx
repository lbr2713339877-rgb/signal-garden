"use client";

import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn } from "@/lib/utils";

/**
 * Install commands with copy feedback.
 *
 * On copy: the label switches to "Copied", a highlight sweeps across the block,
 * and both settle back after 2s. Reduced motion keeps the label change and drops
 * the sweep, because the label is the actual feedback.
 */
export function InstallBlock({
  commands,
}: {
  commands: { kind: string; command: string; source: string }[];
}) {
  const [copied, setCopied] = useState<number | null>(null);
  const [active, setActive] = useState(0);

  async function copy(text: string, i: number) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard can be blocked; still give feedback so the click is not silent.
    }
    setCopied(i);
    window.setTimeout(() => setCopied((c) => (c === i ? null : c)), 2000);
  }

  const cmd = commands[active];

  return (
    <div>
      {commands.length > 1 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {commands.map((c, i) => (
            <button
              key={`${c.command}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                "rounded-[var(--r-pill)] border px-3 py-1 text-[length:var(--fs-tag)] uppercase tracking-[var(--ls-tag)] transition-colors duration-[var(--d-fast)]",
                i === active
                  ? "border-[var(--hairline-strong)] text-[var(--ink-1)]"
                  : "border-[var(--hairline)] text-[var(--ink-4)] hover:text-[var(--ink-2)]",
              )}
            >
              {c.kind}
            </button>
          ))}
        </div>
      ) : null}

      <GlassCard className="relative overflow-hidden p-0">
        {copied === active ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 motion-loop"
            style={{
              background:
                "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.07) 50%, transparent 60%)",
              animation: "sg-sweep 400ms var(--e-out)",
            }}
          />
        ) : null}

        <div className="flex items-start gap-4 p-4">
          <pre className="num min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-all text-[length:var(--fs-sm)] text-[var(--ink-1)]">
            {cmd.command}
          </pre>
          <button
            type="button"
            onClick={() => copy(cmd.command, active)}
            className="shrink-0 rounded-[var(--r-sm)] border border-[var(--hairline)] px-3 py-1.5 text-[length:var(--fs-xs)] text-[var(--ink-2)] transition-colors duration-[var(--d-fast)] hover:border-[var(--hairline-strong)] hover:text-[var(--ink-1)]"
          >
            {copied === active ? "Copied to clipboard" : "复制"}
          </button>
        </div>
        <p className="num border-t border-[var(--hairline)] px-4 py-2 text-[length:var(--fs-micro)] text-[var(--ink-4)]">
          来源：{cmd.source}
        </p>
      </GlassCard>

      <style>{`@keyframes sg-sweep { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
        @media (prefers-reduced-motion: reduce) { .motion-loop { animation: none !important; } }`}</style>
    </div>
  );
}
