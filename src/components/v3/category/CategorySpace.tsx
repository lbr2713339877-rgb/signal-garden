/**
 * 分类空间容器（客户端）
 *
 * 承担 §7「分类切换：空间变色」的四段：
 *   1  0 → 200ms    当前列表对比度降到 0.35，轻微后撤 scale 0.98
 *   2  200 → 500ms  环境光插值到新分类色
 *   3  500 → 800ms  新对象从背景深度进入，前 40% 更亮
 *   4  800ms       稳定
 *
 * 分类切换是链接导航（URL 即状态，可分享、无 JS 也能用），所以「离场」这
 * 一段必须由这里接管：拦下点击 → 播完第 1 段 → 再 push。第 3 段在新页面上
 * 由行自己的进入动画完成。
 *
 * ── 为什么 children 是 prop ────────────────────────────────────────────
 * 列表由服务端组件渲染好传进来，这样数据库读取留在服务端，而状态（正在离场）
 * 留在客户端。是整个页面唯一合理的切分方式。
 */

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { categoryColor } from '../category-color';
import { LANG, Fallback } from '@/lib/i18n';
import { TAXONOMY } from '@/normalizers/taxonomy';
import { T } from '@/lib/dict';

const LEAVE_MS = 0; // 第 1 段
const SWITCH_MS = 240; // 全部四段

export interface SpaceNavProps {
  category: string;
  secondary?: string;
  sort: string;
  total: number;
  interesting?: boolean;
  subCounts: { k: string; n: number }[];
  sorts: { key: string; zh: string; en: string }[];
  /** 服务端渲染好的行列表 */
  children: React.ReactNode;
}

export function CategorySpace({
  category,
  secondary,
  sort,
  total,
  interesting = false,
  subCounts,
  sorts,
  children,
}: SpaceNavProps) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const [settled, setSettled] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const meta = TAXONOMY.find((t) => t.key === category) ?? TAXONOMY[0];
  const accent = categoryColor(category);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => () => clear(), []);

  /** 换空间：离场 → 导航 → 入场 */
  const go = useCallback(
    (href: string) => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        router.push(href);
        return;
      }

      clear();
      setLeaving(true);
      setSettled(false);

      // 第 1 段播完再导航，这样用户看到的是"这个空间退后了"，
      // 而不是旧内容瞬间消失
      timers.current.push(setTimeout(() => router.push(href), LEAVE_MS));
      // 导航完成后复位（新页面会重新挂载，这里只是兜底）
      timers.current.push(
        setTimeout(() => {
          setLeaving(false);
          setSettled(true);
        }, SWITCH_MS),
      );
    },
    [router],
  );

  /** 内部链接统一走 go()，保留修饰键/新标签的默认行为 */
  const onClickLink = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    go(href);
  };

  const href = (next: { sub?: string | null; sort?: string }) => {
    const q = new URLSearchParams();
    const nextSub = next.sub === undefined ? secondary : next.sub;
    const nextSort = next.sort ?? sort;
    if (nextSub) q.set('sub', nextSub);
    if (nextSort !== 'heat') q.set('sort', nextSort);
    if (interesting) q.set('view', 'interesting');
    const s = q.toString();
    return `/c/${category}${s ? `?${s}` : ''}`;
  };

  return (
    <div data-leaving={leaving} data-settled={settled} data-space={category}>
      <style>{`
        /* 环境光：第 2 段插值到新分类色 */
        .space-ambient {
          transition:
            background 420ms var(--e-v3) 180ms,
            opacity 420ms var(--e-v3) 180ms;
        }

        /* 第 1 段：列表后撤 */
        .space-list {
          transition:
            opacity 200ms var(--e-v3),
            transform 200ms var(--e-v3);
        }
        [data-leaving="true"] .space-list {
          opacity: 0.35;
          transform: scale(0.98);
        }

        /* 第 3 段：新对象从背景深度进入，前 40% 更亮 */
        .space-row {
          animation: space-row-in 240ms var(--e-v3) both;
          animation-delay: min(calc(var(--i) * 18ms), 100ms);
        }
        @keyframes space-row-in {
          0%   { opacity: 0; filter: brightness(1.9); transform: translateY(14px); }
          40%  { opacity: 1; filter: brightness(1.55); }
          100% { opacity: 1; filter: brightness(1); transform: translateY(0); }
        }

        .space-filter {
          transition:
            color 220ms var(--e-v3),
            border-color 220ms var(--e-v3),
            background-color 220ms var(--e-v3);
        }

        @media (prefers-reduced-motion: reduce) {
          .space-ambient, .space-list, .space-filter { transition: none; }
          .space-row { animation: none; }
          [data-leaving="true"] .space-list { opacity: 1; transform: none; }
        }
      `}</style>

      {/* 环境光：唯一的彩色来源，只作光斑 */}
      <div
        aria-hidden
        className="space-ambient ambient-light pointer-events-none absolute top-[-18%] left-[-12%] h-[640px] w-[640px]"
        style={{
          background: `radial-gradient(circle, ${accent}, transparent 68%)`,
          opacity: 0.15,
        }}
      />

      <div className="relative mx-auto max-w-[var(--container)] px-[var(--gutter)] pt-28">
        {/* 标题 */}
        <p className="system" style={{ color: accent }}>
          {meta.en.toUpperCase()}
        </p>
        <h1 className="selection-title mt-4 max-w-[18ch]"><LANG zh={meta.label} en={meta.en} /></h1>
        <p className="body mt-4 max-w-[54ch] text-[var(--ink-2)]"><LANG zh={meta.tagline} en={meta.taglineEn} /></p>
        <p className="data mt-4 text-[var(--ink-3)]">
          <LANG zh={`${total} 个项目 · 按用途挑选`} en={`${total} projects · browse by use`} />
        </p>

        {/* 一级：六个空间 */}
        <nav aria-label="Categories / 分类" className="mt-8 flex flex-wrap gap-x-8 gap-y-4">
          {TAXONOMY.map((t) => {
            const on = t.key === category;
            const c = categoryColor(t.key);
            return (
              <Link
                key={t.key}
                href={`/c/${t.key}`}
                onClick={(e) => onClickLink(e, `/c/${t.key}`)}
                aria-current={on ? 'page' : undefined}
                className="space-filter body pb-1"
                style={{
                  color: on ? 'var(--ink-1)' : 'var(--ink-3)',
                  borderBottom: `1px solid ${on ? c : 'transparent'}`,
                }}
              >
                <LANG zh={t.label} en={t.en} />
              </Link>
            );
          })}
        </nav>

        <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link href={`/c/${category}`} className="data" aria-current={!interesting ? 'page' : undefined} style={{ color: !interesting ? 'var(--ink-1)' : 'var(--ink-3)' }}><LANG zh="全部项目" en="All projects" /></Link>
          <Link href={`/c/${category}?view=interesting`} className="data" aria-current={interesting ? 'page' : undefined} style={{ color: interesting ? accent : 'var(--ink-3)' }}><LANG zh="有意思的" en="Interesting finds" /></Link>
          <Link href="/discoveries" className="data text-[var(--ink-3)]"><LANG zh="随便逛逛" en="Explore discoveries" /> ↗</Link>
        </div>

        {/* 二级 + 排序 */}
        <div className="mt-6 border-t border-[var(--glass-1-border)] pt-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <span className="system w-12 shrink-0">
              <T k="pg.cat.type" as="span" fade={false} />
            </span>
            <Link
              href={href({ sub: null })}
              onClick={(e) => onClickLink(e, href({ sub: null }))}
              className="space-filter data"
              style={{
                color: !secondary ? 'var(--ink-1)' : 'var(--ink-4)',
                borderBottom: `1px solid ${!secondary ? accent : 'transparent'}`,
              }}
            >
              <LANG zh="全部" en="All" />
            </Link>
            {meta.secondary.map((s) => {
              const n = subCounts.find((c) => c.k === s.key)?.n ?? 0;
              const on = secondary === s.key;
              return (
                <Link
                  key={s.key}
                  href={href({ sub: s.key })}
                  onClick={(e) => onClickLink(e, href({ sub: s.key }))}
                  className="space-filter data"
                  style={{
                    color: on ? 'var(--ink-1)' : 'var(--ink-4)',
                    borderBottom: `1px solid ${on ? accent : 'transparent'}`,
                  }}
                >
                  <LANG zh={s.label} en={s.en} />
                  {n ? <span className="ml-2 text-[var(--ink-4)]">{n}</span> : null}
                </Link>
              );
            })}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
            <span className="system w-12 shrink-0">
              <T k="pg.cat.sort" as="span" fade={false} />
            </span>
            {sorts.map((s) => {
              const on = sort === s.key;
              return (
                <Link
                  key={s.key}
                  href={href({ sort: s.key })}
                  onClick={(e) => onClickLink(e, href({ sort: s.key }))}
                  aria-current={on ? 'true' : undefined}
                  className="space-filter data"
                  style={{
                    color: on ? 'var(--ink-1)' : 'var(--ink-4)',
                    borderBottom: `1px solid ${on ? accent : 'transparent'}`,
                  }}
                >
                  <LANG zh={s.zh} en={s.en} />
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* 列表（服务端渲染） */}
      <div className="space-list relative mx-auto max-w-[var(--container)] px-[var(--gutter)] pt-10 pb-[var(--section-gap)]">
        {children}
      </div>
    </div>
  );
}

/** 行：V3 版的列表项。与详情页同一套语言 —— 编号、名称、hook、增长。 */
export function SpaceRow({
  index,
  slug,
  name,
  hook,
  oneLiner,
  metric,
  metricUnit,
  metricPrefix = '+',
  category,
  accent,
  isVerified,
}: {
  index: number;
  slug: string;
  name: string;
  /** 中英各一份 —— 只有一种时会打"待翻译"标记，而不是漏出另一种语言 */
  hook?: { zh: string | null; en: string | null } | null;
  oneLiner?: { zh: string | null; en: string | null } | null;
  metric: number;
  metricUnit: string;
  metricPrefix?: string;
  category: string;
  accent: string;
  isVerified?: boolean;
}) {
  return (
    <Link
      href={`/p/${slug}`}
      className="space-row lift group flex flex-col gap-4 border-t border-[var(--glass-1-border)] py-8 md:flex-row md:items-baseline md:gap-10"
      style={{ '--i': index } as React.CSSProperties}
    >
      <span className="data w-10 shrink-0 text-[var(--ink-4)]">
        {String(index + 1).padStart(2, '0')}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="editorial text-[var(--ink-1)]">{name}</span>
          {isVerified ? (
            <span className="system" style={{ color: accent }}>
              <T k="pd.act.verified" as="span" fade={false} />
            </span>
          ) : null}
        </span>

        {oneLiner?.zh || oneLiner?.en ? (
          <Fallback
            zh={oneLiner.zh}
            en={oneLiner.en}
            className="body mt-3 block max-w-[52ch] text-[var(--ink-2)]"
          />
        ) : hook?.zh || hook?.en ? (
          <Fallback
            zh={hook.zh}
            en={hook.en}
            className="body mt-3 block max-w-[52ch] text-[var(--ink-3)]"
          />
        ) : null}
      </span>

      <span className="flex shrink-0 items-baseline gap-6 md:flex-col md:items-end md:gap-2">
        {metric > 0 ? (
          <span className="data" style={{ color: accent }}>
            {metricPrefix}{metric.toLocaleString('en-US')}
            <span className="ml-2 text-[var(--ink-4)]">{metricUnit}</span>
          </span>
        ) : (
          null
        )}
        <span className="system">{category}</span>
      </span>
    </Link>
  );
}
