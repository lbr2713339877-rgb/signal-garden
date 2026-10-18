# Signal Garden / 今日信号 — 产品与工程方案 v1.0

> 每天 5 分钟，从全网噪音中发现真正值得打开的 AI Skill 和项目。
> 所有内容来自自动采集，用户不可提交、不可编辑。

---

## 0. 前置约束（已核实的环境）

| 项 | 结论 | 影响 |
|---|---|---|
| `/Users/rayn/tedx` | 已有 shirts / videos 项目，非本产品目录 | 本产品独立建目录 |
| `/Users/rayn/signal radar` | 空目录 | 作为本项目根目录 |
| Node / pnpm | v24.18.0 / 11.16.0 | 可用 Next.js 15 + React 19 |
| Postgres | 本地未安装 | 本地开发走 SQLite/libSQL，生产走 Postgres（Drizzle 双驱动） |
| Docker | 未安装 | 不上本地容器，定时任务走 GitHub Actions / 托管 Cron |
| GitHub | 未初始化 git | 第一步 `git init` |

**技术选型修正**：原方案写 PostgreSQL + Prisma。本地无 Postgres，改为 **Drizzle ORM + libSQL/SQLite（本地）→ Postgres（生产）**。Drizzle 的 schema 与查询在双驱动间迁移成本最低，Prisma 的 provider 切换需要重生成迁移。搜索用 SQLite FTS5（本地）/ Postgres `tsvector`（生产），接口层抽象成 `searchProjects()`，后期换 Meilisearch 不动上层。

---

## 1. 产品信息架构

### 1.1 内容实体（三层，这是整个产品的骨架）

```
SOURCE SIGNAL  (原始信号，不可展示)
   │  github_repo / hn_story / ph_launch
   │  属性：source_url, raw_hash, fetched_at, payload
   ▼  normalize + dedupe
PROJECT  (仓库级实体，页面主对象)
   │  一个 GitHub 仓库 / 一个 PH 产品 = 一个 Project
   │  canonical: github_id > canonical_url > domain > ph_slug > name+author
   ▼  1:N
SKILL  (能力级实体，详情页主对象)
   │  一个 SKILL.md = 一个 Skill
   │  anthropics/skills → frontend-design / pdf / spreadsheets / documents
   ▼  scoring + ai_enrichment
DAILY_SIGNAL  (每日快照，榜单/归档/趋势的唯一来源)
      记录：rank, heat_score, 各项得分, 上榜原因, 生成时间
```

关键设计：**热度分不是项目的属性，而是「项目 × 日期」的属性**。分数只存在于 `daily_signal`，`project` 上只保留 `heat_score_latest` 缓存用于排序。所有页面上的数字（+328% / 24h）必须带 `window` 和 `as_of`，不允许出现无时间范围的裸分数。

### 1.2 页面清单（10 个路由 + 1 后台）

| # | 路由 | 页面 | 主实体 | 核心任务 |
|---|---|---|---|---|
| 1 | `/` | 首页 | daily_signal | 5 秒理解产品 + 30 秒看到一个项目 |
| 2 | `/today` | 今日信号 | daily_signal | 看今天的 10 条 + 为什么上榜 |
| 3 | `/p/[slug]` | Project 详情 | project | 判断「要不要用」 |
| 4 | `/p/[slug]/s/[skill]` | Skill 详情 | skill | 判断「这个能力装不装」 |
| 5 | `/c/[category]` | 分类页 | project | 按赛道扫 |
| 6 | `/trends` | 趋势页 | 时序指标 | 看增长曲线 / 避免短期噪音 |
| 7 | `/archive` | 历史归档 | daily_signal | 回溯「某天的榜」 |
| 8 | `/search` | 搜索 | project/skill | 按能力/平台/难度筛 |
| 9 | `/saved` | 收藏 | user_save | 我的清单 |
| 10 | `/settings` | 设置 | user_pref | 订阅与降噪 |
| 11 | `/status` | 系统状态 | job_run | 数据源健康（公开可访问） |
| — | `/admin` | 后台 | — | 运营干预，无视觉要求 |

`/status` 公开是刻意的：一个「告诉你什么是信号」的产品，必须自己对数据中断诚实。当连续 3 次采集失败，首页顶部出现一条静默的细线提示，而不是假装正常。

### 1.3 导航

顶部只有一条 56px 的玻璃条，左侧 wordmark `SIGNAL GARDEN`，中间 4 个入口（Today / Categories / Trends / Archive），右侧搜索图标 + 收藏。**不做侧边栏**。移动端收敛为 wordmark + 搜索 + 一个展开为全屏玻璃层的菜单。

---

## 2. 页面结构详述

### 2.1 首页 —— 五幕滚动叙事

首页不做卡片列表，做一次连续的空间推进。五幕共用一个 Canvas 层（光点场），DOM 层在其上方做内容。

**幕一 The Signal（100vh）**

```
[layer 0]  纯黑 #050505
[layer 1]  16 个漂浮光点，半径 2–4px，blur 8px，各带分类色
           30–60s 极慢漂移，正弦轨迹，reduced-motion 下静止
[layer 2]  Something new
           is happening.
           每天，从全网新项目里筛出真正值得打开的 10 个。
           TODAY / 10 SIGNALS
```

入场序列（总计 1.6s）：光点 0→1 opacity（0, 900ms）→ 主标题 blur(12px)→blur(0) + y 24→0（120ms 起，900ms，ease-out-expo）→ 副文案 y 24→0（+160ms）→ 底部计数 fade（+160ms）。

滚动 0→40vh：光点向中心聚拢（位移插值），其中一枚放大到 1.4 倍、其余降至 18% opacity，第一张项目卡从 `backdrop-filter: blur(40px)` 过渡到 `blur(0)`，卡片出现。

**幕二 The Convergence（120vh）**

左侧四个源节点 `GITHUB / HACKER NEWS / PRODUCT HUNT / COMMUNITY`，右侧中心项目卡。SVG path 连接，每条线上有 2–3 个 2px 粒子沿路径运动（`offset-path` + CSS animation，步进 6–9s 循环）。四条线依次在 0/15/30/45% 滚动进度点亮。中心卡片在此幕结束时达到 full opacity，背后出现分类色玻璃光晕（径向渐变，opacity 0.14，blur 120px）。

粒子视觉克制：不加发光滤镜，不做爆炸。这是「汇聚」，不是「爆炸」。

**幕三 Editor's Picks（sticky 叠层，1200vh 滚动区）**

10 张卡纵向叠层。每张卡 `position: sticky; top: 96px`，滚动时前一张 `scale(0.94) translateY(-40px) opacity(0.4)`，后一张从 `y: 80px` 浮现。左侧固定序号 `01`–`10`（不随卡片滚动）。卡片内含：项目名 / 一句话（30–60 字）/ `+328% · 24h` / 分类标签 / 适合人群 / 难度星级 / 查看详情。

**这是全站唯一使用 sticky 长滚动区的地方**，其他地方保持正常滚动节奏。不做满屏都是 pinned section。

**幕四 The Noise（150vh）**

`New AI Tool / New MCP / New Agent / ...` 词条以递增速度从随机位置出现，速度从 400ms 加速到 60ms 间隔，`blur` 从 0 递增到 8px，opacity 叠加成灰色噪墙。滚动到 78% 时，全部在 240ms 内缩到 opacity 0 并归位到中心消失。留下：

```
We kept the signal.
我们只留下真正值得看的部分。
```

**幕五 Explore by Intent（100vh + 展开）**

六个意图入口（不是技术分类）：让 Claude 替我工作 / 做一个更好看的网页 / 自动处理重复任务 / 发现可直接安装的 Skill / 找一个值得研究的开源项目 / 让 AI 自动操作浏览器。

hover 时：该意图映射到的项目从背景提亮（opacity 0.18→1），其他项目降至 0.18，背景环境光色相切到该分类色（600ms 过渡），标题做 setext 式平滑替换（旧标题上移 12px 淡出，新标题从下方 12px 淡入）。

### 2.2 分类页 —— 动态画廊

顶部是分类词 + 一句人话（`DESIGN & UI` / `正在变热的设计能力。`）+ 两个统计（`本周新增 38 个项目` `平均热度增长 +214%`，数字从 0 滚动上升）。

**海报不是同一个模板换色**。每个 Skill 按 `skill_type` 渲染一套抽象视觉：

| 类型 | 视觉语言 |
|---|---|
| UI / Design | 界面结构：骨架屏矩形层级线 |
| Motion | 时间轴：轨道 + 关键帧菱形 |
| Figma | 画板：多层 frame 叠加偏移 |
| Frontend | 浏览器窗口：地址栏 + 视口矩形 |
| UX | 流程图：节点 + 贝塞尔连线 |
| MCP | 协议拓扑：双向箭头 + 端口圆点 |
| Data | 表格网格的抽象化 |

海报用内联 SVG + CSS 变量着色，不引入图片资源。hover：海报 `scale(1.03)`、玻璃层从底部展开 40%、露出中文简介 + 热度 + 难度 + `查看项目`。整个 hover 300ms。

### 2.3 详情页 —— 六段档案

1. **Hero**：项目名 + 一句话 + 右侧 `HEAT SCORE 82/100` + `+328% / 24h`。背景是抽象的操作动效（光标移动→输入框填充→点击涟漪→页面位移），16s 循环，纯 CSS/SVG，无外部视频。
2. **What it does**：能力分镜，每项随滚动淡入（`读取网页 / 理解页面结构 / 执行点击 / 填写表单 / 提取结果`）。
3. **Why now**：时间线，滚动进度驱动 path 绘制（`stroke-dashoffset`）。
4. **Who is it for**：抽象人物卡（几何图形 + 场景线），不是头像。
5. **Install**：命令块 + 复制按钮。复制成功后按钮文字切到 `Copied to clipboard`，同时一道斜向高光扫过（400ms），2s 后回落。旁边并列：支持平台 / 难度 / 依赖 / API Key 要求 / 是否需本地运行时。
6. **Risk & Limits**：**不可折叠，不放在 tab 后面，不弱化。** 风险等级用冷白/琥珀/珊瑚三档，逐条列出触发原因（`读取 API Key` → `仓库中存在读取 ~/.env 的代码路径`，附 code 引用）。

### 2.4 后台 `/admin`

纯功能，无视觉要求。四个面板：任务状态（每个 job 的 last_run / duration / status / last_error）、解析结果队列（可隐藏项目 / 改分类 / 重生成摘要 / 标记风险 / 标记归档）、数据源健康（GitHub rate limit 剩余 / HN 可达性 / PH 配额）、异常（热度突变 > 500%、AI 调用消耗、邮件送达率）。

---

## 3. 设计系统

### 3.1 Token 骨架

```css
:root {
  /* 空间 */
  --bg-void:    #050505;
  --bg-deep:    #0B0B0D;
  --bg-raised:  #111114;

  /* 文本 */
  --ink-1: #F5F5F2;  /* 标题 */
  --ink-2: #B8B8BD;  /* 正文 */
  --ink-3: #77777E;  /* 次要 */
  --ink-4: #44444B;  /* 元数据/边框基线 */

  /* 玻璃 */
  --glass-1: rgba(255,255,255,0.045);
  --glass-2: rgba(255,255,255,0.08);
  --glass-3: rgba(255,255,255,0.14);

  /* 描边 */
  --hairline:        rgba(255,255,255,0.06);
  --hairline-hover:  rgba(255,255,255,0.12);

  /* 分类色 */
  --c-skill:    #67E8F9;  /* Cyan */
  --c-agent:    #A78BFA;  /* Violet */
  --c-devtool:  #8B9CFF;  /* Blue Violet */
  --c-design:   #FB7185;  /* Coral */
  --c-browser:  #BEF264;  /* Lime/Mint */
  --c-media:    #FDBA74;  /* Orange */
  --c-data:     #93C5FD;  /* Soft Blue */
  --c-security: #E8ECEF;  /* Cold White */

  /* 半径：克制 */
  --r-sm: 6px;  --r-md: 10px;  --r-lg: 14px;  --r-pill: 999px;

  /* 动效 */
  --e-out:    cubic-bezier(0.16, 1, 0.3, 1);   /* expo out，主曲线 */
  --e-inout:  cubic-bezier(0.65, 0, 0.35, 1);
  --d-fast: 180ms; --d-base: 300ms; --d-slow: 600ms; --d-narr: 900ms;
}
```

### 3.2 玻璃层规则（强制）

只有三层玻璃，不允许第四种。玻璃 = `background: var(--glass-N)` + `backdrop-filter: blur(20px) saturate(140%)` + `1px solid var(--hairline)`。

**发光禁令**：全站只有三种允许的发光用法 —— ① 分类色环境光斑（径向渐变，opacity ≤ 0.16，blur ≥ 100px，只出现在 section 背景）；② hover 时卡片边缘 1px 的分类色高光；③ 首屏光点。**按钮不加 glow，文字不加 text-shadow，图标不加 drop-shadow。**

**圆角禁令**：卡片 10px，按钮 6px，pill 只用 tag。不做 20px+ 的大圆角。

### 3.3 字体

| 用途 | 字体 |
|---|---|
| 中文正文/标题 | `"PingFang SC", "Noto Sans SC", system-ui` |
| 拉丁标题/品牌 | `"Inter Tight"`, fallback `system-ui`，字重 500/600，letter-spacing `-0.02em` |
| 数据/编号/代码 | `"JetBrains Mono"`，tabular-nums，字重 400/500 |

品牌词 `SIGNAL GARDEN` 用 Inter Tight 600，全大写，letter-spacing `0.18em`，14px。首屏主标语用 Inter Tight 500，clamp(40px, 7vw, 92px)，行高 0.98，letter-spacing `-0.03em`。

**中英混排基线**：中文行高 1.75，拉丁行高 1.5，混排容器用 1.65 折中并加 `text-spacing-trim` 思路的手动 margin（标点前不换行用 `word-break: keep-all` 处理）。

### 3.4 布局

12 列，容器 max-width 1280px，gutter 24px（移动 20px）。竖向节奏用 8px 基准：section 间距 160px（桌面）/ 96px（移动）。**大面积留白是主色的一部分**，首屏文字区左右各留至少 25% 空。

---

## 4. 色彩与字体方案（使用规则）

| 色彩 | 允许出现在 | 禁止出现在 |
|---|---|---|
| 分类色 | 标签文字、1px 边缘、环境光斑、折线、节点、海报配色 | 大面积填充、按钮底色 |
| Ink 四级 | 全部文本 | — |
| Glass 三级 | 卡片、浮层、导航、弹层 | 页面底色 |

分类色永不作为纯色块背景。唯一例外：分类页海报内部（因为海报本身是抽象视觉，不是 UI 组件），但饱和度压到 70%。

---

## 5. 动效时间线

### 5.1 全局参数

| 场景 | 时长 | 曲线 |
|---|---|---|
| 文本入场（y 24→0 + blur） | 900ms | `--e-out` |
| 卡片序列入场 | 每张 +100ms stagger，单张 600ms | `--e-out` |
| hover 上移（-8px） | 220ms | `--e-out` |
| hover 离开 | 180ms | `--e-inout` |
| 布局重排（筛选/搜索） | 320ms FLIP | `--e-inout` |
| 页面切换 | 出 220ms / 入 480ms | 黑场 + 光斑 |
| 数字滚动 | 800ms，cubic ease-out | — |
| 折线绘制 | 1200ms stroke-dashoffset | `--e-out` |

### 5.2 页面切换协议

无浏览器式白闪。点击链接 → 当前页 opacity 1→0 + `scale(0.99)`（220ms）→ 覆盖 `#050505` 全屏层 → 该页面主分类色的光斑从点击坐标位置扩散（480ms，opacity 峰值 0.10）→ 新页 `y: 12px → 0` + opacity 0→1（480ms）。用 Next.js App Router + View Transitions API（Chrome）降级为 Framer Motion AnimatePresence（Safari/Firefox）。

### 5.3 数据动效

数字从 0 增长到目标值，800ms，**只跑一次**，`useInView` 触发。热度变化用 2px 的柔和 pulse（opacity 0.6↔1，1.6s，跑 3 次后停）。趋势线绘制完成后停稳。**任何数字不允许永久跳动或抖动。**

### 5.4 reduced-motion 降级表

| 元素 | 正常 | `prefers-reduced-motion: reduce` |
|---|---|---|
| 光点场 | 持续漂移 | 静态、保留位置 |
| 视差 | 启用 | 全部关闭 |
| 首屏入场 | blur + y + stagger | 只保留 opacity 淡入 200ms |
| sticky 叠层 | 缩放位移 | 改为普通纵向列表 |
| 数字滚动 | 0→N 增长 | 直接显示终值 |
| hover 位移 | -8px | 只改边框透明度 |
| 页面切换 | 光斑扩散 | 直接切换 |
| Noise 幕 | 加速噪墙 | 静态三行文字 + 直接显示结论 |

信息完整性在降级状态下不减少任何一条。

---

## 6. 数据采集架构

### 6.1 目录

```
src/
├── collectors/
│   ├── github/{search.ts,repo.ts,tree.ts,rate-limit.ts}
│   ├── hackernews/{topstories.ts,algolia.ts}
│   └── producthunt/{posts.ts}
├── parsers/
│   ├── skill-md-parser.ts     # YAML frontmatter + body 结构
│   ├── readme-parser.ts       # 安装方式/平台/许可证/依赖抽取
│   ├── manifest-parser.ts     # package.json / pyproject / .mcp.json
│   └── risk-scanner.ts        # 危险命令模式匹配
├── normalizers/
│   ├── dedupe.ts              # 七级去重
│   ├── fingerprint.ts         # sha256(canonical_url + content_hash)
│   └── category.ts            # 主分类 + 标签
├── scoring/{heat.ts,freshness.ts,quality.ts,normalize.ts}
├── ai/{classify.ts,summarize.ts,risk-review.ts,guard.ts}
├── jobs/{discover.ts,enrich.ts,score.ts,enrich-ai.ts,publish.ts}
└── db/{schema.ts,client.ts,queries/}
```

### 6.2 采集任务与调度

| 任务 | 频率 | 内容 | 落库 |
|---|---|---|---|
| `discover` | 每 6h | GitHub 搜索矩阵 / HN top+Show HN / PH posts | `source_signal`（指纹去重） |
| `enrich` | 每小时 | README / SKILL.md / skills 目录 / manifest / 风险扫描 / 内容哈希 | `project`, `skill`, `repo_snapshot` |
| `score` | 每日 02:00 | Star/Fork/Issue/Commit/外部提及 → 24h、7d 增长 → 热度 | `metric_daily`, `daily_signal` |
| `enrich-ai` | 每日 05:00 | 对候选生成中文内容（带证据约束） | `ai_content` |
| `publish` | 每日 08:00 | 榜单发布 / 首页缓存 / 搜索索引 / RSS / 邮件 / 归档 | `daily_signal.published_at` |
| `verify-links` | 每日 04:00 | 链接可达性 + 仓库存活 | `project.link_status` |

实现为**普通 Node 脚本地图**，本地 `pnpm job discover`，生产 GitHub Actions cron 调 `pnpm job <name>`。不使用队列中间件（第一版）。

### 6.3 GitHub 采集矩阵

```
filename:SKILL.md
path:skills
topic:claude-code
topic:agent-skills
topic:mcp
topic:ai-agents
"Claude Code skill" in:name,description,readme
"agent skill" in:readme
created:>{date}  stars:>5
pushed:>{date}
```

认证用 `GITHUB_TOKEN`（GraphQL 优先，一次拿 star/fork/issue/commit 全量，省 REST quota）。**每次采集必须记录 `rate_limit.remaining`，低于 15% 时该轮降级为仅 GraphQL 分页**。

### 6.4 Skill 识别与置信度

| 证据 | 加分 | 归类 |
|---|---|---|
| 仓库含 `SKILL.md` | 0.9 | verified skill |
| 含 `skills/` 目录且内含 SKILL.md | 0.85 | verified skill |
| README 明确写 "Claude Skill" | 0.7 | likely |
| MCP SDK 依赖 + MCP 定位 / `server.json` | 0.8–0.85 | MCP |
| `.mcp.json`（仓库自己要用的 MCP 配置） | 0.3 | 弱证据 |
| 仓库名含 skill | 0.4 | candidate |
| 仅描述含 AI | 0.2 | unknown |

`skill_confidence = max(weights)`，取最强证据，不求和。求和会让「名字含 skill + 描述提到 AI」这类弱信号累加成 Skill，正是需求明确禁止的按名字判断。**低于 0.5 时 `skill_type` 强制为 `Unknown`，且不出现在 Skill 分类页**，只能出现在「开发工具」兜底分类里。只有 prompt / workflow 文本的仓库，`skill_type = Prompt Pack`，永不标 Skill。

---

## 7. 数据库结构

用 Drizzle。核心表 11 张：

```ts
// ---------- 原始层 ----------
source_signal {
  id            pk
  source        enum(github|hackernews|producthunt|community)
  source_id     text      // gh repo id / hn objectID / ph slug
  source_url    text
  raw_hash      text      // sha256(payload) 用于跳过重复
  payload       json
  fetched_at    ts
  processed_at  ts | null
  unique(source, source_id, raw_hash)
}

// ---------- 项目层 ----------
project {
  id                   pk
  canonical_project_id text unique   // 主去重键
  slug                 text unique
  name, owner, full_name
  primary_url          text
  domain               text | null
  description          text
  project_kind         enum(repo|product|story_derived)
  fork_of              text | null
  mirror_of            text | null
  duplicate_of         text | null
  is_archived          bool
  hidden               bool           // 后台隐藏
  link_status          enum(ok|dead|redirect|unknown)
  category             text           // 主分类
  tags                 text[]         // 辅助标签
  difficulty           enum(one_click|simple_config|needs_api_key|needs_local|needs_dev|expert)
  status               enum(new|surging|steady|slowing|unstable|stale|archived)
  license              text | null
  pricing              text | null
  requires_api_key     bool
  requires_local_runtime bool
  requires_docker      bool
  security_level       enum(safe|review|risk|unknown)
  parse_state          enum(pending|parsed|failed)
  content_hash         text
  heat_score_latest    real           // 排序缓存
  quality_grade        text           // A/B+/B/C
  created_at, updated_at, last_verified_at
  index (category, heat_score_latest desc), index (status)
}

skill {
  id           pk
  project_id   fk
  slug         text
  name         text
  skill_confidence real
  skill_type   enum(skill|mcp|agent|prompt_pack|workflow|library|framework|template|unknown)
  is_verified_skill bool
  has_skill_md bool
  has_installation bool
  supported_agents text[]
  frontmatter  json
  body_excerpt text
  content_hash text
  unique(project_id, slug)
}

repo_snapshot {   // 时序指标，趋势页的唯一来源
  id pk
  project_id fk
  captured_at  ts
  stars, forks, open_issues, watchers   int
  commits_7d   int
  releases_30d int
  contributors int
  index (project_id, captured_at)
}

external_mention {
  id pk
  project_id fk
  source enum(hackernews|producthunt|reddit|blog)
  url, title, points, comments
  published_at
  unique(project_id, source, url)
}

// ---------- 派生层 ----------
daily_signal {
  id pk
  date        date
  project_id  fk
  skill_id    fk | null
  rank        int
  heat_score  real
  breakdown   json   // {star_growth:…, growth_rate:…, …corrections:[…]}
  reason      text   // 「过去 24 小时新增 320 Stars，7 天 18 次提交，HN 出现讨论」
  window      text   // '24h' | '7d'
  is_published bool
  unique(date, project_id)
}

ai_content {
  id pk
  project_id fk
  locale      text default 'zh'
  one_liner   text           // 30–60 字
  problem     text           // 100–150 字
  target_users text[]
  why_now     json           // ≤3 条
  not_for     json           // ≥1 条
  limits      json
  install_hint text
  risk_note   text
  recommendation enum(try|watch|caution|avoid)
  evidence    json           // 每个断言的来源引用
  model       text
  generated_at ts
  verified_by_human bool
  unique(project_id, locale)
}

// ---------- 用户层 ----------
user { id, email, created_at, digest_enabled, digest_hour, locale }
user_save { user_id, target_type(project|skill), target_id, created_at }
user_subscription { user_id, kind(category|keyword|platform), value }
user_feedback {
  id, user_id, project_id,
  kind enum(dead_link|wrong_category|inaccurate_desc|security_risk|unmaintained),
  note, status enum(pending|reviewed|rejected), created_at
}

// ---------- 运维层 ----------
job_run { id, job, started_at, finished_at, status, items_in, items_out, last_error, meta json }
data_source_health { source, last_ok_at, last_error, quota_remaining, latency_ms }
```

---

## 8. 热度算法

### 8.1 指标归一化（关键：绝对值不可比）

每一项都先转成**分布内的分位/对数归一化**，避免大项目永久霸榜。

```
star_growth_24h    = stars_now - stars_24h_ago
star_growth_7d     = stars_now - stars_7d_ago
growth_rate        = star_growth_7d / max(stars_7d_ago, 1)
commit_activity_7d = commits in last 7d
issue_activity     = issues_opened_7d + comments_7d
external_mentions  = Σ (HN points/10 + HN comments/5 + PH votes/20) 近 7d
```

归一化：`score(x) = 100 * log1p(x) / log1p(p95(x))`，p95 取当日全量候选池的 95 分位。这样每一项都在 0–100，且头部不会被单一大项目拉爆。

```
project_freshness  = exp(-age_days / 30) * 100          // 30 天半衰
documentation_quality = 0.4*has_readme + 0.3*has_install + 0.2*has_examples + 0.1*has_license   → ×100
skill_completeness = 0.5*has_skill_md + 0.3*has_frontmatter + 0.2*has_install_in_skill_md      → ×100
```

### 8.2 基础分（与需求一致）

```
heat = star_growth_score    * 0.30
     + growth_rate_score    * 0.20
     + commit_activity_score* 0.15
     + external_discussion_score * 0.15
     + freshness_score      * 0.10
     + documentation_score  * 0.10
```

### 8.3 修正项（乘性，可叠加，下限 0.3）

```
×1.10  有 SKILL.md 且 frontmatter 完整
×1.05  有明确安装说明（命令可解析）
×1.05  有可运行示例
×1.05  近 30 天有维护者提交
×0.80  超过 90 天无提交
×0.90  缺乏 README 或 README < 300 字
×0.80  疑似复制品（文本相似度 > 0.85 于已知仓库，或 fork_of 非空且无增量提交）
×0.90  安全风险未知（risk_scan 未完成或命中可疑模式未人工确认）
×0.70  已被用户反馈标记 dead_link 且未恢复
```

最终 `heat_score ∈ [0, 100]`。

### 8.4 展示规则（这是产品可信度的核心）

榜单卡片**必须**展示 `reason`，从 breakdown 里挑贡献最大的 2–3 项自动生成中文句子：

> 过去 24 小时新增 320 Stars，最近 7 天有 18 次提交，并在 Hacker News 出现讨论。

同时并列展示四个**不同性质**的指标，绝不混为一谈：

```
热度   92         ← 时间敏感，会掉
质量   B+         ← 稳定，来自文档/示例/维护
维护   活跃        ← 近 30 天提交节奏
安全   需检查       ← 风险扫描结果
```

页面任何位置出现的百分比都必须带 `window` 标签（`+328% / 24h`）。**禁止出现裸的「+328%」**。

### 8.5 反脆弱规则

- 新项目保护期：创建 < 14 天的仓库，`star_growth_score` 用绝对值而非增长率（避免 3 star → 30 star 的「1000% 增长」霸榜），并在卡片上标注 `新发布`。
- 单源依赖惩罚：若一个项目仅有 GitHub 信号、无任何外部提及，则 `status` 不得标为 `surging`，最高 `steady`。
- 突变检测：单日热度 > 前 7 日均值 5 倍时，进入人工审核队列，不自动上榜首。

---

## 9. AI 内容生成流程

### 9.1 原则

**AI 只做「翻译和归纳」，不做「判断和发现」。** 所有数字、许可证、平台兼容性、安全结论来自解析器，不来自模型。模型唯一被允许的加工是：把已有事实改写成中文。

### 9.2 流程

```
候选项目
  ▼
[1] 证据打包 evidence bundle
    ├─ github_api:  stars/forks/issues/commits/license/created_at/language
    ├─ readme:      截断到 8k tokens，优先保留 Install / Usage / Requirements 段
    ├─ skill_md:    frontmatter 全量 + body 摘要
    ├─ manifest:    package.json / pyproject / .mcp.json 的关键字段
    ├─ risk_scan:   命中的模式 + 命中的文件路径与行号
    └─ external:    HN title/points/comments, PH tagline/votes
  ▼
[2] 生成（分 4 次调用，每次只产出一个字段组，降低幻觉）
    classify.ts     → category, tags, difficulty, target_users
    summarize.ts    → one_liner, problem, why_now, not_for, limits
    risk-review.ts  → risk_note, security_level 建议
    recommend.ts    → recommendation + 理由
  ▼
[3] Guard 校验（硬性，不过则丢弃重生成，最多 2 次）
    ├─ 数字一致性：文中出现的任何数字必须能在 evidence 里找到
    ├─ 许可证一致性：提到的 license 必须等于 github_api.license.spdx_id
    ├─ 平台一致性：提到的平台必须 ∈ supported_agents（解析器产出）
    ├─ 长度：one_liner ∈ [30,60] 中文字符；problem ∈ [100,150]
    ├─ 禁用词：删除「最好的/最强大的/革命性/必装/神器/碾压」
    ├─ 安全：risk_note 不得出现 evidence 中不存在的风险，也不得省略已命中的高风险项
    └─ 失败 → 落 ai_content.recommendation = 'watch'，摘要在 UI 上标「AI 生成，待核验」
  ▼
[4] 落库 ai_content + evidence 引用，前端「为什么这么说」可展开看来源
```

### 9.3 前端表达约束

- AI 生成区块有统一的浅色标注 `AI 摘要 · 依据 README 与 GitHub 数据`
- 推荐等级为 `avoid` 或 guard 未通过时，不出现在 Top 10
- 发布前检查 10 条规则（需求第二十条）作为 `publish` job 的硬 gate，任一条不通过则 `status='待验证'`，只能进归档不进榜单。

---

## 10. MVP 开发计划

### Phase 0 — 地基（0.5 天）
`git init`、Next.js 15 + TS + Tailwind v4 + Drizzle(libSQL) 骨架、设计 token 落 `app/tokens.css`、字体、`/styleguide` 内部页面（把所有 token、玻璃层、分类色、按钮、卡片、动效时长实体化，供后续对照）。

### Phase 1 — 数据管道跑通（2 天）
GitHub collector（REST+GraphQL）→ `source_signal` → 去重 → `project`。SKILL.md parser + skill 识别。**验收：真实拉到 ≥ 200 个仓库，正确识别出 ≥ 20 个 verified skill。** 这一阶段不碰 UI。

### Phase 2 — 评分与 AI（1.5 天）
`repo_snapshot` 每日快照、热度公式、daily_signal 生成、reason 生成器。AI enrichment 四段调用 + guard。**验收：能产出一天真实的 Top 10，每条有 reason 和中文摘要。**

### Phase 3 — 视觉系统与首页叙事（3 天）
设计系统组件（GlassCard / Hairline / CategoryTag / HeatNumber / DifficultyStars / RiskBadge）。首页五幕。**这是最花时间也最决定成败的部分。**

### Phase 4 — 页面（2.5 天）
`/today`、`/p/[slug]`、`/c/[category]`、`/archive`。分类页的七套海报视觉。

### Phase 5 — 搜索 / 收藏 / 订阅（1.5 天）
FTS5 搜索 + 筛选器（玻璃浮层 + FLIP 重排）、本地收藏（匿名 localStorage → 登录后合并）、RSS 生成、Resend 每日邮件。

### Phase 6 — 运维与质检（1 天）
`/admin`、`/status`、job_run 记录、失败重试、连续失败提示。reduced-motion 全量走查、移动端走查、性能走查（首屏 LCP < 2.0s，Canvas 光点场在移动端降至 8 个）。

**总计 11 天左右**，其中 Phase 0-2（数据可信度）和 Phase 3（视觉叙事）是两处不可压缩的成本。

### 明确不做（v1）

用户提交、评论、发帖、小程序、Chrome 插件、未授权爬虫、社交系统、付费位、复杂推荐。

---

## 附：必须由你拍板的 3 个决策

1. **数据源范围**：v1 只做 GitHub（可信度最高、API 最稳），HN 作为外部热度信号，PH 延到 v2？还是三个一起上（PH API 需要申请，会阻塞 Phase 1）？
2. **登录与收藏**：v1 收藏走匿名本地存储（零门槛、零后端），还是直接上邮箱登录（能做每日邮件订阅）？
3. **部署目标**：Vercel（Next 一体化 + Cron，但 SQLite 不可用，需托管 Postgres）还是自托管（SQLite 可用，但 Cron 要自己搭）？
