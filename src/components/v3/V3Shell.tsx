/**
 * V3 页面外壳
 *
 * 承担四件事：
 *   1. 挂 .v3-root —— V3 的 token 全部作用域在这个类下面，不再污染 V2 页面
 *   2. 渲染左上角固定标识（之前它挂在根 layout 上，会在 V2 页面上和
 *      sticky 导航里的字标撞在同一位置）
 *   3. 挂页脚
 *   4. 向内提供统一的 gutter / container
 *
 * 这是服务端组件，没有任何交互逻辑。
 */

import { FixedBrandMark } from '@/components/brand/FixedBrandMark';
import { FooterBrand } from '@/components/brand/FooterBrand';
import { V3Nav } from './V3Nav';
import { NavDirection } from './NavDirection';
import { SmoothScroll } from './SmoothScroll';


/**
 * 注意：这里没有手写的转场层。
 *
 * §7 的转场（共享元素 + 相机推进）现在由浏览器原生的 View Transitions 完成
 * —— next.config.ts 开了 experimental.viewTransition，共享元素靠两边同名的
 * view-transition-name 配对，时间曲线和相机推进在 tokens.css 的
 * ::view-transition-* 规则里。
 *
 * 之前那个自制的 overlay（拦截点击 → 播黑场 → router.push）在同一次导航里
 * 会和原生转场叠加，变成两层动画抢同一个瞬间。原生能做好的事就不要自己再做
 * 一遍。不支持的浏览器直接切换，不做假转场 —— 这也正是规格要求的降级方式。
 */
export function V3Shell({ children, editorial = false }: { children: React.ReactNode; editorial?: boolean }) {
  return (
    <div className={`v3-root${editorial ? ' garden-journal' : ''}`}>
      <div aria-hidden className="site-header-backdrop" />
      {/* Static film grain. Decorative, non-animated, survives reduced motion. */}
      <div aria-hidden className="v3-grain" />
      <NavDirection />
      <SmoothScroll />
      <FixedBrandMark theme={editorial ? 'light' : 'dark'} />
      <V3Nav />
      {children}
      <FooterBrand theme={editorial ? 'light' : 'dark'} />
    </div>
  );
}
