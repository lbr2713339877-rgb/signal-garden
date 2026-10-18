/**
 * 导航方向标记 —— 返回比进入快
 *
 * §7：「返回用 420ms，比进入快 46%。进入慢、返回快是一个不被注意但影响很大
 * 的细节 —— 用户返回时已经知道要去哪，不需要再被叙事一次。」
 *
 * CSS 没有办法知道这次导航是前进还是后退，所以这里监听 popstate（浏览器
 * 前进/后退按钮、手势返回都走这个事件），在 <html> 上打一个 data-nav="back"，
 * tokens.css 里对应的规则把时长从 780ms 换成 420ms。
 *
 * 标记在转场窗口结束后清掉，否则下一次前进还会沿用返回的时长。
 *
 * ── 为什么用 document.documentElement 而不是 React state ──────────────
 * view-transition 的伪元素挂在文档上，React 的渲染时序不保证能在
 * startViewTransition 快照之前把属性写上去。直接写 DOM 属性是同步的。
 */

'use client';

import { useEffect } from 'react';

export function NavDirection() {
  useEffect(() => {
    const root = document.documentElement;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const onPop = () => {
      root.dataset.nav = 'back';
      if (timer) clearTimeout(timer);
      // 420ms 转场 + 余量
      timer = setTimeout(() => {
        delete root.dataset.nav;
      }, 700);
    };

    // pushState/replaceState 之后按后退，popstate 一样会触发，
    // 所以不需要额外监听 history 本身
    window.addEventListener('popstate', onPop);

    return () => {
      window.removeEventListener('popstate', onPop);
      if (timer) clearTimeout(timer);
      delete root.dataset.nav;
    };
  }, []);

  return null;
}
