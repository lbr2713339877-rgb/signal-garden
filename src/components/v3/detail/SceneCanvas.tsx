/**
 * 详情页第一屏 —— 能力场景（Canvas 2D，18s 循环）
 *
 * 规格（01-art-direction-v3.md §9 第一屏）：
 * "场景内容按项目能力生成，不是通用动效……场景是能力的视觉化，不是装饰。
 *  用户应该在没读文案前就大致猜到它能做什么。"
 *
 * 所以这里不是一段循环的粒子背景，而是按项目能力选一个分镜脚本，六个动作
 * 依次播放：层叠 → 结构 → 指针 → 填充 → 提取 → 归位。不同能力类型换的是
 * 脚本里的动作组合，不是换颜色。
 *
 * ── 实现约束 ───────────────────────────────────────────────────────────
 * - 只有几何和 1px 线，不做完整模拟器（规格明确写了）
 * - 离屏暂停：IntersectionObserver，不见就不烧帧
 * - reduced-motion：只画一帧静态构图，不动
 * - 用 devicePixelRatio 缩放，Retina 上线条不发毛
 * - 颜色从 CSS 变量读，跟着分类环境色走
 */

'use client';

import { useEffect, useRef } from 'react';

/** 场景脚本：每组是一段动作，累加时长后循环。 */
type Act = 'layer' | 'structure' | 'pointer' | 'fill' | 'extract' | 'collect';

const SCRIPTS: Record<string, Act[]> = {
  browser: ['layer', 'structure', 'pointer', 'fill', 'extract', 'collect'],
  design: ['layer', 'structure', 'pointer', 'fill', 'extract', 'collect'],
  data: ['layer', 'structure', 'fill', 'extract', 'collect'],
  cli: ['layer', 'structure', 'fill', 'collect'],
  default: ['layer', 'structure', 'pointer', 'extract', 'collect'],
};

const ACT_MS = 3000; // 每个动作 3s，六个动作正好 18s

export function SceneCanvas({
  kind = 'default',
  accent = 'var(--light-cyan)',
}: {
  kind?: string;
  accent?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const script = SCRIPTS[kind] ?? SCRIPTS.default;

    // 从 CSS 变量解析出真实颜色（canvas 不能直接用 var()）
    const styles = getComputedStyle(wrap);
    const raw = styles.getPropertyValue(accent.replace(/var\(|\)/g, '')).trim() || '#73D9E8';
    const ink = styles.getPropertyValue('--ink-3').trim() || 'rgba(242,240,234,0.32)';
    const inkFaint = styles.getPropertyValue('--ink-4').trim() || 'rgba(242,240,234,0.18)';

    let w = 0;
    let h = 0;
    let raf = 0;
    let running = true;
    let visible = true;
    let start = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = wrap.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    /** ease-out，和 house curve 的收尾一致 */
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

    /** 每段动作的局部进度 0→1 */
    const actProgress = (elapsed: number, i: number) =>
      clamp01((elapsed - i * ACT_MS) / ACT_MS);

    const draw = () => {
      if (!ctx) return;
      const cycle = reduced ? 0 : (performance.now() - start) % (script.length * ACT_MS);

      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const unit = Math.min(w, h) / 12;

      // 每个动作的基础位置
      const actIndex = (name: Act) => script.indexOf(name);
      const prog = (name: Act) => {
        const i = actIndex(name);
        return i < 0 ? 1 : reduced ? 1 : actProgress(cycle, i);
      };
      /** 动作结束后保持终态 */
      const done = (name: Act) => {
        const i = actIndex(name);
        return i < 0 ? true : reduced ? true : cycle > (i + 1) * ACT_MS;
      };

      // ── layer：窗口层叠 ─────────────────────────────────────────
      const layerP = prog('layer');
      if (actIndex('layer') >= 0 && (cycle >= 0 || reduced)) {
        const layers = 3;
        for (let i = 0; i < layers; i++) {
          const p = ease(clamp01(layerP * layers - i));
          if (p <= 0) continue;
          const off = (i - 1) * unit * 1.4;
          const boxW = unit * 5;
          const boxH = unit * 3.2;
          ctx.save();
          ctx.globalAlpha = 0.5 * p;
          ctx.strokeStyle = i === 1 ? raw : inkFaint;
          ctx.lineWidth = 1;
          ctx.strokeRect(cx - boxW / 2 + off, cy - boxH / 2 + off * 0.6, boxW, boxH);
          ctx.restore();
        }
      }

      // ── structure：网格出现，元素对齐 ────────────────────────────
      const structP = prog('structure');
      if (done('layer') && structP > 0) {
        const p = ease(structP);
        const boxW = unit * 5;
        const boxH = unit * 3.2;
        const cols = 4;
        ctx.save();
        ctx.globalAlpha = 0.34 * p;
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1;
        for (let c = 1; c < cols; c++) {
          const x = cx - boxW / 2 + (boxW / cols) * c;
          const grow = clamp01(p * 1.4 - c * 0.08);
          ctx.beginPath();
          ctx.moveTo(x, cy - (boxH / 2) * grow);
          ctx.lineTo(x, cy + (boxH / 2) * grow);
          ctx.stroke();
        }
        ctx.globalAlpha = 0.5 * p;
        ctx.strokeStyle = raw;
        ctx.beginPath();
        ctx.moveTo(cx - boxW / 2, cy);
        ctx.lineTo(cx - boxW / 2 + boxW * clamp01(p * 1.6), cy);
        ctx.stroke();
        ctx.restore();
      }

      // ── pointer：一个指针移动到目标 ──────────────────────────────
      const pointerP = prog('pointer');
      if (done('structure') && actIndex('pointer') >= 0) {
        const p = ease(pointerP);
        const from = { x: cx - unit * 3.4, y: cy + unit * 2.6 };
        const to = { x: cx + unit * 1.1, y: cy - unit * 0.3 };
        const x = from.x + (to.x - from.x) * p;
        const y = from.y + (to.y - from.y) * p;
        ctx.save();
        // 移动轨迹：一条极短的拖尾
        ctx.globalAlpha = 0.28;
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(x, y);
        ctx.stroke();
        // 指针本体：一个小三角
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = raw;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 7, y + 11);
        ctx.lineTo(x + 2.5, y + 11);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // ── fill：表单被填满（几条线依次长出）──────────────────────
      const fillP = prog('fill');
      if (done('pointer') && actIndex('fill') >= 0 && fillP > 0) {
        const rows = 3;
        ctx.save();
        for (let r = 0; r < rows; r++) {
          const p = ease(clamp01(fillP * rows * 0.8 - r * 0.7));
          if (p <= 0) continue;
          const y = cy + unit * (0.2 + r * 0.9);
          ctx.globalAlpha = 0.55;
          ctx.strokeStyle = raw;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cx - unit * 2.2, y);
          ctx.lineTo(cx - unit * 2.2 + unit * 3.4 * p, y);
          ctx.stroke();
        }
        ctx.restore();
      }

      // ── extract：目标区域被框选并分离 ────────────────────────────
      const extractP = prog('extract');
      if (done('fill') && actIndex('extract') >= 0 && extractP > 0) {
        const p = ease(extractP);
        const boxW = unit * 2.6;
        const boxH = unit * 1.8;
        const dx = unit * 2.6 * p;
        const dy = -unit * 2.2 * p;
        ctx.save();
        ctx.globalAlpha = 0.75;
        ctx.strokeStyle = raw;
        ctx.lineWidth = 1;
        // 框选的虚线感：四段短线
        const x0 = cx - unit * 0.4 + dx;
        const y0 = cy + unit * 0.6 + dy;
        const seg = boxW * 0.22;
        const corners: [number, number, number, number][] = [
          [x0, y0, 1, 0],
          [x0, y0, 0, -1],
          [x0 + boxW, y0 + boxH, -1, 0],
          [x0 + boxW, y0 + boxH, 0, 1],
        ];
        for (const [px, py, ddx, ddy] of corners) {
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + ddx * seg, py + ddy * seg);
          ctx.stroke();
        }
        ctx.restore();
      }

      // ── collect：结果收拢归位 ────────────────────────────────────
      const collectP = prog('collect');
      if (done('extract') && actIndex('collect') >= 0 && collectP > 0) {
        const p = ease(collectP);
        const n = 5;
        ctx.save();
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const r = unit * 3.4 * (1 - p) + unit * 0.5;
          const x = cx + Math.cos(a) * r;
          const y = cy + Math.sin(a) * r;
          ctx.globalAlpha = 0.5 * (1 - p * 0.4);
          ctx.fillStyle = raw;
          ctx.beginPath();
          ctx.arc(x, y, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    };

    const loop = () => {
      if (!running) return;
      if (visible) draw();
      raf = requestAnimationFrame(loop);
    };

    resize();
    // reduced-motion 下只画一帧
    if (reduced) {
      draw();
    } else {
      raf = requestAnimationFrame(loop);
    }

    const onResize = () => {
      resize();
      if (reduced) draw();
    };
    window.addEventListener('resize', onResize);

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        // 回到视口时重置起点，避免"跳帧"式的进度跳跃
        if (visible) start = performance.now();
      },
      { threshold: 0 },
    );
    io.observe(wrap);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      io.disconnect();
    };
  }, [kind, accent]);

  return (
    <div ref={wrapRef} className="relative h-full w-full" aria-hidden>
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
