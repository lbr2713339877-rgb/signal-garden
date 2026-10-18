/**
 * 固定在左上角的品牌标识（V3）
 *
 * - 左边 clamp(28px,3vw,40px)，顶部 28px —— 落在 brief 的 28–40 / 24–32 区间
 * - sticky 定位，滚动时不动，不遮挡内容（pointer-events 只在自身）
 * - 移动端只留圆环
 * - 点击回首页
 * - hover：缺口旋转 4°，字标透明度略微提高
 *
 * 这是服务端组件：动效全部是 CSS，不需要 MutationObserver。
 * V3 是恒定的黑色展场，主题切换不影响它，所以去掉了之前那套本体观察逻辑。
 * 也正因为如此它只挂在 V3 的 shell 里 —— V2 页面的 sticky 导航左上角
 * 已经有字标了，再叠一个固定标识会在同一位置出现两个 wordmark。
 */

import Link from 'next/link';
import { AnimatedBrandLogo } from './BrandLogo';

export function FixedBrandMark({ theme = 'dark' }: { theme?: 'dark' | 'light' }) {
  return (
    <Link
      href="/"
      aria-label="Signal Garden"
      className="fixed-brand group fixed top-7 left-[clamp(28px,3vw,40px)] z-[var(--z-sticky)] inline-flex items-center"
    >
      <style>{`
        .fixed-brand .brand-ring {
          transform-box: view-box;
          transform-origin: 50% 50%;
          transition: transform 0.42s var(--e-v3, cubic-bezier(0.22,1,0.36,1));
        }
        .fixed-brand .brand-wordmark {
          transition: opacity 0.42s var(--e-v3, cubic-bezier(0.22,1,0.36,1));
          opacity: 0.78;
        }

        @media (hover: hover) and (pointer: fine) {
          .fixed-brand:hover .brand-ring {
            transform: rotate(4deg);
          }
          .fixed-brand:hover .brand-wordmark {
            opacity: 1;
          }
        }

        /* 键盘可见焦点，但不要默认那圈蓝 */
        .fixed-brand:focus-visible {
          outline: 1px solid var(--ink-3);
          outline-offset: 8px;
        }

        @media (max-width: 768px) {
          .fixed-brand .brand-wordmark {
            display: none;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .fixed-brand .brand-ring {
            transition: none;
          }
        }
      `}</style>

      {/* 桌面端：圆环 + 字标；移动端字标由 CSS 隐藏 */}
      <AnimatedBrandLogo variant="full" theme={theme} />
    </Link>
  );
}
