'use client';

import { useState } from 'react';
import { T, t, type DictKey } from '@/lib/dict';
import { useLang } from '@/components/ui/Lang';
import { useSaved } from '@/lib/use-saved';

/**
 * Save / Follow on a project page.
 *
 * Signed in  -> POST /api/saved writes to the account, and /saved reads it back.
 * Signed out -> the save falls back to this device's localStorage, which is
 *               exactly what /saved reads in anonymous mode. Following has no
 *               local equivalent, so it asks for a sign-in.
 *
 * Before this, the button only ever wrote to the server table while /saved only
 * read localStorage, so a click appeared to do nothing.
 */
export function ProjectActions({ slug }: { slug: string }) {
  const lang = useLang();
  const local = useSaved();
  const [noteKey, setNoteKey] = useState<DictKey | null>(null);
  const [busy, setBusy] = useState<'saved' | 'follow' | null>(null);

  async function act(kind: 'saved' | 'follow') {
    setBusy(kind);
    setNoteKey(null);
    try {
      const res = await fetch(`/api/${kind}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json().catch(() => ({}));

      /* Not signed in: keep the save on this device so it still lands in
         /saved, instead of telling the user it worked and dropping it. */
      if (res.status === 401 || data.requiresLogin) {
        if (kind === 'saved') {
          const wasSaved = local.has(slug);
          local.toggle(slug);
          setNoteKey(wasSaved ? 'pa.unsavedLocal' : 'pa.savedLocal');
        } else {
          setNoteKey('pa.needLogin');
        }
        return;
      }

      if (!res.ok || data.ok === false) {
        setNoteKey(data.limitReached ? 'pa.limit' : 'pa.failed');
        return;
      }

      setNoteKey(
        kind === 'saved'
          ? data.saved ? 'pa.saved' : 'pa.unsaved'
          : data.following ? 'pa.following' : 'pa.unfollowed',
      );
    } catch {
      setNoteKey('pa.failed');
    } finally {
      setBusy(null);
    }
  }

  const btn =
    'system border px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-wait';

  return (
    <div className="mt-8 flex flex-wrap items-center gap-4">
      <button
        type="button"
        onClick={() => act('saved')}
        disabled={busy !== null}
        className={`${btn} border-[var(--glass-2-border)] text-[var(--ink-2)] hover:border-[var(--ink-1)] hover:text-[var(--ink-1)]`}
      >
        <T k="pa.save" as="span" fade={false} />
      </button>
      <button
        type="button"
        onClick={() => act('follow')}
        disabled={busy !== null}
        className={`${btn} border-[var(--glass-1-border)] text-[var(--ink-3)] hover:border-[var(--ink-1)] hover:text-[var(--ink-1)]`}
      >
        <T k="pa.follow" as="span" fade={false} />
      </button>
      {noteKey ? (
        <p className="system text-[var(--ink-4)]">{t(lang, noteKey)}</p>
      ) : null}
    </div>
  );
}
