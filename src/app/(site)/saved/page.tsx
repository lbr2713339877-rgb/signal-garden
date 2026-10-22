/**
 * 收藏（V3）—— /saved
 *
 * 单一入口，两种来源：
 *   - 已登录：读账号里的收藏（/api/saved），跨设备可见
 *   - 未登录：读本机 localStorage
 *
 * 之前这里是「只读 localStorage」，而项目页的 SAVE 只写服务器表，两边不
 * 通，所以点了收藏在 /saved 里什么都看不到。现在项目页在未登录时会写回
 * localStorage，已登录时写账号，这一页按同样的判断读回来。
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { V3Shell } from '@/components/v3/V3Shell';
import { useSaved } from '@/lib/use-saved';
import { T } from '@/lib/dict';

type Item = { slug: string; name?: string | null; fullName?: string | null };
type Mode = 'account' | 'local' | null;

export default function SavedPage() {
  const local = useSaved();
  const [mode, setMode] = useState<Mode>(null);
  const [accountItems, setAccountItems] = useState<Item[]>([]);
  const merged = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/saved');
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        if (data?.requiresLogin) setMode('local');
        else {
          setAccountItems(Array.isArray(data.items) ? data.items : []);
          setMode('account');
        }
      } catch {
        if (alive) setMode('local');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* Anonymous saves made before signing in are copied up once, so they do not
     silently vanish the moment an account exists. Only items the account does
     not already have are posted — POST toggles, so re-posting would un-save. */
  useEffect(() => {
    if (mode !== 'account' || !local.ready || merged.current) return;
    merged.current = true;
    const have = new Set(accountItems.map((i) => i.slug));
    const missing = local.slugs.filter((s) => !have.has(s));
    if (missing.length === 0) {
      if (local.slugs.length) local.clear();
      return;
    }
    (async () => {
      await Promise.all(
        missing.map((slug) =>
          fetch('/api/saved', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug }),
          }),
        ),
      );
      local.clear();
      const res = await fetch('/api/saved');
      const data = await res.json().catch(() => ({}));
      if (Array.isArray(data.items)) setAccountItems(data.items);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, local.ready]);

  const items: Item[] =
    mode === 'account'
      ? accountItems
      : mode === 'local'
        ? local.slugs.map((slug) => ({ slug }))
        : [];

  const ready = mode === 'account' || (mode === 'local' && local.ready);

  async function remove(slug: string) {
    if (mode === 'account') {
      setAccountItems((prev) => prev.filter((i) => i.slug !== slug));
      await fetch('/api/saved', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
    } else {
      local.toggle(slug);
    }
  }

  async function clearAll() {
    if (mode === 'account') {
      const slugs = accountItems.map((i) => i.slug);
      setAccountItems([]);
      await Promise.all(
        slugs.map((slug) =>
          fetch('/api/saved', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug }),
          }),
        ),
      );
    } else {
      local.clear();
    }
  }

  return (
    <V3Shell>
      <div className="mx-auto max-w-[var(--container)] px-[var(--gutter)] pt-28 pb-[var(--section-gap)]">
        <T k="pg.saved.kicker" as="p" className="system" fade={false} />
        <T k="pg.saved.title" as="h1" className="page-title mt-4 max-w-[10ch]" />

        {/* 存储位置说明 —— 用户有权知道数据在哪 */}
        <div
          className="glass-1 mt-12 max-w-[58ch] p-6"
          style={{ filter: 'saturate(0.5) brightness(0.96)' }}
        >
          <T k="pg.saved.where" as="p" className="system" fade={false} />
          <T
            k={mode === 'account' ? 'pg.saved.bodyAccount' : 'pg.saved.bodyLocal'}
            as="p"
            className="body mt-4 text-[var(--ink-2)]"
          />
        </div>

        {!ready ? null : items.length === 0 ? (
          <T
            k="pg.saved.empty"
            as="p"
            className="body mt-16 max-w-[46ch] text-[var(--ink-3)]"
          />
        ) : (
          <>
            <div className="mt-16 flex flex-wrap items-baseline gap-x-8 gap-y-3 border-t border-[var(--glass-1-border)] pt-6">
              <T
                k="pg.saved.count"
                as="span"
                className="data text-[var(--ink-2)]"
                fade={false}
                vars={{ n: items.length }}
              />
              <button
                type="button"
                onClick={clearAll}
                className="data text-[var(--ink-4)] transition-colors duration-[var(--d-micro)] hover:text-[var(--ink-1)]"
              >
                <T k="act.clear" as="span" fade={false} />
              </button>
            </div>

            <ul className="mt-6 flex flex-col">
              {items.map((it, i) => (
                <li key={it.slug}>
                  <div
                    className="v3-row flex items-center gap-6 border-t border-[var(--glass-1-border)] py-5"
                    style={{ '--i': i } as React.CSSProperties}
                  >
                    <Link
                      href={`/p/${it.slug}`}
                      className="min-w-0 flex-1 transition-colors duration-[var(--d-micro)] hover:text-[var(--ink-1)]"
                    >
                      <span className="data block truncate text-[var(--ink-2)]">
                        {it.name ?? it.fullName ?? it.slug}
                      </span>
                      {(it.fullName || it.name) ? (
                        <span className="data mt-1 block truncate text-[length:var(--fs-xs)] text-[var(--ink-4)]">
                          {it.fullName ?? it.slug}
                        </span>
                      ) : null}
                    </Link>
                    <button
                      type="button"
                      onClick={() => remove(it.slug)}
                      className="data shrink-0 text-[var(--ink-4)] transition-colors duration-[var(--d-micro)] hover:text-[var(--ink-1)]"
                    >
                      <T k="act.remove" as="span" fade={false} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="mt-10 border-t border-[var(--glass-1-border)] pt-8">
          <Link
            href="/today"
            className="system text-[var(--ink-3)] transition-colors duration-[var(--d-micro)] hover:text-[var(--ink-1)]"
          >
            <span aria-hidden>←</span> <T k="pg.saved.toToday" as="span" fade={false} />
          </Link>
        </div>
      </div>
    </V3Shell>
  );
}
