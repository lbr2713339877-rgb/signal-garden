/**
 * 双向 reveal —— 进入时出现，离开时收回，从哪个方向滚都一样。
 *
 * ── 解决什么问题（用户反馈：从上往下划有交互，从下往上划没有）──────────
 *
 * 之前每个区块都是 `observer.disconnect()` 只触发一次：第一次滚进来播放动画，
 * 之后永远停在"已显示"状态。于是往回滚的时候什么都不会发生 —— 因为状态早就
 * 定死了。
 *
 * 现在返回的是一个持续反映可见性的布尔量：
 *   - 元素进入视口 → true（无论从上方还是下方进入）
 *   - 元素离开视口 → false
 * 也就是说往上滚和往下滚是对称的，动画会跟着方向反向播放。
 *
 * ── 为什么用 rootMargin -12% ────────────────────────────────────────────
 * 不设内缩的话，元素刚碰到视口边缘（只露出 1px）就会触发，观感上像"抖"。
 * 内缩 12% 让元素真正进入视野才开始，离开时也要真的离开才收回，两个方向
 * 都有明确的触发点，中间还有一段缓冲，不会来回闪。
 *
 * ── 为什么 thresholds 是 [0, 0.25] ──────────────────────────────────────
 * IntersectionObserver 的 threshold 决定"什么时候回调"，isIntersecting 决定
 * "现在可见吗"。传 [0, 0.25] 就能在"完全离开"和"进入四分之一"两个关键点都
 * 收到回调，而 isIntersecting 在两次回调之间始终准确。
 */

'use client';

import { useEffect, useRef, useState } from 'react';

export interface RevealOptions {
  /** 需要多少比例可见才开始（默认 0.25） */
  threshold?: number;
  /** 视口内缩，默认上下各 12% */
  rootMargin?: string;
  /** 是否只在第一次出现时触发（用于一次性的叙事序列，默认 false） */
  once?: boolean;
}

/** 返回 [ref, isRevealed]；isRevealed 随滚动两个方向对称变化。 */
export function useReveal<T extends HTMLElement = HTMLElement>({
  threshold = 0.25,
  rootMargin = '-12% 0px -12% 0px',
  once = false,
}: RevealOptions = {}) {
  const ref = useRef<T>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // 系统开了"减少动态效果"就直接给终态，不做进出动画
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setOn(true);
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (once) {
          if (entry.isIntersecting) {
            setOn(true);
            io.disconnect();
          }
          return;
        }
        setOn(entry.isIntersecting);
      },
      { threshold: [0, threshold], rootMargin },
    );

    io.observe(el);
    return () => io.disconnect();
  }, [threshold, rootMargin, once]);

  return [ref, on] as const;
}
