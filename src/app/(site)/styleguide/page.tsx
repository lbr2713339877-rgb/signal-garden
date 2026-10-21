import type { Metadata } from "next";
import { CATEGORIES } from "@/lib/categories";
import { GlassCard } from "@/components/ui/GlassCard";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { HeatNumber } from "@/components/ui/HeatNumber";
import { formatGrowth, formatCount, formatRank } from "@/lib/utils";

/**
 * Internal reference page. Not linked from the product.
 *
 * Its job is to make every design decision inspectable in one place, so that
 * later pages are assembled from proven primitives rather than re-invented.
 * If a component is not on this page, it does not exist yet.
 */

export const metadata: Metadata = {
  title: "Styleguide",
  robots: { index: false, follow: false },
};

const INK = [
  { token: "--ink-1", label: "F5F5F2", use: "标题" },
  { token: "--ink-2", label: "B8B8BD", use: "正文" },
  { token: "--ink-3", label: "77777E", use: "次要信息" },
  { token: "--ink-4", label: "44444B", use: "禁用 / 基线" },
];

const GLASS = [
  { level: 1 as const, token: "--glass-1", value: "0.045", use: "静置卡片" },
  { level: 2 as const, token: "--glass-2", value: "0.08", use: "悬停 / 浮层" },
  { level: 3 as const, token: "--glass-3", value: "0.14", use: "选中 / 焦点" },
];

const MOTION = [
  { name: "文本入场", value: "900ms", curve: "--e-out" },
  { name: "卡片悬停进入", value: "300ms", curve: "--e-out" },
  { name: "卡片悬停离开", value: "180ms", curve: "--e-out" },
  { name: "页面切换 · 出", value: "220ms", curve: "--e-inout" },
  { name: "页面切换 · 入", value: "480ms", curve: "--e-out" },
  { name: "数字滚动", value: "800ms", curve: "ease-out cubic" },
  { name: "筛选重排", value: "320ms", curve: "--e-inout" },
];

function Section({
  kicker,
  title,
  children,
  note,
}: {
  kicker: string;
  title: string;
  children: React.ReactNode;
  note?: string;
}) {
  return (
    <section className="border-t border-[var(--hairline)] py-[var(--s-9)] first:border-t-0">
      <p className="kicker">{kicker}</p>
      <h2 className="mt-3 text-[length:var(--fs-h2)] leading-[var(--lh-tight)] tracking-[var(--ls-title)] text-[var(--ink-1)]">
        {title}
      </h2>
      {note ? (
        <p className="mt-2 max-w-[62ch] text-[length:var(--fs-sm)] text-[var(--ink-3)]">
          {note}
        </p>
      ) : null}
      <div className="mt-8">{children}</div>
    </section>
  );
}

export default function StyleguidePage() {
  return (
    <main className="mx-auto max-w-[var(--container)] px-[var(--gutter)] pb-[var(--s-12)] pt-[var(--s-9)]">
      <header className="pb-[var(--s-8)]">
        <p className="kicker">SIGNAL GARDEN</p>
        <h1 className="mt-4 text-[length:var(--fs-h1)] leading-[var(--lh-display)] tracking-[var(--ls-display)] text-[var(--ink-1)]">
          设计系统
        </h1>
        <p className="mt-4 max-w-[62ch] text-[var(--ink-2)]">
          黑曜玻璃情报空间。这一页只做一件事：让每一个视觉决定都可被检查。
          后面的页面只从这里的原件拼装，不重新发明。
        </p>
      </header>

      {/* ---------------------------------------------------------------- */}
      <Section
        kicker="01 / SURFACES"
        title="玻璃只有三层"
        note="任何界面元素必须落在其中一层。第四种不透明度不会出现——这正是它不像后台仪表盘的原因。"
      >
        <div className="grid gap-4 md:grid-cols-3">
          {GLASS.map((g) => (
            <GlassCard key={g.level} level={g.level} className="p-6">
              <p className="kicker">GLASS {g.level}</p>
              <p className="num mt-3 text-[length:var(--fs-h3)] text-[var(--ink-1)]">
                {g.value}
              </p>
              <p className="mt-1 text-[length:var(--fs-sm)] text-[var(--ink-3)]">
                {g.token}
              </p>
              <p className="mt-4 text-[length:var(--fs-sm)] text-[var(--ink-2)]">
                {g.use}
              </p>
            </GlassCard>
          ))}
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section kicker="02 / INK" title="文本层级">
        <div className="grid gap-4 md:grid-cols-2">
          {INK.map((i) => (
            <div
              key={i.token}
              className="flex items-baseline justify-between border-b border-[var(--hairline)] pb-4"
            >
              <span
                className="text-[length:var(--fs-h3)] tracking-[var(--ls-title)]"
                style={{ color: `var(${i.token})` }}
              >
                从全网噪音里发现信号
              </span>
              <span className="num text-[length:var(--fs-xs)] text-[var(--ink-3)]">
                {i.label}
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        kicker="03 / CATEGORY"
        title="分类色只做标记，不做填充"
        note="分类色允许出现在：文字、1px 边缘、环境光斑、折线、节点、海报。禁止作为按钮底色或大面积填充。"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((c) => (
            <div
              key={c.key}
              data-category={c.key}
              className="flex items-center gap-4 rounded-[var(--r-md)] border border-[var(--hairline)] p-4"
            >
              {/* The ambient dot is the only place a category colour fills area. */}
              <span
                aria-hidden
                className="h-8 w-8 shrink-0 rounded-[var(--r-pill)]"
                style={{
                  background: `radial-gradient(circle, var(--cat) 0%, transparent 70%)`,
                  opacity: 0.7,
                }}
              />
              <div className="min-w-0">
                <p className="truncate text-[length:var(--fs-sm)] text-[var(--ink-1)]">
                  {c.name}
                </p>
                <p className="num mt-0.5 text-[length:var(--fs-xs)] text-[var(--ink-3)]">
                  {c.key} · {c.cssVar}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <CategoryTag key={c.key} category={c.key} />
          ))}
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        kicker="04 / RISK"
        title="风险不折叠、不隐藏"
        note="安全状态永远并列展示，不进 tab，不塞进折叠区。用户必须先看到它，再决定要不要装。"
      >
        <div className="flex flex-wrap gap-3">
          <RiskBadge level="safe" />
          <RiskBadge level="review" />
          <RiskBadge level="risk" />
          <RiskBadge level="unknown" />
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        kicker="05 / DATA"
        title="数字与热度"
        note="热度不是质量。四个指标性质不同，永远并列，永远不合并成一个分数。任何百分比都必须带时间范围。"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {/* The four-part metric row that every ranked card must carry. */}
          <GlassCard className="p-6">
            <p className="kicker">METRIC ROW</p>
            <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
              {[
                { k: "热度", v: <HeatNumber value={92} />, tone: "var(--ink-1)" },
                { k: "质量", v: "B+", tone: "var(--ink-1)" },
                { k: "维护", v: "活跃", tone: "var(--a-lime)" },
                { k: "安全", v: "需检查", tone: "var(--risk-review)" },
              ].map((m) => (
                <div key={m.k}>
                  <p className="kicker">{m.k}</p>
                  <p
                    className="num mt-2 text-[length:var(--fs-h3)]"
                    style={{ color: m.tone }}
                  >
                    {m.v}
                  </p>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard category="skill" className="p-6">
            <p className="kicker">GROWTH</p>
            <div className="mt-4 space-y-3">
              <p className="num text-[length:var(--fs-h2)] text-[var(--cat)]">
                {formatGrowth(328, "24h")}
              </p>
              <p className="num text-[length:var(--fs-sm)] text-[var(--ink-2)]">
                {formatGrowth(1240, "7d")} · {formatCount(12800)} stars
              </p>
              <p className="num text-[length:var(--fs-xs)] text-[var(--ink-3)]">
                RANK {formatRank(1)} · {formatRank(10)}
              </p>
            </div>
            <p className="mt-5 border-t border-[var(--hairline)] pt-4 text-[length:var(--fs-sm)] text-[var(--ink-2)]">
              过去 24 小时新增 320 Stars，最近 7 天有 18 次提交，并在 Hacker
              News 出现讨论。
            </p>
          </GlassCard>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        kicker="06 / CARD"
        title="卡片与悬停"
        note="悬停上移 8px，边缘染上分类色，玻璃提亮一档。进入 300ms，离开 180ms——离开必须比进入快，否则会显得黏手。"
      >
        <div className="grid gap-4 md:grid-cols-2">
          {CATEGORIES.slice(0, 2).map((c, i) => (
            <GlassCard
              key={c.key}
              category={c.key}
              lift
              className="group p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="num text-[length:var(--fs-sm)] text-[var(--ink-4)]">
                  {formatRank(i + 1)}
                </span>
                <CategoryTag category={c.key} />
              </div>
              <h3 className="mt-6 text-[length:var(--fs-h3)] tracking-[var(--ls-title)] text-[var(--ink-1)]">
                {i === 0 ? "Browser Use" : "Frontend Design"}
              </h3>
              <p className="mt-2 text-[var(--ink-2)]">
                {i === 0
                  ? "让 AI 真正操作浏览器。"
                  : "把审美变成可复用的前端能力。"}
              </p>
              <p className="num mt-5 text-[var(--cat)]">
                {formatGrowth(i === 0 ? 328 : 214, "24h")}
              </p>
            </GlassCard>
          ))}
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        kicker="07 / TYPE"
        title="字体三轨"
        note="拉丁标题 Inter Tight，中文 PingFang SC，所有数字与命令用 JetBrains Mono 并开启 tabular-nums，数值变化时不会抖动。"
      >
        <div className="space-y-6">
          <div>
            <p className="kicker">DISPLAY · INTER TIGHT</p>
            <p className="mt-3 text-[length:var(--fs-display)] leading-[var(--lh-display)] tracking-[var(--ls-display)] text-[var(--ink-1)]">
              Something new is happening.
            </p>
          </div>
          <div>
            <p className="kicker">CJK BODY · PINGFANG SC</p>
            <p className="cjk mt-3 max-w-[62ch] text-[var(--ink-2)]">
              每天，从全网新项目里筛出真正值得打开的项目。热度分不是质量分，
              每个百分比都必须带上它的时间范围。
            </p>
          </div>
          <div>
            <p className="kicker">MONO · JETBRAINS MONO</p>
            <p className="num mt-3 text-[var(--ink-1)]">
              +328% / 24h · 12.8k stars · 82/100
            </p>
          </div>
          <div>
            <p className="kicker">WORDMARK</p>
            <p className="wordmark mt-3">Signal Garden</p>
          </div>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        kicker="08 / MOTION"
        title="动效时长与曲线"
        note="进入统一用 --e-out。动效服务于理解，不服务于炫技；任何动效结束后必须停稳。"
      >
        <div className="overflow-hidden rounded-[var(--r-md)] border border-[var(--hairline)]">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--hairline)]">
                <th className="kicker px-5 py-3 font-normal">场景</th>
                <th className="kicker px-5 py-3 font-normal">时长</th>
                <th className="kicker px-5 py-3 font-normal">曲线</th>
              </tr>
            </thead>
            <tbody>
              {MOTION.map((m) => (
                <tr
                  key={m.name}
                  className="border-b border-[var(--hairline-faint)] last:border-b-0"
                >
                  <td className="px-5 py-3 text-[length:var(--fs-sm)] text-[var(--ink-2)]">
                    {m.name}
                  </td>
                  <td className="num px-5 py-3 text-[length:var(--fs-sm)] text-[var(--ink-1)]">
                    {m.value}
                  </td>
                  <td className="num px-5 py-3 text-[length:var(--fs-xs)] text-[var(--ink-3)]">
                    {m.curve}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[length:var(--fs-sm)] text-[var(--ink-3)]">
          在系统开启「减少动态效果」时：视差与漂浮全部关闭，只保留淡入，
          数字直接显示终值，sticky 叠层退回普通列表。信息不减少任何一条。
        </p>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        kicker="09 / RULES"
        title="禁令清单"
        note="这些是让产品保持高级感、不滑向廉价科技风的原因。"
      >
        <ul className="grid gap-3 md:grid-cols-2">
          {[
            "按钮不发光，文字不加 text-shadow，图标不加投影",
            "圆角上限 14px，卡片 10px，按钮 6px",
            "不使用紫色渐变按钮",
            "不使用黄色 + 蓝色的金融终端配色",
            "不做满屏白色卡片",
            "不使用巨大圆形雷达图",
            "分类色不作为大面积填充",
            "不使用夸张的 3D 翻转",
            "数字动画结束后必须停稳，不允许永久跳动",
            "任何百分比都必须带时间范围",
          ].map((r) => (
            <li
              key={r}
              className="flex gap-3 text-[length:var(--fs-sm)] text-[var(--ink-2)]"
            >
              <span aria-hidden className="text-[var(--ink-4)]">
                —
              </span>
              {r}
            </li>
          ))}
        </ul>
      </Section>
    </main>
  );
}
