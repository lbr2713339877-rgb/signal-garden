'use client';

import { useState } from 'react';
import { T } from '@/lib/dict';

const KINDS = [
  { id: 'dead_link', labelKey: 'pg.fb.deadLink' },
  { id: 'wrong_category', labelKey: 'pg.fb.wrongCat' },
  { id: 'inaccurate_desc', labelKey: 'pg.fb.inaccurate' },
  { id: 'security_risk', labelKey: 'pg.fb.security' },
  { id: 'unmaintained', labelKey: 'pg.fb.unmaintained' },
] as const;

export function FeedbackForm({ slug }: { slug: string }) {
  const [kind, setKind] = useState<string>('inaccurate_desc');
  const [note, setNote] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, kind, note }),
      });
      setState(res.ok ? 'ok' : 'error');
      if (res.ok) setNote('');
    } catch {
      setState('error');
    }
  }

  return (
    <form onSubmit={submit} className="mt-12 max-w-[62ch]">
      <fieldset className="flex flex-col gap-3">
        <legend className="system text-[var(--ink-4)]">TYPE</legend>
        {KINDS.map((k) => (
          <label
            key={k.id}
            className="flex cursor-pointer items-baseline gap-4 border-t border-[var(--glass-1-border)] py-4"
          >
            <input
              type="radio"
              name="kind"
              value={k.id}
              checked={kind === k.id}
              onChange={() => setKind(k.id)}
            />
            <T k={k.labelKey} as="span" className="body text-[var(--ink-1)]" fade={false} />
          </label>
        ))}
      </fieldset>

      <label className="mt-8 block">
        <T k="pg.fb.note" as="span" className="system text-[var(--ink-4)]" fade={false} />
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={5}
          maxLength={1200}
          className="body mt-3 w-full resize-y border border-[var(--glass-1-border)] bg-[var(--bg-void)] p-4 text-[var(--ink-1)] outline-none focus:border-[var(--ink-3)]"
        />
      </label>

      <div className="mt-6 flex flex-wrap items-center gap-5">
        <button
          type="submit"
          disabled={state === 'sending'}
          className="system border border-[var(--glass-2-border)] px-5 py-3 text-[var(--ink-1)] transition-colors duration-[var(--d-micro)] hover:border-[var(--ink-1)] disabled:opacity-50"
        >
          <T k={state === 'sending' ? 'pg.fb.submitting' : 'pg.fb.submit'} as="span" fade={false} />
        </button>

        {state === 'ok' ? (
          <T k="pg.fb.success" as="p" className="body text-[var(--light-mint)]" />
        ) : null}
        {state === 'error' ? (
          <T k="pg.fb.error" as="p" className="body text-[var(--light-coral)]" />
        ) : null}
      </div>
    </form>
  );
}
