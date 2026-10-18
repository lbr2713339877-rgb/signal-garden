/**
 * V3 顶部导航
 *
 * V3 的叙事页本身没有导航栏 —— 它是黑场序列，插一条 56px 的 sticky 玻璃
 * 条会把第一段的"纯黑 300ms"直接毁掉。但产品其余部分（今日、分类、搜索、
 * 收藏）必须能到达，所以这里放一个固定在右上角的最小导航：
 *
 * - 默认只有 30% 不透明度的系统字，hover 整条才提到 100%
 * - 不画底、不画边、不 blur —— 不做成一条 bar，只是浮在场上的字
 * - 常显：顶部导航（状态栏）在任何滚动位置都可见，不再因滚动而隐藏
 *   （用户上线前要求：状态栏要常态显示，不要一划就没了）
 * - 移动端收成一个"菜单" disclosure（原生 details，无 JS 也能用）
 *
 * ── 语言开关（用户第四轮要求）─────────────────────────────────────────
 * 放在导航最右侧（SAVED 旁边），全站可见。文案走字典，切换时 220ms 交叉
 * 淡入。导航项本身是"成对"的：中文模式显示中文，英文模式显示英文 ——
 * 但英文小 caps 标签（TODAY / CATEGORIES）按语言策略 a 永远保留。
 */

'use client';

import Link from 'next/link';
import { LangSwitch } from '@/components/ui/Lang';
import { T, type DictKey } from '@/lib/dict';
import { UserMenu } from './UserMenu';

const LINKS: { href: string; zhKey: DictKey; enLabel: string }[] = [
  { href: '/today', zhKey: 'nav.today', enLabel: 'TODAY' },
  { href: '/c', zhKey: 'nav.categories', enLabel: 'CATEGORIES' },
  { href: '/search', zhKey: 'nav.search', enLabel: 'SEARCH' },
  { href: '/saved', zhKey: 'nav.saved', enLabel: 'SAVED' },
  { href: '/sponsor', zhKey: 'nav.sponsor', enLabel: 'SPONSOR' },
];

export function V3Nav() {
  return (
    <nav
      className="v3-nav fixed top-7 right-[clamp(28px,3vw,40px)] z-[var(--z-sticky)] flex items-center gap-6"
      data-shown="true"
    >
      <style>{`
        .v3-nav {
          opacity: 0;
          transform: translateY(-6px);
          pointer-events: none;
          transition:
            opacity 420ms var(--e-v3),
            transform 420ms var(--e-v3);
        }
        .v3-nav[data-shown="true"] {
          opacity: 1;
          transform: translateY(0);
          pointer-events: auto;
        }

        .v3-nav a {
          color: var(--ink-3);
          transition: color 220ms var(--e-v3);
        }
        .v3-nav a:hover {
          color: var(--ink-1);
        }

        /* 移动端：只留"菜单" + 语言开关 */
        .v3-nav .v3-nav-full { display: none; }
        @media (min-width: 1100px) {
          .v3-nav .v3-nav-full { display: flex; }
          .v3-nav .v3-nav-mobile { display: none; }
        }

        @media (prefers-reduced-motion: reduce) {
          .v3-nav { transition: none; }
        }
      `}</style>

      <div className="v3-nav-full items-center gap-6">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="system !text-[var(--ink-2)] hover:!text-[var(--ink-1)]"
          >
            <T k={l.zhKey} as="span" fade={false} />
          </Link>
        ))}
      </div>

      {/* 原生 disclosure：无 JS 也能展开 */}
      <details className="v3-nav-mobile group relative">
        <summary className="system cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <T k="nav.menu" as="span" fade={false} />
        </summary>
        <div className="glass-2 absolute right-0 top-8 flex min-w-[150px] flex-col p-2">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="system !text-[var(--ink-2)] px-3 py-2 hover:!text-[var(--ink-1)]"
            >
              <T k={l.zhKey} as="span" fade={false} />
            </Link>
          ))}
        </div>
      </details>

      <UserMenu />

      {/* 语言开关：全站可见，切换即时生效并写入 localStorage */}
      <LangSwitch />
    </nav>
  );
}
