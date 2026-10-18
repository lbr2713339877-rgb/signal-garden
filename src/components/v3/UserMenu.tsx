'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { T, type DictKey } from '@/lib/dict';

const MENU: { href: string; k: DictKey }[] = [
  { href: '/my-garden', k: 'nav.myGarden' },
  { href: '/saved', k: 'nav.saved' },
  { href: '/settings', k: 'nav.settings' },
];

export function UserMenu() {
  const [user, setUser] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  async function logout() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } finally {
      window.location.href = '/';
    }
  }

  if (!user) {
    return (
      <Link href="/login" className="system !text-[var(--ink-3)] hover:!text-[var(--ink-1)]">
        <T k="nav.login" as="span" fade={false} />
      </Link>
    );
  }

  const avatar = user.user_metadata?.avatar_url;
  const name = user.user_metadata?.full_name || user.email || 'Account';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-[var(--glass-2-border)] bg-[var(--glass-1)]"
        aria-label="Account menu"
      >
        {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : <span className="system">{String(name)[0]}</span>}
      </button>
      {open ? (
        <div className="glass-2 absolute right-0 top-10 flex min-w-[170px] flex-col p-2">
          {MENU.map(({ href, k }) => (
            <Link key={href} href={href} className="system px-3 py-2 text-[var(--ink-2)] hover:text-[var(--ink-1)]" onClick={() => setOpen(false)}>
              <T k={k} as="span" fade={false} />
            </Link>
          ))}
          <button type="button" onClick={logout} className="system px-3 py-2 text-left text-[var(--ink-4)] hover:text-[var(--ink-1)]">
            <T k="nav.logout" as="span" fade={false} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
