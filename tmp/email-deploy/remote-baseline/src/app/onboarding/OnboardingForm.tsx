'use client';

import { useState } from 'react';
import { T } from '@/lib/dict';
import { LangSwitch } from '@/components/ui/Lang';

export function OnboardingForm({ options, selected }: { options: string[]; selected: string[] }) {
  const [picked, setPicked] = useState<string[]>(selected);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch('/api/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categories: picked }),
    });
    window.location.href = '/my-garden';
  }

  return (
    <section className="mx-auto max-w-[900px]">
      <div className="flex items-center justify-between">
        <T k="ob.kicker" as="p" className="system text-[var(--ink-4)]" fade={false} />
        <LangSwitch />
      </div>
      <T k="ob.title" as="h1" className="display-xl mt-6 max-w-[9ch]" />
      <T k="ob.body" as="p" className="body mt-6 max-w-[52ch] text-[var(--ink-2)]" />

      <div className="mt-12 flex flex-wrap gap-3">
        {options.map((o) => {
          const on = picked.includes(o);
          return (
            <button
              key={o}
              type="button"
              onClick={() => setPicked((p) => (on ? p.filter((x) => x !== o) : [...p, o]))}
              className="system border px-4 py-2 transition-colors"
              style={{
                borderColor: on ? 'var(--ink-1)' : 'var(--glass-2-border)',
                color: on ? 'var(--ink-1)' : 'var(--ink-3)',
                background: on ? 'var(--glass-2)' : 'transparent',
              }}
            >
              {o}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={save}
        disabled={saving || picked.length === 0}
        className="system mt-12 border border-[var(--glass-2-border)] px-6 py-3 text-[var(--ink-1)] hover:border-[var(--ink-1)] disabled:opacity-40"
      >
        <T k={saving ? 'ob.saving' : 'ob.continue'} as="span" fade={false} />
      </button>
    </section>
  );
}
