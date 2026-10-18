/**
 * Section 02 主体视觉 —— 3D 信号场（渲染精修版）
 *
 * 规格：14 个对象，4 个高亮并向中心聚拢，扫描波周期扫过，克制鼠标视差。
 *
 * ── 这一版做了什么（用户反馈：像默认材质演示工程）──────────────────────
 *
 * 上一版是"线框 + 平涂"，没有任何光照计算，所以：
 *   灰色多边形没有明暗面 → 看起来是平的
 *   没有辉光 → 4 个高亮对象和其余 10 个在视觉上等价
 *   扫描线是一条 1px 直线 → 看不出"扫描"这个动作
 *
 * 现在补齐三件事：
 *
 * 1. **从 MeshBasic 换成 MeshStandard + 图像光照**
 *    PMREMGenerator + RoomEnvironment 生成环境贴图（IBL），另加一盏主光
 *    （左上前方，冷白）和一盏轮廓光（右下后方，带强调色）。flatShading 保留
 *    低多边形的硬边，但每个面现在有真实的明暗差。
 *    renderer 开 ACESFilmicToneMapping + SRGBColorSpace，灰阶不再是死灰。
 *
 * 2. **扫描波**（原先那条 1px 直线换掉）
 *    从场景中心向外扩散的加色环形波，半径随时间增长、透明度衰减。对象按
 *    自己到中心的距离与波前比对，波扫到时就"亮一下"：高亮对象的
 *    emissiveIntensity 脉冲，暗色对象的棱线短暂提亮。
 *
 * 3. **后期管线**
 *    EffectComposer + RenderPass + UnrealBloomPass + OutputPass。
 *    bloom 阈值 0.86 —— 只有高亮对象的自发光和扫描波会超过它，暗色物体
 *    不会泛光，避免"全场糊"。渲染目标 samples: 4 做 MSAA（composer 会绕过
 *    renderer 的 antialias，必须自己开多重采样，否则边缘有狗牙）。
 *
 * ── 构图 ──────────────────────────────────────────────────────────────
 * 场铺满整屏（之前只占右侧 58%，用户要求铺满）。文字可读性不靠"把场挤到
 * 一边"，靠两件事：4 个高亮对象全部放在 x > 0 的右半区（绝不压在标题后面），
 * 以及 SignalFieldStage 里一层从左到右的暗色渐变把文字区压下去。
 *
 * ── 三层降级（同一组 14 个对象）────────────────────────────────────────
 *   full   three.js + 后期管线，桌面 + WebGL 可用，动态 import
 *   lite   Canvas 2D，手机 / 无 WebGL
 *   static Canvas 2D 单帧，prefers-reduced-motion
 */

'use client';

import { useEffect, useRef, useState } from 'react';

/** Desktop: 14 objects, 4 highlighted. Exported for self-checks. */
export const FIELD_COUNT = 14;
/** Mobile: 8 objects, keeping the same 4-highlight ratio. */
export const MOBILE_FIELD_COUNT = 8;
export const HIGHLIGHT_COUNT = 4;

type Shape = 'ico' | 'octa' | 'tetra' | 'box' | 'cluster';

interface FieldObject {
  id: number;
  x: number;
  y: number;
  z: number;
  scale: number;
  speed: number;
  spin: number;
  shape: Shape;
  highlighted: boolean;
  phase: number;
}

const SHAPES: Shape[] = ['ico', 'octa', 'tetra', 'box', 'cluster'];
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const BG = 0x030303;

/** 高亮对象的坐标 —— 全部在 x > 0 的右半区，绝不落在文字正后方。
 *  四个点构成一个松散的四边形，聚拢时收成一个"结"。 */
const HIGHLIGHT_POS: { x: number; y: number; z: number }[] = [
  { x: 3.0, y: 1.5, z: -1.5 },
  { x: 7.2, y: -2.4, z: -3.5 },
  { x: 1.5, y: -3.6, z: -2.0 },
  { x: 5.2, y: 3.8, z: -5.0 },
];

/**
 * 10 个暗色对象：黄金角螺旋铺满整屏。
 * 画布接近 1.6:1，相机在 z=22、fov 42 → 半高约 8.4、半宽约 13.5。
 * 半径取到 11.2，横向填满约 83%（加上漂移约 90%），纵向压到 0.62 倍。
 */
const DIM_POS = Array.from({ length: FIELD_COUNT - HIGHLIGHT_COUNT }, (_, i) => {
  const n = FIELD_COUNT - HIGHLIGHT_COUNT; // 10
  const r = 2.2 + 9.0 * Math.sqrt(i / (n - 1));
  const a = i * GOLDEN;
  const q = (v: number) => Math.round(v * 100) / 100;
  return { x: q(Math.cos(a) * r), y: q(Math.sin(a) * r * 0.62), z: q(-7 + ((i * 5) % 9)) };
});

/** 恰好 14 个：前 10 个暗色，后 4 个高亮。 */
const ALL_OBJECTS: FieldObject[] = [
  ...DIM_POS.map((p, i) => ({
    id: i,
    ...p,
    scale: Math.round((0.5 + ((i * 7) % 8) * 0.085) * 100) / 100,
    speed: Math.round((0.11 + ((i * 3) % 7) * 0.045) * 100) / 100,
    spin: Math.round((0.1 + ((i * 11) % 5) * 0.06) * 100) / 100,
    shape: SHAPES[i % SHAPES.length],
    highlighted: false,
    phase: Math.round(i * 0.71 * 100) / 100,
  })),
  ...HIGHLIGHT_POS.map((p, j) => {
    const i = j + (FIELD_COUNT - HIGHLIGHT_COUNT);
    return {
      id: i,
      ...p,
      scale: Math.round((0.8 + (j % 3) * 0.14) * 100) / 100,
      speed: Math.round((0.16 + (j % 4) * 0.05) * 100) / 100,
      spin: Math.round((0.14 + (j % 3) * 0.07) * 100) / 100,
      shape: (['ico', 'octa', 'cluster', 'box'] as Shape[])[j],
      highlighted: true,
      phase: Math.round((j * 1.7 + 0.4) * 100) / 100,
    };
  }),
];

/** 4 个高亮对象聚拢的目标点 —— 在右半区，聚成一个"结"。 */
const CONVERGE_TO = { x: 4.2, y: 0, z: -3 };

/** 把 "var(--light-cyan)" 解析成真实颜色。
 *  three 的 Color 与 Canvas 2D 的 strokeStyle 都解析不了 CSS 变量。 */
function resolveAccent(accent: string): string {
  const m = accent.match(/^var\((--[a-z0-9-]+)\)$/i);
  if (!m) return accent;
  const v = getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim();
  return v || '#6ba8b8';
}

/** 圆滑缓出，入场编排用。 */
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

type Tier = 'full' | 'lite' | 'static';

export function SignalField3D({ accent = '#6ba8b8' }: { accent?: string }) {
  /* Mobile renders a reduced field. The design doc asks for 8 objects instead
     of 14 on narrow screens: fewer meshes to draw, and the cluster still reads
     as a field rather than a crowd. */
  const [fieldSize, setFieldSize] = useState(FIELD_COUNT);
  // Keep the highlighted objects: take the first (fieldSize-4) dim + all 4 bright.
  const objects = fieldSize >= FIELD_COUNT
    ? ALL_OBJECTS
    : [...ALL_OBJECTS.slice(0, fieldSize - HIGHLIGHT_COUNT), ...ALL_OBJECTS.slice(FIELD_COUNT - HIGHLIGHT_COUNT)];
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tier, setTier] = useState<Tier | null>(null);

  /** 选层只做一次，之后不再变，避免运行中切换实现导致闪断。 */
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const narrow = window.matchMedia('(max-width: 768px)').matches;

    let webgl = false;
    try {
      const c = document.createElement('canvas');
      webgl = !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch {
      webgl = false;
    }

    setFieldSize(narrow ? MOBILE_FIELD_COUNT : FIELD_COUNT);
    if (reduced) setTier('static');
    else if (narrow || !webgl) setTier('lite');
    else setTier('full');
  }, []);

  /* ══ full：three.js + 后期管线 ══════════════════════════════════════ */
  useEffect(() => {
    if (tier !== 'full') return;
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    let disposed = false;
    let raf = 0;
    let cleanup = () => {};

    (async () => {
      /* addons 走 three/examples/jsm/* —— 这个路径 @types/three 有类型，
         three/addons/* 在部分版本里类型解析不到。 */
      const THREE = await import('three');
      const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js');
      const { EffectComposer } = await import('three/examples/jsm/postprocessing/EffectComposer.js');
      const { RenderPass } = await import('three/examples/jsm/postprocessing/RenderPass.js');
      const { UnrealBloomPass } = await import('three/examples/jsm/postprocessing/UnrealBloomPass.js');
      const { OutputPass } = await import('three/examples/jsm/postprocessing/OutputPass.js');
      if (disposed) return;

      const accentHex = resolveAccent(accent);
      const hot = new THREE.Color(accentHex);

      /* alpha: false —— composer 的渲染目标默认不保留透明度，与其和 alpha
         斗争，不如让 canvas 直接输出不透明的 --bg-void（页面底色本来就是它，
         视觉上完全一致）。 */
      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
        stencil: false,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); // 规格：上限 2
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.setClearColor(BG, 1);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(BG);
      // 轻雾：远景物体隐入黑暗，这是深度层次的来源
      scene.fog = new THREE.Fog(BG, 16, 42);

      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
      camera.position.set(0, 0, 26); // 入场时会推到 22
      camera.lookAt(0, 0, 0);

      /* ── 图像光照（IBL）──────────────────────────────────────────────
         RoomEnvironment 是一个程序化的"房间"，PMREM 把它卷积成环境贴图。
         这是让 flatShading 的多面体有真实明暗面的关键 —— 没有它，标准材质
         在纯黑场景里只会一片死黑。 */
      const pmrem = new THREE.PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader();
      const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
      scene.environment = envRT.texture;
      scene.environmentIntensity = 0.32; // 别过曝：这是暗场，不是产品展示

      /* ── 两盏方向光 ────────────────────────────────────────────────
         主光：左上前方，冷白，给物体亮面和清晰的高光边。
         轮廓光：右下后方，带强调色，勾出物体背面的边缘，避免融进背景。 */
      const keyLight = new THREE.DirectionalLight(0xdce6f5, 2.0);
      keyLight.position.set(-6, 7, 9);
      scene.add(keyLight);

      const rimLight = new THREE.DirectionalLight(hot.clone(), 1.5);
      rimLight.position.set(7, -5, -8);
      scene.add(rimLight);

      /* ── 几何 ────────────────────────────────────────────────────── */
      const geoFor = (shape: Shape) => {
        switch (shape) {
          case 'ico': return new THREE.IcosahedronGeometry(1, 0);
          case 'octa': return new THREE.OctahedronGeometry(1, 0);
          case 'tetra': return new THREE.TetrahedronGeometry(1, 0);
          case 'box': return new THREE.BoxGeometry(1.32, 1.32, 1.32);
          default: return new THREE.DodecahedronGeometry(1, 0);
        }
      };

      interface Entry {
        o: FieldObject;
        group: InstanceType<typeof THREE.Group>;
        solid: InstanceType<typeof THREE.Mesh>;
        wire: InstanceType<typeof THREE.LineSegments>;
        ring?: InstanceType<typeof THREE.Mesh>;
        /** 暗色对象的基础发光强度（0，靠环境光）；高亮对象是 1 */
        baseEmissive: number;
      }
      const entries: Entry[] = [];

      for (const o of objects) {
        const group = new THREE.Group();
        const geo = geoFor(o.shape);

        /* 暗色对象：粗糙的深灰哑光，金属度低，靠环境光和环境反射出体积。
           高亮对象：强调色自发光 —— emissiveIntensity 是唯一让它们进入
           bloom 阈值的手段（阈值 0.86）。 */
        const solid = new THREE.Mesh(
          geo,
          new THREE.MeshStandardMaterial({
            color: o.highlighted ? hot.clone() : new THREE.Color(0x2b3240),
            roughness: o.highlighted ? 0.28 : 0.62,
            metalness: o.highlighted ? 0.55 : 0.32,
            flatShading: true, // 保留低多边形的硬边，明暗面更明确
            emissive: o.highlighted ? hot.clone() : new THREE.Color(0x000000),
            emissiveIntensity: o.highlighted ? 1.15 : 0,
            transparent: true,
            opacity: o.highlighted ? 1 : 0.96,
          }),
        );
        group.add(solid);

        /* 棱线：让暗色物体在纯黑里也有可读的轮廓。
           暗色 0.24、高亮 0.7，不抢主体的明暗面。 */
        const wire = new THREE.LineSegments(
          new THREE.EdgesGeometry(geo),
          new THREE.LineBasicMaterial({
            color: o.highlighted ? hot.clone() : new THREE.Color(0x8f9aad),
            transparent: true,
            opacity: o.highlighted ? 0.7 : 0.24,
            fog: true,
          }),
        );
        group.add(wire);

        /* 高亮对象额外一个朝向相机的细圆环 —— 它才是"被识别"的视觉焦点 */
        let ring: InstanceType<typeof THREE.Mesh> | undefined;
        if (o.highlighted) {
          ring = new THREE.Mesh(
            new THREE.RingGeometry(1.28, 1.34, 64),
            new THREE.MeshBasicMaterial({
              color: hot.clone(),
              transparent: true,
              opacity: 0.55,
              side: THREE.DoubleSide,
              fog: true,
            }),
          );
          group.add(ring);
        }

        group.position.set(o.x, o.y, o.z);
        group.scale.setScalar(o.scale);
        scene.add(group);

        entries.push({
          o, group, solid, wire, ring,
          baseEmissive: o.highlighted ? 1.15 : 0,
        });
      }

      /* ── 扫描波 ────────────────────────────────────────────────────
         从中心向外扩散的加色环。半径从 0.6 涨到 17，透明度随半径衰减。
         它不是装饰：entries 里每个对象会拿自己到中心的距离和波前比对，
         所以"扫过"这件事在视觉上是因果的，不是同时闪一下。 */
      const waveMesh = new THREE.Mesh(
        new THREE.RingGeometry(0.965, 1.0, 128),
        new THREE.MeshBasicMaterial({
          color: hot.clone(),
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          fog: false,
        }),
      );
      scene.add(waveMesh);

      /* ── 尘埃点云：1 个 draw call，给"场"一点体积感 ─────────────── */
      const DUST = 340;
      const dustPos = new Float32Array(DUST * 3);
      for (let i = 0; i < DUST; i++) {
        const a = i * GOLDEN;
        const r = 2 + ((i * 13) % 90) / 6.5;
        dustPos[i * 3] = Math.cos(a) * r;
        dustPos[i * 3 + 1] = Math.sin(a) * r * 0.7;
        dustPos[i * 3 + 2] = -14 + ((i * 17) % 160) / 10;
      }
      const dustGeo = new THREE.BufferGeometry();
      dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
      const dust = new THREE.Points(
        dustGeo,
        new THREE.PointsMaterial({
          color: 0x8a94a6,
          size: 0.05,
          sizeAttenuation: true,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
          fog: true,
        }),
      );
      scene.add(dust);

      /* ── 后期管线 ──────────────────────────────────────────────────
         自定义渲染目标带 samples: 4 —— composer 绕过了 renderer 的
         antialias，不开多重采样边缘会有狗牙。 */
      const sizeOf = () => {
        const rect = wrap.getBoundingClientRect();
        return { w: Math.max(1, rect.width), h: Math.max(1, rect.height) };
      };
      let { w: cssW, h: cssH } = sizeOf();

      const composerRT = new THREE.WebGLRenderTarget(
        Math.round(cssW * renderer.getPixelRatio()),
        Math.round(cssH * renderer.getPixelRatio()),
        { type: THREE.HalfFloatType, samples: 4 },
      );
      const composer = new EffectComposer(renderer, composerRT);
      composer.setPixelRatio(renderer.getPixelRatio());

      composer.addPass(new RenderPass(scene, camera));

      /* bloom 阈值 0.86：只有高亮对象的自发光（emissiveIntensity 1.15）
         和加色混合的扫描波会超过它。暗色物体（emissive 0、颜色 0x2b3240）
         永远不会泛光，所以是"选择性 bloom"，不是全场糊。 */
      const bloom = new UnrealBloomPass(
        new THREE.Vector2(cssW, cssH),
        0.62, // strength
        0.55, // radius
        0.86, // threshold
      );
      composer.addPass(bloom);

      // OutputPass 自动接管 renderer 的 toneMapping 与 outputColorSpace
      composer.addPass(new OutputPass());

      const resize = () => {
        const { w, h } = sizeOf();
        cssW = w;
        cssH = h;
        renderer.setSize(w, h, false);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        composer.setSize(w, h);
        bloom.setSize(w, h);
      };
      resize();
      renderer.setSize(cssW, cssH, false);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;

      /* ── 鼠标视差（克制）────────────────────────────────────────── */
      let mx = 0, my = 0, px = 0, py = 0;
      const onMove = (e: MouseEvent) => {
        mx = (e.clientX / window.innerWidth - 0.5) * 2;
        my = (e.clientY / window.innerHeight - 0.5) * 2;
      };
      window.addEventListener('mousemove', onMove, { passive: true });

      /* ── 滚动进度：0 散开 → 1 聚拢。双向可用。 ─────────────────── */
      let progress = 0;
      const onScroll = () => {
        const rect = wrap.getBoundingClientRect();
        const h = window.innerHeight;
        progress = clamp01((h - rect.top) / (h * 0.85));
      };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });

      /* ── 可见性：离屏暂停整个渲染循环 ───────────────────────────── */
      let visible = true;
      let introStarted = false;
      let introStart = 0;
      const io = new IntersectionObserver(
        ([e]) => { visible = e.isIntersecting; },
        { threshold: 0 },
      );
      io.observe(wrap);

      const clock = new THREE.Clock();

      const tick = () => {
        if (disposed) return;
        raf = requestAnimationFrame(tick);
        if (!visible) return; // 离开视口：不渲染，省电

        const t = clock.getElapsedTime();

        /* 入场编排：物体从"散"到"聚"。
           第一次进入视口时记下时间，用 1.8s 缓出把 spread 从 1.9 收到 1.0，
           同时相机从 z=26 推到 z=22，物体透明度淡入。 */
        if (!introStarted) {
          introStarted = true;
          introStart = t;
        }
        const intro = easeOutCubic(clamp01((t - introStart) / 1.8));
        const spread = 1 + (1 - intro) * 0.9;

        // 扫描波：周期 4.2s，半径 0.6 → 17
        const wavePhase = (t % 4.2) / 4.2;
        const waveR = 0.6 + wavePhase * 16.4;
        waveMesh.scale.setScalar(waveR);
        const waveMat = waveMesh.material as InstanceType<typeof THREE.MeshBasicMaterial>;
        // 前 8% 快速起亮，之后线性衰减到 0
        waveMat.opacity = (wavePhase < 0.08 ? wavePhase / 0.08 : 1 - (wavePhase - 0.08) / 0.92) * 0.75;

        const c = progress;

        for (const e of entries) {
          const o = e.o;
          const drift = t * o.speed;

          /* 漂移：三个轴周期不同（黄金比错开），所以轨迹是缓慢的李萨如曲线，
             不是匀速转圈。这是"不同的速度、深度和形态"在运动上的落点。 */
          const bx = o.x + Math.sin(drift + o.phase) * 1.25;
          const by = o.y + Math.cos(drift * 0.79 + o.phase) * 1.0;
          const bz = o.z + Math.sin(drift * 0.44 + o.phase) * 0.8;

          // 入场：从 1.9 倍散开到原位（也影响 z，让它们从远处飞来）
          const ix = bx * spread;
          const iy = by * spread;
          const iz = bz * spread - (1 - intro) * 6;

          // 聚拢：4 个高亮对象向 CONVERGE_TO 插值（双向，往回滚会重新散开）
          const tx = o.highlighted ? ix + (CONVERGE_TO.x - ix) * c : ix;
          const ty = o.highlighted ? iy + (CONVERGE_TO.y - iy) * c : iy;
          const tz = o.highlighted ? iz + (CONVERGE_TO.z - iz) * c : iz;

          e.group.position.set(tx, ty, tz);

          // 自转：每个对象绕自己的轴，速度不同
          e.group.rotation.x += o.spin * 0.0035;
          e.group.rotation.y += o.spin * 0.0052;

          /* 扫描命中：拿对象到中心的平面距离和波前比。
             gain 是"离波前多近"，越近越亮。 */
          const dist = Math.hypot(tx, ty);
          const gain = Math.max(0, 1 - Math.abs(dist - waveR) / 2.6);
          const pulse = gain * gain; // 平方让亮起更集中、更像一次脉冲

          const solidMat = e.solid.material as InstanceType<typeof THREE.MeshStandardMaterial>;
          const wireMat = e.wire.material as InstanceType<typeof THREE.LineBasicMaterial>;

          if (o.highlighted) {
            // 高亮对象：自发光脉冲 —— 扫到的一刻明显更亮（这就是"被识别"）
            solidMat.emissiveIntensity = e.baseEmissive + pulse * 2.6;
            wireMat.opacity = Math.min(1, 0.7 + pulse * 0.3);
            if (e.ring) {
              const rm = e.ring.material as InstanceType<typeof THREE.MeshBasicMaterial>;
              rm.opacity = 0.5 + pulse * 0.5;
              rm.color.copy(hot).lerp(new THREE.Color(0xffffff), pulse * 0.6);
              e.ring.quaternion.copy(camera.quaternion); // billboard
              e.ring.scale.setScalar(1.05 + pulse * 0.22 - c * 0.1);
            }
          } else {
            // 暗色对象：棱线短暂提亮，材质不发光（保持哑光）
            wireMat.opacity = 0.24 + pulse * 0.5;
          }

          // 淡入 + 聚拢时高亮对象略微缩小，形成"收束"
          const fade = 0.25 + intro * 0.75;
          solidMat.opacity = (o.highlighted ? 1 : 0.96) * fade;
          const s = o.scale * (o.highlighted ? 1 - c * 0.18 : 1) * (0.62 + intro * 0.38);
          e.group.scale.setScalar(s);
        }

        // 相机：入场推镜 + 鼠标视差
        camera.position.z = 26 - intro * 4;
        px += (mx * 0.9 - px) * 0.032;
        py += (-my * 0.6 - py) * 0.032;
        camera.position.x = px;
        camera.position.y = py;
        camera.lookAt(CONVERGE_TO.x * 0.5, 0, 0);

        dust.rotation.z = t * 0.004;

        composer.render();
      };
      raf = requestAnimationFrame(tick);

      const onResize = () => resize();
      window.addEventListener('resize', onResize);

      cleanup = () => {
        cancelAnimationFrame(raf);
        io.disconnect();
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onResize);
        envRT.dispose();
        pmrem.dispose();
        composerRT.dispose();
        composer.dispose?.();
        scene.traverse((n) => {
          const any = n as unknown as {
            geometry?: { dispose(): void };
            material?: { dispose(): void };
          };
          any.geometry?.dispose();
          any.material?.dispose();
        });
        renderer.dispose();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [tier, accent]);

  /* ══ lite / static：Canvas 2D，同一组对象 ═══════════════════════════ */
  useEffect(() => {
    if (tier !== 'lite' && tier !== 'static') return;
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const accentHex = resolveAccent(accent);
    const animated = tier === 'lite';
    let raf = 0;
    let running = true;
    let visible = true;
    let progress = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = wrap.getBoundingClientRect();
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    /** 透视投影：相机 z=22 看原点，S 让场景铺满画布。 */
    const project = (x: number, y: number, z: number, w: number, h: number) => {
      const k = 22 / Math.max(6, 22 + z);
      const S = Math.min(w / 26, h / 17);
      return { sx: w * 0.5 + x * k * S, sy: h * 0.5 + y * k * S, k };
    };

    const shapeSides = (s: Shape) =>
      s === 'tetra' ? 3 : s === 'box' ? 4 : s === 'octa' ? 6 : s === 'cluster' ? 7 : 6;

    const draw = (t: number) => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#030303';
      ctx.fillRect(0, 0, w, h);

      const c = progress;

      // 扫描波：加色圆环
      const wavePhase = animated ? (t % 4.2) / 4.2 : 0.25;
      const waveR = 0.6 + wavePhase * 16.4;
      const waveAlpha = (wavePhase < 0.08 ? wavePhase / 0.08 : 1 - (wavePhase - 0.08) / 0.92) * 0.6;

      // 尘埃
      ctx.fillStyle = '#8a94a6';
      for (let i = 0; i < 90; i++) {
        const a = i * GOLDEN;
        const r = 2 + ((i * 13) % 90) / 6.5;
        const z = -14 + ((i * 17) % 160) / 10;
        const p = project(Math.cos(a) * r, Math.sin(a) * r * 0.7, z, w, h);
        ctx.globalAlpha = 0.3 * (1 - (z + 14) / 16) * (0.4 + c * 0.6);
        ctx.fillRect(p.sx, p.sy, 1.2, 1.2);
      }

      // 波环（用椭圆近似：画布非方形，直接缩放）
      if (waveAlpha > 0.01) {
        const p = project(0, 0, 0, w, h);
        const rr = waveR * p.k * Math.min(w / 26, h / 17);
        ctx.globalAlpha = waveAlpha;
        ctx.strokeStyle = accentHex;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(p.sx, p.sy, rr, rr * 0.92, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      for (const o of objects) {
        const drift = animated ? t * o.speed : 0;
        const bx = o.x + Math.sin(drift + o.phase) * 1.25;
        const by = o.y + Math.cos(drift * 0.79 + o.phase) * 1.0;
        const tx = o.highlighted ? bx + (CONVERGE_TO.x - bx) * c : bx;
        const ty = o.highlighted ? by + (CONVERGE_TO.y - by) * c : by;

        const fog = 1 - clamp01((22 + o.z - 16) / 26);
        const dist = Math.hypot(tx, ty);
        const gain = Math.max(0, 1 - Math.abs(dist - waveR) / 2.6);
        const pulse = gain * gain;

        const p = project(tx, ty, o.z, w, h);
        const r = 10 * o.scale * (1 - c * 0.18) * p.k * 1.35;

        // 暗色对象：只描边；高亮对象：填充 + 描边（模拟体积感）
        const sides = shapeSides(o.shape);
        ctx.beginPath();
        for (let i = 0; i <= sides; i++) {
          const ang = (i / sides) * Math.PI * 2 + o.phase;
          const x = p.sx + Math.cos(ang) * r;
          const y = p.sy + Math.sin(ang) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();

        if (o.highlighted) {
          ctx.globalAlpha = (0.3 + pulse * 0.45) * (0.4 + fog * 0.6);
          ctx.fillStyle = accentHex;
          ctx.fill();
        }

        ctx.globalAlpha = (o.highlighted ? 0.85 + pulse * 0.15 : 0.26 + pulse * 0.5) * (0.35 + fog * 0.65);
        ctx.strokeStyle = o.highlighted ? accentHex : '#8f9aad';
        ctx.lineWidth = o.highlighted ? 1.3 : 1;
        ctx.stroke();

        if (o.highlighted) {
          ctx.globalAlpha = (0.45 + pulse * 0.45) * (0.4 + fog * 0.6);
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, r * 1.5, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      ctx.globalAlpha = 1;
    };

    const onScroll = () => {
      const rect = wrap.getBoundingClientRect();
      const h = window.innerHeight;
      progress = clamp01((h - rect.top) / (h * 0.85));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    const loop = () => {
      if (!running) return;
      if (visible) draw(performance.now() / 1000);
      raf = requestAnimationFrame(loop);
    };

    if (animated) raf = requestAnimationFrame(loop);
    else draw(1.05); // 静态帧取一个扫描波正好扫到中段的时刻

    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 });
    io.observe(wrap);

    const onResize = () => { resize(); if (!animated) draw(1.05); };
    window.addEventListener('resize', onResize);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, [tier, accent]);

  return (
    /* 铺满整屏（用户要求：不要只占右半边出画）。
       文字可读性由两层保证：高亮对象全部在右半区，以及
       SignalFieldStage 里那层左亮右暗的渐变。 */
    <div ref={wrapRef} className="absolute inset-0 overflow-hidden" aria-hidden>
      {tier ? <canvas ref={canvasRef} className="block h-full w-full" /> : null}
    </div>
  );
}
