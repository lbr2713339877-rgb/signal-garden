/**
 * 文案字典（中 / 英）
 *
 * ── 语言策略（按用户第四轮要求分三类）───────────────────────────────────
 *
 * a) **永远英文，两种模式都不翻译**
 *    - 装饰性大标题：Something new / is taking shape.、We kept the signal.
 *      这类衬线 display 大字是设计语言的一部分，翻译会毁掉排版。
 *    - 专有名词：项目名、skill 名、产品名（hyperframes、Claude Code…）
 *    - 导航与分类的英文小 caps 标签：TODAY / CATEGORIES / AI TOOLS
 *
 * b) **成段统一，禁止半中半英**
 *    所有成句成段的文案都在这个字典里，中文模式全中文、英文模式全英文。
 *    允许保留的行业通用外来词：AI、HTML、WebGL、GitHub、MP4、fork、star、
 *    MCP、CLI、SDK —— 这些硬翻反而更难懂。
 *
 * c) 切换按钮是胶囊开关（中 | EN），样式延续现有设计系统。
 *
 * ── 用法 ──────────────────────────────────────────────────────────────
 *   <T k="nav.today" />                     // 渲染两种语言，CSS 决定显示哪个
 *   <T k="hero.sub" as="p" className="…" />
 *   pick(lang, "hero.sub")                  // 非渲染场景（title / meta）
 */

import { LANG } from './i18n';
import {
  FORK_CARD_NOTE_EN,
  FORK_CARD_NOTE_ZH,
  RANKING_EN_LONG,
  RANKING_EN_SHORT,
  RANKING_ZH_LONG,
  RANKING_ZH_SHORT,
} from './site';

/** [中文, English] */
type Pair = readonly [string, string];

export const DICT = {
  /* ── 导航 ─────────────────────────────────────────────────────────── */
  'nav.today': ['今日', 'Today'],
  'nav.categories': ['分类', 'Categories'],
  'nav.search': ['搜索', 'Search'],
  'nav.saved': ['收藏', 'Saved'],
  'nav.menu': ['菜单', 'Menu'],
  'nav.aria': ['主导航', 'Main navigation'],
  'nav.home': ['Signal Garden 首页', 'Signal Garden home'],
  'nav.login': ['登录', 'Sign in'],
  'nav.account': ['账户', 'Account'],
  'nav.myGarden': ['我的花园', 'My Garden'],
  'nav.settings': ['设置', 'Settings'],
  'nav.subscription': ['订阅', 'Subscription'],
  'nav.logout': ['退出登录', 'Log out'],

  /* ── 页脚 ─────────────────────────────────────────────────────────── */
  'footer.tagline': [
    `每天，从噪音里筛出值得关注的信号。${RANKING_ZH_SHORT}。`,
    `Daily discovery for what is next, ${RANKING_EN_SHORT}.`,
  ],
  'footer.note': ['所有内容来自自动采集，不由用户提交', 'Everything here is collected automatically, never submitted'],
  'footer.status': ['系统状态', 'System status'],
  'footer.contact': ['联系我们', 'Contact'],
  'footer.xhs': ['小红书', 'Xiaohongshu'],
  'footer.sponsor': ['赞助合作：hello@signalgarden.site', 'Sponsorships: hello@signalgarden.site'],
  'nav.sponsor': ['赞助', 'Sponsor'],

  /* ── Section 01 黑场与呼吸 ────────────────────────────────────────── */
  /* 大标题 "Something new / is taking shape." 按策略 a 保持英文，不进字典 */
  'home.categories': ['按用途浏览', 'BROWSE BY PURPOSE'],
  'home.journal': ['工具发现手记', 'A JOURNAL OF USEFUL FINDS'],
  'home.imageSource': ['图片来源', 'Image source'],
  'home.smallNotes': ['几则短笺', 'SHORT NOTES'],
  'home.byTask': ['今天想做什么？', 'What are you making?'],
  'home.catalogueCount': ['{n} 个项目可浏览', '{n} projects to explore'],
  'home.seeSelection': ['看本期精选', 'Explore the picks'],
  'home.weekly.kicker': ['每周一周刊', 'Monday weekly digest'],
  'home.weekly.title': ['本周热度 Top 10', 'This week’s heat · Top 10'],
  'home.weekly.note': [
    '最近 7 个已发布日榜：每天的榜首优先，再补第 2 名，直到 10 个。和周一邮件是同一套排序。',
    'The last 7 published daily editions: each day’s #1, then the #2s, until 10. Same order as the Monday email.',
  ],
  'home.weekly.empty': [
    '这一周还没有已发布的日榜。可以先看公开样刊，或订阅后等周一的信。',
    'No daily edition is in this window yet. Read the public sample, or subscribe for Monday.',
  ],
  'home.weekly.issue': ['看第 {n} 期', 'Read issue {n}'],
  'home.findTool': ['按用途找工具', 'Find tools by purpose'],
  'home.latestEdition': ['最近一期', 'LATEST PUBLISHED EDITION'],
  'home.selection': ['这一期，先看这个。', 'Start with this one.'],
  'home.firstFeature': ['本期看点', 'IN FOCUS'],
  'home.tryProject': ['看看它怎么用', 'See how to use it'],
  'home.whyThis': ['它能帮你做什么', 'WHAT YOU CAN DO'],
  'home.for': ['适合：', 'For:'],
  'home.documentedInstall': ['文档中的安装入口', 'DOCUMENTED INSTALLATION'],
  'home.moreSelection': ['再翻几页。', 'A few more finds.'],
  'home.keepExploring': ['继续找，下一个可能更适合你。', 'Find the next tool for your project.'],
  'home.allCategories': ['浏览所有分类', 'Browse all categories'],
  'home.taskWebsite': ['做一个网站', 'Build a website'],
  'home.taskWebsiteBody': ['从落地页到部署，找下一步需要的工具。', 'Find tools for landing pages, deployment and launch.'],
  'home.taskAgent': ['给 AI 加技能', 'Extend your AI agent'],
  'home.taskAgentBody': ['为编程助手找 Skill、MCP 和自动化能力。', 'Explore skills, MCP servers and automation.'],
  'home.taskVideo': ['制作视频', 'Make a video'],
  'home.taskVideoBody': ['寻找视频创作、剪辑与生成工具。', 'Find tools for video creation, editing and generation.'],
  'home.taskDashboard': ['搭管理后台', 'Build a dashboard'],
  'home.taskDashboardBody': ['从现成的后台、组件和界面方案开始。', 'Start with admin templates and interface components.'],
  'home.returnTitle': ['值得试的，先留下来。', 'Keep the tools you want to try.'],
  'home.returnBody': ['在项目页收藏，下次回来继续看用途和安装方式。', 'Save a project to revisit its capabilities and setup instructions.'],
  'home.openSaved': ['打开我的收藏', 'Open saved projects'],
  'home.allLatest': ['看完整本期榜单', 'View the full edition'],
  'edition.previousNote': ['新一期发布前，先看最近一期推荐；发布后自动更新。', 'Explore the latest published edition. This page updates when a new edition is published.'],
  'pg.today.latestTitle': ['最新推荐', 'Latest picks'],
  'home.allToday': ['看完整今日榜单', 'View today’s full edition'],
  'home.archive': ['看历史榜单', 'View the archive'],
  'home.editionNote': [
    `每期首次推荐的项目。上榜代表首次在这里推荐，不代表项目刚发布。${RANKING_ZH_LONG}。`,
    `First recommendations in each edition. A first feature here does not mean a newly launched project. ${RANKING_EN_LONG}`,
  ],
  'home.browse': ['浏览已有项目', 'Browse the catalogue'],
  'pd.decision': ['上手前先看', 'Before you try it'],
  'pd.docOnly': ['根据公开文档整理，未运行实测；费用以项目官网为准。', 'Based on public documentation, without runtime testing. Check the project site for pricing.'],
  'pd.agents': ['适用平台', 'Platforms'],
  'pd.requirements': ['已识别的要求', 'Documented requirements'],
  'pd.costUnknown': ['未确认', 'Not confirmed'],
  'hero.system': ['每日发现系统', 'DAILY DISCOVERY SYSTEM'],
  'hero.promise': ['给正在做东西的人。', 'For people who make things.'],
  'hero.sub': [
    '每天，从全网新项目中筛出真正值得打开的部分。',
    'Every day, we filter new projects for the ones worth opening.',
  ],
  'hero.scroll': ['向下滚动', 'Scroll to explore'],

  /* ── Section 02 信号场 ────────────────────────────────────────────── */
  'sf.kicker': ['02 / 信号场', '02 / Signal field'],
  'sf.detected': ['01 / 检测到信号', '01 / Signal detected'],
  'sf.title': ['14 个对象正在被扫描', '14 objects are being scanned'],
  'sf.body': [
    '每个对象代表一个刚被发现的项目。它们有不同的速度、深度和形态 —— 有些只是噪音，有些会留下来。其中四个已经靠拢，构成一个可以被认出来的信号。',
    'Each object is a project we just found. They differ in speed, depth and shape — some are noise, some stay. Four of them have drawn together into something recognisable.',
  ],
  'sf.meta': ['14 个对象 · 4 个汇聚中', '14 OBJECTS · 4 CONVERGING'],

  /* ── Section 03 多源聚合 ──────────────────────────────────────────── */
  'cv.kicker': ['03 / 多源聚合', '03 / Convergence'],
  'cv.title': ['四个源，汇成一个信号', 'Four sources, one signal'],
  'cv.body': [
    'GitHub、Hacker News、产品发布和公开社区。同一个项目在多个源里被提到，才会被我们认成信号。',
    'GitHub, Hacker News, product launches and public communities. A project has to show up in more than one before we call it a signal.',
  ],

  /* ── Section 04 信号与噪音 ────────────────────────────────────────── */
  /* 大标题 "We kept the signal." 按策略 a 保持英文 */
  'nz.sub': ['我们只留下真正值得看的部分。', 'We only keep the part actually worth your time.'],
  'nz.kicker': ['04 / 信号与噪音', '04 / Signal and noise'],

  /* ── Section 05 今日精选 ──────────────────────────────────────────── */
  'ts.kicker': ['今日精选', 'TODAY’S SELECTION'],
  'ts.archiveTitle': ['这一期值得打开的 {n} 个', '{n} worth opening in this edition'],
  'ts.quickBrowse': ['快速浏览这一期', 'Browse this edition at a glance'],
  'ts.backToList': ['返回推荐目录', 'Back to the edition index'],
  'ts.title': ['今天值得打开的 {n} 个', '{n} worth opening today'],
  'ts.body': [
    '全部来自自动采集。没有通过编辑门槛的，一个都不会出现在这里。',
    'All of it collected automatically. Anything below our editorial floor never appears here.',
  ],
  'ts.empty.title': ['先发现值得用的工具', 'Find your next useful tool'],
  'ts.empty.body': [
    '暂时没有已发布的榜单，可以先按分类浏览或搜索已有项目。',
    'No edition has been published yet. Browse categories or search the catalogue.',
  ],
  'ts.rank': ['编号', 'Rank'],
  'ts.open': ['查看项目', 'Open project'],
  'ts.preview': ['仓库卡片 · GitHub', 'Repository card · GitHub'],
  'ts.abstract': ['无预览图 · 抽象封面', 'No preview · abstract cover'],
  'ts.forks7d': ['7 天新增 fork', 'FORKS / 7D'],
  'ts.stars24h': ['24 小时新增 star', 'STARS / 24H'],
  'ts.new': ['新', 'NEW'],
  'ts.growing': ['正在增长的项目', 'A project gaining momentum'],

  /* ── Section 06 六个空间 ──────────────────────────────────────────── */
  'cs.kicker': ['06 / 分类空间', '06 / Category spaces'],
  'cs.title': ['六个空间', 'Six spaces'],
  'cs.enter': ['进入这个空间', 'Enter this space'],
  'cs.reps': ['{n} 个代表项目', '{n} representative projects'],
  'cs.empty': ['这个分类还没有通过门槛的项目', 'Nothing in this space has cleared the floor yet'],


  /* ── Section 08 品牌收束 ──────────────────────────────────────────── */
  'cl.title': [
    '每天 5 分钟，从全网噪音里筛出值得打开的那几个。',
    'Five minutes a day, filtered down to the few worth opening.',
  ],

  /* ── 详情页 ───────────────────────────────────────────────────────── */
  'pd.whynow.kicker': ['项目动态', 'PROJECT ACTIVITY'],
  'pd.whynow.title': ['它现在处在什么位置', 'Where it stands right now'],
  'pd.what.kicker': ['能力', 'CAPABILITIES'],
  'pd.what.title': ['它能帮你做成什么', 'What it helps you do'],
  'pd.what.fallback': ['它能帮你做成什么', 'What it helps you do'],
  'pd.what.expand': ['展开全部原始能力', 'Show all raw capabilities'],
  'pd.what.collapse': ['收起原始能力', 'Hide raw capabilities'],
  'pd.what.raw': ['原始能力清单', 'Raw capability list'],
  'pd.what.verified': ['文档已检查', 'Docs checked'],
  'pd.hero.openRepo': ['打开仓库', 'Open repository'],
  'pd.hero.homepage': ['官网', 'Homepage'],
  'pd.hero.rising': ['上升中', 'Rising'],
  'badge.copy': ['复制 README 徽章', 'Copy README badge'],
  'badge.copied': ['已复制', 'Copied'],
  'badge.theme': ['徽章主题', 'Badge theme'],
  'badge.light': ['浅色', 'Light'],
  'badge.dark': ['深色', 'Dark'],
  'pd.subscribe.kicker': ['每周一周刊', 'Monday weekly digest'],
  'pd.subscribe.title': ['把每周一的周刊寄到邮箱。', 'Get the Monday weekly digest by email.'],
  'pd.subscribe.cta': ['订阅每周一周刊', 'Subscribe to the Monday weekly digest'],
  'pd.hero.install': ['怎么装：', 'Install:'],
  'pd.install.kicker': ['上手', 'GET STARTED'],
  'pd.install.title': ['怎么装', 'How to install'],
  'pd.install.hint': [
    '两种装法选一个即可 —— 上面那条给命令行用户，下面那条给写代码的用户。',
    'Pick one of the two — the first is for command-line users, the second for people writing code.',
  ],
  'pd.limits.kicker': ['使用限制', 'LIMITATIONS'],
  'pd.limits.title': ['限制与风险', 'Limits and risk'],
  'pd.limits.body': [
    '以下要求与风险来自文档静态检查，未执行项目代码；扫描没有命中，不代表使用安全。',
    'Risk here is evidence, not an alarm. These findings come from static scanning of the docs; we never execute a project’s code.',
  ],
  'pd.prov.summary': ['这些结论的依据是什么', 'Where these conclusions come from'],
  'pd.prov.rawHash': ['原始数据哈希', 'Raw data hash'],
  'pd.prov.parsedAt': ['解析时间', 'Parsed at'],
  'pd.prov.lastVerifiedAt': ['最后一次验证', 'Last verified'],
  'pd.prov.growthMeasuredAt': ['增长测量时间', 'Growth measured'],
  'pd.prov.dependencies': ['依赖：', 'Dependencies:'],
  'pd.prov.evidenceJson': ['完整解析证据 JSON', 'Full parse evidence JSON'],
  'pd.nav.today': ['今日榜单', 'Today'],
  'pd.nav.feedback': ['反馈问题', 'Report a problem'],
  'pd.back': ['返回首页', 'Back to home'],
  'pd.today': ['今日榜单', 'Today’s list'],
  'pd.feedback': ['反馈问题', 'Report a problem'],
  'pd.rising': ['上升中', 'RISING'],
  'pd.openRepo': ['打开仓库', 'Open repository'],
  'pd.homepage': ['官网', 'Homepage'],

  /* ── 详情页 · 五个动作（英文 caps 标题按策略 a 保留）───────────────── */
  'pd.act.read.desc': [
    '打开页面，读完全部文字内容',
    'Opens the page and reads all of its text',
  ],
  'pd.act.understand.desc': [
    '把页面结构整理成可操作的步骤',
    'Turns the page structure into actionable steps',
  ],
  'pd.act.act.desc': [
    '像人一样点击、填写、提交',
    'Clicks, fills and submits the way a person would',
  ],
  'pd.act.extract.desc': [
    '只把需要的那部分取出来',
    'Pulls out only the part you actually need',
  ],
  'pd.act.return.desc': [
    '整理成结构化结果交给你',
    'Hands it back as structured results',
  ],

  /* ── 详情页 · 安装说明 ────────────────────────────────────────────── */
  'pd.inst.uv.isolated': [
    '装在独立环境里，不污染系统 Python。带完整 CLI。',
    'Installs into its own isolated environment without touching your system Python. Ships the full CLI.',
  ],
  'pd.inst.uv.default': [
    'Python 用户的完整版安装，包含命令行工具。',
    'The full install for Python users, including the command-line tool.',
  ],
  'pd.inst.npm.sdk': [
    '只装 TypeScript SDK，没有命令行工具，适合写进自己的项目里调用。',
    'Installs only the TypeScript SDK, with no CLI — for calling from your own project.',
  ],
  'pd.inst.npm.default': [
    'Node 用户的安装方式。',
    'The install route for Node users.',
  ],
  'pd.inst.mcp': [
    'MCP 客户端配置，粘贴到对应的配置文件里即可。',
    'An MCP client config — paste it into the relevant config file.',
  ],
  'pd.inst.empty': [
    '文档里没有找到可识别的安装命令。这类项目按发布规则不会进入榜单，只能在这里查看。',
    'No recognisable install command was found in the docs. Projects like this never enter the ranked list under our publishing rules — they are viewable here only.',
  ],
  'pd.inst.readme': [
    'README 里给出的安装方式。',
    'The installation method given in the README.',
  ],



  /* ── 详情页 · 限制与风险 ──────────────────────────────────────────── */
  'pd.limits.header': ['限制', 'LIMITS'],
  'pd.limits.scan': ['静态扫描', 'STATIC SCAN'],
  'pd.limits.notScanned': ['尚未扫描。', 'Not scanned yet.'],
  'pd.limits.clean': [
    '在 README、SKILL.md 和依赖清单中没有匹配到已知风险模式。',
    'No known risk patterns matched in the README, SKILL.md or dependency list.',
  ],
  'pd.limits.notSafe': ['这不等于安全', 'that does not mean it is safe'],
  'pd.limits.notSafeTail': ['，只能说明文档里没写。', ' — only that the docs do not mention it.'],
  'pd.limits.footnote': [
    '这里只做静态扫描：读 README、SKILL.md 和依赖清单，不执行代码。没有命中不代表安全。',
    'This is static scanning only: we read the README, SKILL.md and dependency list, and never execute code. No findings does not mean safe.',
  ],
  'pd.limits.item.apikey': ['需要 API Key', 'REQUIRES API KEY'],
  'pd.limits.item.local': ['需要本地环境', 'NEEDS LOCAL RUNTIME'],
  'pd.limits.item.docker': ['需要 Docker', 'NEEDS DOCKER'],
  'pd.limits.item.difficulty': ['难度', 'DIFFICULTY'],
  'pd.limits.item.license': ['许可', 'LICENSE'],
  'pd.limits.item.stage': ['阶段', 'STAGE'],
  'pd.limits.found': ['是', 'Yes'],
  'pd.limits.notFound': ['未在文档中发现', 'Not found in the docs'],
  'pd.limits.unrecognised': ['未识别', 'Not identified'],
  'pd.limits.createdAt': ['创建于 {d}', 'Created {d}'],

  'pd.act.verified': ['文档已检查', 'Docs checked'],

  /* ── 详情页 · 观测值标签（英文 caps 是小标签，中文也走字典）────────── */
  'pd.discuss.title': ['相关讨论', 'RELATED DISCUSSIONS'],
  'pd.obs.firstSeen': ['首次发现', 'FIRST SEEN'],
  'pd.obs.growth': ['增长', 'GROWTH'],
  'pd.obs.discussion': ['讨论', 'DISCUSSION'],
  'pd.obs.status': ['状态', 'STATUS'],
  'pd.obs.notRecorded': ['未记录', 'Not recorded'],
  'pd.obs.noFirstSeen': [
    '采集任务尚未写入首次发现时间',
    'The collection job has not written a first-seen date yet',
  ],
  'pd.obs.insufficient': ['历史不足', 'Not enough history'],
  'pd.obs.insufficientNote': [
    '只有 {n} 个快照，还不足以计算增长',
    'Only {n} snapshots so far — not enough to compute growth',
  ],
  'pd.obs.growthNote': [
    '{from} → {to} stars · {n} 个快照',
    '{from} → {to} stars · {n} snapshots',
  ],
  'pd.obs.none': ['暂无', 'None'],
  'pd.obs.noMentions': ['还没有采集到外部讨论', 'No external discussion collected yet'],
  'pd.obs.mentions': ['{n} 条外部提及', '{n} external mentions'],
  'pd.obs.quality': ['质量 {g}', 'Quality {g}'],

  /* ── 详情页 · 依据链（provenance）──────────────────────────────────── */
  'pd.prov.sourceUrl': ['来源 URL', 'Source URL'],
  'pd.prov.queries': ['发现查询', 'Discovery queries'],
  'pd.prov.categorySource': ['分类来源', 'Category source'],
  'pd.prov.focus': ['焦点', 'Focus'],
  'pd.prov.json': ['完整解析证据 JSON', 'Full parse evidence JSON'],
  'pd.prov.deps': ['依赖', 'Dependencies'],
  'pd.notFound': ['项目', 'Project'],
  'pd.noDesc': ['暂无简介', 'No description yet'],
  'pd.noTitle': ['（这条讨论没有标题）', '(this discussion has no title)'],

  /* ── 今日 / 归档 / 趋势 ───────────────────────────────────────────── */
  'pg.today.kicker': ['01 / 今日', '01 / Today'],
  'pg.today.title': ['今日', 'Today'],
  'pg.today.headline': ['头条', 'Headline'],
  'pg.today.pastFloor': ['{n} 条通过门槛', '{n} past the floor'],
  'pg.today.rest': ['其余 {n} 个', 'The other {n}'],
  'pg.today.empty': [
    '暂时没有已发布的榜单，可以先按分类浏览或搜索已有项目。',
    'No edition has been published yet. Browse categories or search the catalogue.',
  ],
  'pg.today.archiveLink': ['往期榜单在归档', 'Past editions are in the archive'],

  'pg.arch.kicker': ['归档', 'ARCHIVE'],
  'pg.arch.title': ['历史归档', 'Past editions'],
  'pg.arch.status': ['归档状态', 'ARCHIVE STATUS'],
  'pg.arch.body1': [
    '归档需要多天的榜单数据。现在只有一天的记录，所以下面是',
    'An archive needs more than one day of rankings. Only one day exists so far, so what follows is the',
  ],
  'pg.arch.current': ['当前排序', 'current ordering'],
  'pg.arch.body2': [
    '，不是历史快照。用今天的结果回填过去会让归档失去意义，所以我们不这么做。等每日快照积累到一周以上，这里会按时序列出每一天当时看到的东西。',
    ', not a past snapshot. Backfilling history with today’s results would defeat the point of an archive, so we do not do it. Once daily snapshots span a week or more, this lists each day as it looked then.',
  ],
  'pg.arch.empty': ['还没有可归档的内容。', 'Nothing to archive yet.'],
  'pg.arch.back': ['回到今日', 'Back to today'],

  'pg.trend.kicker': ['趋势', 'TRENDS'],
  'pg.trend.title': ['增长最快', 'Fastest growing'],
  'pg.trend.method': ['口径', 'METHOD'],
  'pg.trend.methodBody': [
    `${RANKING_ZH_LONG}。${FORK_CARD_NOTE_ZH}`,
    `${RANKING_EN_LONG} ${FORK_CARD_NOTE_EN}`,
  ],
  'pg.trend.notCurve': ['不是随时间变化的曲线', 'not a curve over time'],
  'pg.trend.notCurveTail': [
    '。等快照积累到一周以上，这里会换成真实趋势图。',
    '. Once snapshots span more than a week, this becomes a real trend chart.',
  ],
  'pg.trend.rising': ['飙升上榜', 'RISING'],
  'pg.trend.risingTitle': ['追踪一段时间后才达标的', 'Tracked before they qualified'],
  'pg.trend.risingBody': [
    '这些项目不是今天才出现的 —— 我们追踪了一段时间，热度刚刚越过门槛。',
    'These projects did not appear today — we had been tracking them, and their momentum has only just cleared the floor.',
  ],
  'pg.trend.growth': ['7 天增长榜', '7-DAY GROWTH'],
  'pg.trend.growthTitle': ['7 日新增 fork', '7-day new forks'],
  'pg.trend.empty': ['暂无数据。', 'No data yet.'],
  'pg.trend.todayLink': ['今日榜单', 'Today’s list'],

  /* ── 搜索 ─────────────────────────────────────────────────────────── */
  'pg.search.kicker': ['搜索', 'SEARCH'],
  'pg.search.title': ['搜索', 'Search'],
  'pg.search.placeholder': [
    '项目名、能力、平台、技术栈…',
    'Project name, capability, platform, stack…',
  ],
  'pg.search.byCat': ['分类', 'Category'],
  'pg.search.byDifficulty': ['难度', 'Setup'],
  'pg.search.byPlatform': ['平台', 'Platform'],
  'pg.search.bySecurity': ['安全', 'Security'],
  'pg.search.secNone': ['风险未知', 'Risk unknown'],
  'pg.search.secReview': ['需检查', 'Review'],
  'pg.search.secRisk': ['存在风险', 'Risk'],
  'pg.search.results': ['显示 {n} 个项目', 'Showing {n} projects'],
  'pg.search.start': ['浏览全部项目', 'Browse all projects'],
  'pg.search.filters': ['{n} 个筛选生效', '{n} filters active'],
  'pg.search.noMatch': ['没有符合条件的内容。', 'Nothing matches.'],

  /* ── 收藏 / 设置 / 状态 / 反馈 ────────────────────────────────────── */
  'pg.saved.kicker': ['收藏', 'SAVED'],
  'pg.saved.title': ['收藏', 'Saved'],
  'pg.saved.where': ['这些数据在哪', 'WHERE THIS LIVES'],
  'pg.saved.body': [
    '收藏保存在这台设备的浏览器里，不上传、不需要账号。换设备不会同步 —— 等账号体系上线后会自动合并。',
    'Saves live in this device’s browser. Nothing is uploaded and no account is needed. They will not sync across devices — they merge automatically once accounts exist.',
  ],
  'pg.saved.bodyLocal': [
    '收藏保存在这台设备的浏览器里，不上传、不需要账号。登录后点收藏会跟随账号同步，换设备也能看到。',
    'Saves live in this device’s browser — nothing is uploaded and no account is needed. Once you sign in, saves follow your account across devices.',
  ],
  'pg.saved.bodyAccount': [
    '收藏已同步到你的账号，换台设备登录后也能看到。',
    'Saves are synced to your account, so they follow you to any device you sign in on.',
  ],
  'pg.saved.empty': [
    '还没有收藏。在今日榜单或分类里点收藏，这里就会出现。',
    'No saves yet. Use the save control on the today list or in a category and it will appear here.',
  ],
  'pg.saved.count': ['{n} 个项目', '{n} projects'],
  'pg.saved.toToday': ['去今日榜单', 'Go to today’s list'],

  'pg.set.kicker': ['设置', 'SETTINGS'],
  'pg.set.title': ['设置', 'Settings'],
  'pg.set.sub': [
    'Signal Garden 不接受用户提交内容，所以设置里只有一件事：你想收到什么、不想看到什么。',
    'Signal Garden takes no user submissions, so there is only one thing to configure here: what you want to receive, and what you would rather not see.',
  ],
  'pg.set.subscribe': ['订阅分类', 'SUBSCRIBE'],
  'pg.set.subscribeNote': [
    '选择你想接收的类别，以及不感兴趣的方向。',
    'Choose the categories you want to receive and the directions you would rather skip.',
  ],
  'pg.set.subFilters': ['二级细分', 'SUB-FILTERS'],
  'pg.set.email': ['邮件与 RSS', 'EMAIL & RSS'],
  'pg.set.emailBody': [
    '每日榜单的 RSS 在 /feed.xml，不需要账号。每周一周刊仍需要发信服务，属于后续版本，所以这里没有邮件开关。',
    'The daily list is available as RSS at /feed.xml, with no account. The Monday weekly digest still needs a sending service and comes later, so there is no email toggle here.',
  ],
  'pg.set.feedLink': ['订阅 RSS', 'Subscribe via RSS'],
  'pg.set.report': ['报告问题', 'REPORT'],
  'pg.set.reportBody': [
    '在任意项目详情页底部可以反馈：链接失效、分类错误、描述不准确、存在安全风险、已停止维护。反馈进入人工审核队列，不会直接改动公开内容。',
    'At the bottom of any project page you can report: dead link, wrong category, inaccurate description, security risk, or unmaintained. Reports queue for human review and never edit public content directly.',
  ],
  'pg.set.findProject': ['去找一个项目', 'Find a project'],

  'pg.status.kicker': ['系统状态', 'STATUS'],
  'pg.status.title': ['系统状态', 'System status'],
  'pg.status.sub': [
    '一个声称帮你从噪音里挑信号的产品，应该对数据中断诚实。',
    'A product that claims to pick signal out of noise should be honest when its data breaks.',
  ],
  'pg.status.sources': ['数据源', 'DATA SOURCES'],
  'pg.status.failures': ['连续失败 {n}', '{n} consecutive failures'],
  'pg.status.quota': ['剩余额度 {n}', '{n} quota left'],
  'pg.status.lastOk': ['上次成功 {d}', 'Last success {d}'],
  'pg.status.neverOk': ['尚无成功记录', 'No successful run yet'],
  'pg.status.noSources': ['还没有采集记录。', 'No collection runs recorded yet.'],
  'pg.status.lastFailure': ['最近失败', 'LATEST FAILURE'],
  'pg.status.failureImpact': ['影响范围', 'Impact'],
  'pg.status.failureJob': ['失败任务', 'Failed job'],
  'pg.status.failureTime': ['发生时间', 'Started'],
  'pg.status.failureError': ['错误', 'Error'],
  'pg.status.impact.discover': ['今天的发现流程可能没有新增项目。', 'Today’s discovery may not have added new projects.'],
  'pg.status.impact.refocus': ['新项目的主题与焦点可能没有刷新。', 'New projects may not have refreshed their focus themes.'],
  'pg.status.impact.enrich': ['元数据或 README 解析可能停留在上一轮。', 'Metadata or README parsing may be stuck on the previous run.'],
  'pg.status.impact.growth': ['趋势数据可能缺少今天的新快照。', 'Trends may be missing today’s new snapshots.'],
  'pg.status.impact.score': ['今日候选榜可能没有重新计算。', 'Today’s candidate ranking may not have been recomputed.'],
  'pg.status.impact.enrich-ai': ['缺中文文案的候选可能无法进入发布。', 'Candidates without Chinese copy may be blocked from publishing.'],
  'pg.status.impact.publish': ['今日公开榜单可能没有更新。', 'Today’s public list may not have updated.'],
  'pg.status.impact.daily': ['每日流水线没有完整跑完，下游数据可能停留在上一轮。', 'The daily pipeline did not finish, so downstream data may be from the previous run.'],
  'pg.status.jobs': ['最近任务', 'RECENT JOBS'],
  'pg.status.noJobs': ['还没有运行记录。', 'No job runs yet.'],
  'pg.status.job.discover': [
    '每 6 小时：搜索新仓库并写入原始信号',
    'Every 6 hours: search for new repositories and write raw signals',
  ],
  'pg.status.job.enrich': [
    '每小时：刷新元数据，并解析有变化的仓库',
    'Hourly: refresh metadata and re-parse repositories that changed',
  ],
  'pg.status.job.refocus': [
    '重算编辑焦点，不改动抓取数据',
    'Recompute editorial focus without touching collected data',
  ],
  'pg.status.job.score': [
    '每日：计算热度并生成候选榜',
    'Daily: compute heat and build the candidate list',
  ],
  'pg.status.job.publish': [
    '每日：发布榜单、RSS、邮件',
    'Daily: publish the list, RSS and email',
  ],

  'pg.fb.kicker': ['反馈', 'FEEDBACK'],
  'pg.fb.title': ['反馈问题', 'Report a problem'],
  'pg.fb.deadLink': ['链接失效', 'Dead link'],
  'pg.fb.wrongCat': ['分类错误', 'Wrong category'],
  'pg.fb.inaccurate': ['描述不准确', 'Inaccurate description'],
  'pg.fb.security': ['存在安全风险', 'Security risk'],
  'pg.fb.unmaintained': ['已停止维护', 'Unmaintained'],
  'pg.fb.note': ['补充说明（可选）', 'Note (optional)'],
  'pg.fb.submit': ['提交反馈', 'Submit feedback'],
  'pg.fb.submitting': ['提交中', 'Submitting'],
  'pg.fb.success': ['已收到。反馈进入人工审核队列，不会直接改动公开内容。', 'Received. It is queued for human review and will not change public content directly.'],
  'pg.fb.error': ['提交失败，请稍后再试。', 'Could not submit. Try again later.'],
  'pg.fb.noteBody': [
    '反馈会进入人工审核队列，确认后才可能改动公开内容 —— 用户反馈不会直接改写任何一条数据。',
    'Reports queue for human review before public content can change — user feedback never rewrites a record directly.',
  ],
  'pg.fb.back': ['返回项目', 'Back to project'],

  /* ── 分类页 ───────────────────────────────────────────────────────── */
  'pg.cat.kicker': ['分类空间', 'CATEGORY SPACES'],
  'pg.cat.title': ['六个空间', 'Six spaces'],
  'pg.cat.sub': [
    '每个空间有自己的光。只有通过编辑门槛的项目会出现在里面。',
    'Each space has its own light. Only projects past the editorial floor appear inside.',
  ],
  'pg.cat.enter': ['进入', 'Enter'],
  'pg.cat.projects': ['{n} 个项目', '{n} projects'],
  'pg.cat.type': ['细分', 'TYPE'],
  'pg.cat.sort': ['排序', 'SORT'],
  'pg.cat.empty': ['这个细分下还没有通过门槛的项目。', 'Nothing in this type has cleared the floor yet.'],
  'pg.cat.pastFloor': ['{n} 个已达门槛的项目', '{n} projects past the floor'],
  'pg.cat.back': ['返回首页', 'Back to home'],

  /* ── 难度（搜索筛选用）────────────────────────────────────────────── */
  'diff.one_click': ['一键安装', 'One-click install'],
  'diff.simple_config': ['简单配置', 'Simple config'],
  'diff.needs_api_key': ['需要 API Key', 'Needs an API key'],
  'diff.needs_local': ['需要本地环境', 'Needs a local runtime'],
  'diff.needs_dev': ['需要开发经验', 'Needs development experience'],

  /* ── 六个空间的材质描述 ───────────────────────────────────────────── */
  'cs.mat.ai-tools': ['模型、推理、图像与视频工具', 'Models, inference, image and video tools'],
  'cs.mat.indie-web': ['落地页、订阅、支付与增长', 'Landing pages, subscriptions, payments and growth'],
  'cs.mat.dev-tools': ['CLI、数据、测试与基础设施', 'CLI, data, testing and infrastructure'],
  'cs.mat.design': ['动效、UI 套件与设计资源', 'Motion, UI kits and design resources'],
  'cs.mat.skill-agent': ['MCP server、Claude Skill 与 Agent', 'MCP servers, Claude Skills and Agents'],
  'cs.mat.productivity': ['自动化、笔记与成本控制', 'Automation, notes and cost control'],

  /* ── 通用动作 ─────────────────────────────────────────────────────── */
  'act.copy': ['复制', 'Copy'],
  'act.copied': ['已复制', 'Copied'],
  'act.copyManual': ['手动复制', 'Copy manually'],
  'act.clear': ['清空', 'Clear'],
  'act.remove': ['移除', 'Remove'],

  /* ── 项目操作：收藏 / 关注（客户端组件用 T / useLang）─────────────── */
  'pa.save': ['收藏', 'Save'],
  'pa.follow': ['关注', 'Follow'],
  'pa.saved': ['已收藏', 'Saved'],
  'pa.unsaved': ['已取消收藏', 'Removed'],
  'pa.following': ['已关注', 'Following'],
  'pa.unfollowed': ['已取消关注', 'Unfollowed'],
  'pa.savedLocal': ['已保存到本设备。', 'Saved on this device.'],
  'pa.unsavedLocal': ['已从本设备移除。', 'Removed from this device.'],
  'pa.needLogin': ['登录后即可收藏和关注项目。', 'Sign in to save and follow projects.'],
  'pa.limit': [
    '收藏或关注已到上限。',
    'You have reached the save or follow limit.',
  ],
  'pa.failed': ['操作失败，请稍后再试。', 'That didn’t work. Try again in a moment.'],
  'act.filterClear': ['清除筛选', 'Clear filters'],

  /* ── 空状态 / 状态文案 ────────────────────────────────────────────── */
  'state.loading': ['加载中', 'Loading'],
  'state.notFound': ['没有找到这个项目。', 'That project was not found.'],
  'state.noPreview': ['暂无预览', 'No preview'],
  'state.unknown': ['未知', 'Unknown'],
  'state.notInDocs': ['未在文档中发现', 'Not found in the docs'],
  'state.yes': ['是', 'Yes'],
  'state.noMetadata': ['未记录', 'Not recorded'],
  'state.insufficientHistory': ['历史不足', 'Not enough history'],


  /* ── My Garden ───────────────────────────────────────────────────── */
  'pg.garden.kicker': ['我的花园', 'MY GARDEN'],
  'pg.garden.title': ['你收藏的项目', 'Your saved projects'],
  'pg.garden.localSaves': ['本地收藏', 'Local saves'],
  'pg.garden.saved': ['收藏', 'Saved'],
  'pg.garden.following': ['关注', 'Following'],
  'pg.garden.emptySaved': ['还没有收藏项目。', 'No saved projects yet.'],
  'pg.garden.emptyFollowing': ['还没有关注项目。', 'No followed projects yet.'],

  /* ── 赞助 ─────────────────────────────────────────────────────────── */
  'sponsor.kicker': ['赞助', 'SPONSOR'],
  'sponsor.title': ['赞助', 'Sponsor'],
  'sponsor.intro': [
    `Signal Garden 是每日 GitHub 雷达。${RANKING_ZH_LONG}。`,
    `Signal Garden is a daily GitHub radar. ${RANKING_EN_LONG}`,
  ],
  'sponsor.audienceTitle': ['读者', 'Audience'],
  'sponsor.audienceBody': [
    `读者是每天追踪 GitHub 趋势仓库的开发者。${RANKING_ZH_LONG}。他们关心开源、GitHub、独立开发和开发者工具。`,
    `The audience is developers who track trending GitHub repositories every day. ${RANKING_EN_LONG} They follow open source, GitHub, indie building, and developer tools.`,
  ],
  'sponsor.placementsTitle': ['可以放的位置', 'Placements'],
  'sponsor.placeTodayTitle': ['今日榜一条', 'A /today strip'],
  'sponsor.placeTodayBody': [
    '在 /today 榜单上方放一行文字或小标识，链到你的站点。',
    'A line of text or a small mark above the /today list, linking to your site.',
  ],
  'sponsor.placeDigestTitle': ['每周一周刊', 'Monday weekly digest'],
  'sponsor.placeDigestBody': [
    '每周一周刊里放一段：名称、一句话和链接。确认订阅之后才会发信。',
    'A short block in the Monday weekly digest: a name, one sentence, and a link. Mail goes out only after someone confirms.',
  ],
  'sponsor.placeRssTitle': ['RSS 一行（可选）', 'An RSS line (optional)'],
  'sponsor.placeRssBody': [
    '在 feed 里加一行文字链，可以作为今日榜和每周一周刊的附赠。',
    'A single text link in the feed, as an optional extra with the strip and the Monday weekly digest.',
  ],
  'sponsor.note': [
    '这是早期独立站的品牌试跑，不是正式刊例。我们只保证位置在，不保证曝光或转化。',
    'This is an early independent site and a brand trial, not a rate card. We promise the placement exists. We do not promise reach or conversions.',
  ],
  'sponsor.contactTitle': ['联系', 'Contact'],
  'sponsor.contactBody': [
    '请写信说明品牌、一句介绍，以及希望放在今日榜、每周一周刊，还是两者都要。RSS 一行可以一并问。',
    'Email your brand, a one-line description, and whether you want the /today strip, the Monday weekly digest, or both. You can ask for the RSS line in the same note.',
  ],
  'sponsor.contactCta': ['写信咨询赞助', 'Email about sponsorship'],

  /* ── 公共法律页 ───────────────────────────────────────────────────── */
  'legal.lastUpdatedLabel': ['最后更新：', 'Last updated: '],
  'legal.contactPrompt': ['联系方式：', 'Contact:'],
  'legal.sectionsAria': ['法律页面章节', 'Legal page sections'],

  'newsletter.title': ['每周一周刊', 'Monday weekly digest'],
  'newsletter.body': [
    '每周一 1 封：本周热度最高的 10 个 GitHub 新项目。免费，随时退订。',
    'One email each Monday: the 10 hottest new GitHub projects this week. Free, unsubscribe any time.',
  ],
  'newsletter.sample': ['看第 1 期', 'Read issue 1'],
  'newsletter.placeholder': ['you@example.com', 'you@example.com'],
  'newsletter.submit': ['订阅', 'Subscribe'],
  'newsletter.sent': ['已发送', 'Sent'],
  'newsletter.already': ['已发过', 'Already sent'],
  'newsletter.alreadyBody': ['已发过，请查收件箱', 'Already sent. Check your inbox.'],
  'newsletter.company': ['公司', 'Company'],
  'newsletter.success': [
    '请到收件箱确认订阅 Signal Garden 每周一周刊。',
    'Check your inbox to confirm your Signal Garden Monday weekly digest.',
  ],
  'newsletter.invalid': ['请输入有效的邮箱地址。', 'Enter a valid email address.'],
  'newsletter.tooFast': ['请在页面上停留一会儿再提交。', 'Stay on the page a moment, then submit again.'],
  'newsletter.turnstile': ['人机验证没有通过，请再试一次。', 'The check did not pass. Please try again.'],
  'newsletter.rate': ['提交太频繁了，请稍后再试。', 'Too many attempts. Please try again later.'],
  'newsletter.confirmHeading': [
    '还差一步：去邮箱点确认链接',
    'One step left: open your inbox and tap the confirm link',
  ],
  'newsletter.confirmFromLabel': ['发件人', 'From'],
  'newsletter.confirmSubjectLabel': ['邮件主题', 'Subject'],
  'newsletter.confirmSpam': [
    '如果没看到，请到垃圾箱和推广邮件里找。',
    'If it is not there, check spam and promotions.',
  ],
  'newsletter.openMailbox': ['打开邮箱', 'Open mailbox'],
  'newsletter.resend': ['没收到？重发', "Didn't get it? Resend"],
  'newsletter.resendWait': ['没收到？重发（{n}s）', "Didn't get it? Resend ({n}s)"],
  'newsletter.resent': ['已重发，请查收', 'Sent again — check your inbox'],
  'newsletter.limited': [
    '已发送过多次，请查看已有邮件或稍后再试',
    'This address was emailed several times. Check those messages, or try again later.',
  ],
  'newsletter.privacy': [
    '订阅即表示你同意我们按隐私政策发送每周一周刊。我们会记录这次订阅的来源页面和活动标签，这条记录不包含 IP 地址。',
    'Subscribing means you agree that we email the Monday weekly digest as described in the privacy policy. We record the referring page and campaign tag for the signup, and that record does not include an IP address.',
  ],
  'weekly.kicker': ['公开样刊', 'PUBLIC SAMPLE'],
  'weekly.title': ['第 {n} 期', 'Issue {n}'],
  'weekly.note': [
    '这是每周精选的公开样刊，只收录项目和公开简介。没有订阅者、确认链接或退订信息。',
    'This is a public sample of the weekly digest: projects and public summaries only. No subscribers, confirm links, or unsubscribe data.',
  ],
  'weekly.today': ['看今天的榜单', 'See today’s list'],

  'nl.kicker': ['每周一周刊', 'Monday weekly digest'],
  'nl.confirmTitle': ['确认订阅', 'Confirm subscription'],
  'nl.confirmBody': [
    '点下面的按钮，这个地址才会开始接收每周一周刊。打开链接本身不会确认。',
    'Use the button below to start receiving the Monday weekly digest at this address. Opening the link does not confirm it.',
  ],
  'nl.confirmButton': ['确认订阅', 'Confirm subscription'],
  'nl.confirmedTitle': ['订阅已确认', 'Subscription confirmed'],
  'nl.confirmedBody': [
    '从下周一开始，每周一周刊会发到这个地址。',
    'The Monday weekly digest will arrive at this address starting next Monday.',
  ],
  'nl.alreadyTitle': ['已经确认过了', 'Already confirmed'],
  'nl.alreadyBody': [
    '这个地址已经在接收每周一周刊，不需要再确认一次。',
    'This address is already receiving the Monday weekly digest. There is nothing else to confirm.',
  ],
  'nl.expiredTitle': ['确认链接已过期', 'Confirmation link expired'],
  'nl.expiredBody': [
    '确认链接 48 小时内有效。请重新提交邮箱，我们会再发一封。',
    'Confirmation links last 48 hours. Submit your email again and we will send a new one.',
  ],
  'nl.rejectedTitle': ['这个链接不能用来确认', 'This link cannot confirm'],
  'nl.rejectedBody': [
    '这个地址目前不能通过该链接确认订阅。',
    'This address cannot be confirmed with this link.',
  ],
  'nl.invalidTitle': ['链接无效', 'Link not valid'],
  'nl.invalidBody': [
    '这个链接不存在，或者已经失效。',
    'This link does not exist, or it is no longer valid.',
  ],
  'nl.unsubTitle': ['退订每周一周刊', 'Unsubscribe from the Monday weekly digest'],
  'nl.unsubBody': [
    '点下面的按钮后，我们会停止发送每周一周刊。',
    'Use the button below and we will stop sending the Monday weekly digest.',
  ],
  'nl.unsubButton': ['确认退订', 'Confirm unsubscribe'],
  'nl.unsubDoneTitle': ['已退订', 'Unsubscribed'],
  'nl.unsubDoneBody': [
    '这个地址不会再收到每周一周刊。30 天内我们会删除邮箱，只保留一个哈希。',
    'This address will no longer receive the Monday weekly digest. Within 30 days we delete the email and keep only a hash.',
  ],
  'nl.unsubAlreadyBody': [
    '这个地址已经退订。',
    'This address is already unsubscribed.',
  ],
  'nl.unsubSuppressedBody': [
    '这个地址已经停止接收每周一周刊。',
    'This address has already stopped receiving the Monday weekly digest.',
  ],

  /* ── Privacy ─────────────────────────────────────────────────────── */
  'privacy.kicker': ['隐私政策', 'PRIVACY'],
  'privacy.title': ['隐私政策', 'Privacy Policy'],
  'privacy.intro': [
    '这份政策说明 Signal Garden 收集哪些数据、为什么收集、与谁共享，以及你可以怎样处理自己的数据。',
    'This policy explains what data Signal Garden collects, why we collect it, who we share it with, and how you can control it.',
  ],
  'privacy.collectTitle': ['1. 我们收集什么', '1. What we collect'],
  'privacy.collectP1': [
    '我们收集注册和登录所需的邮箱地址。密码由 Supabase Auth 处理，以哈希形式存储，我们不保存明文密码。',
    'We collect the email address needed for registration and login. Passwords are handled by Supabase Auth and stored as hashes; we do not store plaintext passwords.',
  ],
  'privacy.collectP2': [
    '为了提供服务，我们还会保存收藏、关注、兴趣选择和邮件发送状态。匿名本地收藏只存在你的浏览器 localStorage 中，除非你登录后主动使用账号收藏。',
    'To provide the service, we also store saves, follows, interest selections and email delivery state. Anonymous local saves stay in your browser localStorage unless you use account saves while signed in.',
  ],
  'privacy.collectP3': [
    '我们不向读者收费，也不收集银行卡号。',
    'We do not charge readers, and we do not collect card numbers.',
  ],
  'privacy.whyTitle': ['2. 我们为什么收集', '2. Why we collect it'],
  'privacy.whyP1': [
    '邮箱用于注册、登录、邮箱验证和必要的账户通知。使用数据用于提供收藏、关注、推荐和每周一周刊。技术日志用于防滥用、排查故障和保障服务安全。',
    'Email is used for registration, login, email verification and necessary account notices. Usage data supports saves, follows, recommendations and the Monday weekly digest. Technical logs help prevent abuse, debug failures and keep the service secure.',
  ],
  'privacy.useTitle': ['3. 我们怎么用', '3. How we use it'],
  'privacy.use1': ['验证你的邮箱并创建账户。', 'Verify your email and create your account.'],
  'privacy.use2': ['保持登录会话，让你不需要每次重新登录。', 'Keep your login session so you do not need to sign in again each time.'],
  'privacy.use3': ['保存你的收藏、关注和兴趣选择。', 'Store your saves, follows and interest selections.'],
  'privacy.use4': ['发送你要求的邮件，例如每周一周刊或账户通知。', 'Send email you request, such as the Monday weekly digest or account notices.'],
  'privacy.use5': ['检测批量注册和滥用。', 'Detect bulk registration and abuse.'],
  'privacy.use6': ['排查服务故障并改进产品可靠性。', 'Debug service failures and improve product reliability.'],
  'privacy.shareTitle': ['4. 我们和谁共享', '4. Who we share it with'],
  'privacy.shareP1': [
    '我们不出售你的个人信息。为了运行服务，我们会使用以下第三方处理者：',
    'We do not sell your personal information. We use the following processors to run the service:',
  ],
  'privacy.share2': ['Supabase：身份认证和数据库托管。', 'Supabase: authentication and database hosting.'],
  'privacy.share3': ['Resend：发送验证码、欢迎邮件和其他事务邮件。', 'Resend: verification codes, welcome email and other transactional mail.'],
  'privacy.share4': [
    '访问统计脚本（仅在配置后加载）：由我们选择的第一方或注重隐私的统计服务汇总页面浏览和来源。未配置时不向任何统计服务发送访问。',
    'Visitor analytics script (only when configured): a first-party or privacy-friendly analytics service we choose aggregates pageviews and referrers. Until a script is configured, visits are not sent to an analytics service.',
  ],
  'privacy.share5': [
    'Resend：发送每周一周刊。邮件数据可能在美国或日本处理。',
    'Resend: delivery of the Monday weekly digest. Mail data may be processed in the United States or Japan.',
  ],
  'privacy.storageTitle': ['5. 数据存储在哪里、存多久', '5. Where and how long we store data'],
  'privacy.storageP1': [
    '网站服务器位于香港。Supabase 身份认证与数据库当前托管在韩国首尔区域，这意味着数据会跨境传输到这些服务所在地。如果配置了访问统计脚本，页面浏览请求会发到该脚本所在的服务，区域以该服务为准。',
    'The website server is in Hong Kong. Supabase authentication and database services are currently hosted in the Seoul, South Korea region, which means data is transferred across borders to those service locations. If a visitor analytics script is configured, pageview requests go to that service, in whatever region it uses.',
  ],
  'privacy.storageP2': [
    '账户数据在账户存续期间保留；删除账户后，我们会在 30 天内清除账户资料和与之关联的用户数据，法律、税务或支付争议要求保留的记录除外。',
    'Account data is kept while the account exists. After account deletion, we remove profile and associated user data within 30 days, except records we must keep for legal, tax or payment-dispute reasons.',
  ],
  'privacy.rightsTitle': ['6. 你的权利', '6. Your rights'],
  'privacy.rightsP1': [
    '你可以访问、更正、删除或导出自己的数据，也可以退订非事务邮件。发邮件到 hello@signalgarden.site 即可提出请求；我们通常会在 30 天内回复。',
    'You can access, correct, delete or export your data, and unsubscribe from non-transactional email. Email hello@signalgarden.site to make a request; we normally respond within 30 days.',
  ],
  'privacy.cookiesTitle': ['7. Cookie 与跟踪', '7. Cookies and tracking'],
  'privacy.cookiesP1': [
    '我们使用登录会话所需的 Cookie，以及 localStorage 中的语言、主题和匿名收藏偏好。首页以不使用 Cookie 的方式汇总项目卡片和任务入口的曝光、点击次数；这些计数不保存用户标识、IP 地址、搜索内容或来源页面，也不用于识别回访用户。开启 Do Not Track 或 Global Privacy Control 时不发送这些计数。站点还可以在配置之后加载一段第一方或注重隐私的访问统计脚本，用来汇总页面浏览和来源；未配置时不加载。我们不使用分析类 Cookie，也不接入广告追踪。',
    'We use cookies required for login sessions and localStorage for language, theme and anonymous saves. Cookieless homepage counters aggregate project-card and task-link impressions and clicks. These counters do not store user identifiers, IP addresses, search text or referrers, or identify returning visitors. Those counters are not sent when Do Not Track or Global Privacy Control is enabled. The site may also load a first-party or privacy-friendly visitor analytics script, when one is configured, to aggregate pageviews and referrers. Nothing is loaded when it is not configured. We do not use analytics cookies or advertising trackers.',
  ],
  'privacy.cookiesLink': ['查看 Cookie 政策', 'View Cookie Policy'],
  'privacy.childrenTitle': ['8. 儿童', '8. Children'],
  'privacy.childrenP1': [
    '本服务不面向 13 岁以下儿童。我们不会有意收集 13 岁以下儿童的个人信息。',
    'The service is not directed to children under 13. We do not knowingly collect personal information from children under 13.',
  ],
  'privacy.changesTitle': ['9. 政策变更', '9. Changes to this policy'],
  'privacy.changesP1': [
    '如果政策发生实质变化，我们会更新本页日期，并通过邮件或站内提示通知你。继续使用服务表示你接受更新后的政策。',
    'If this policy changes materially, we will update the date on this page and notify you by email or in-product notice. Continued use means you accept the updated policy.',
  ],
  'privacy.newsletterTitle': ['11. 每周一周刊', '11. Monday weekly digest'],
  'privacy.newsletterP1': [
    '如果你订阅每周一周刊，我们会保存你的邮箱、订阅语言、同意时间，以及同意当时 IP 地址的哈希和浏览器标识。我们不保存明文 IP。',
    'If you subscribe to the Monday weekly digest, we store your email address, language, the time you consented, a hash of the IP address at that moment, and the browser identifier. We do not store the raw IP address.',
  ],
  'privacy.newsletterP2': [
    '这些信息只用于发送 Signal Garden 每周一周刊，以及处理确认、退订、退信和投诉。',
    'We use this only to send the Signal Garden Monday weekly digest and to handle confirmation, unsubscribe, bounces and complaints.',
  ],
  'privacy.newsletterP3': [
    '邮件由 Resend 代发。Resend 可能在美国或日本处理这些数据。我们不开启打开追踪，也不开启点击追踪。',
    'Resend sends the mail. Resend may process this data in the United States or Japan. We do not enable open tracking or click tracking.',
  ],
  'privacy.newsletterP4': [
    '每一封每周一周刊都可以一键退订，不需要登录。',
    'Each Monday weekly digest can be unsubscribed in one click, with no login.',
  ],
  'privacy.newsletterP5': [
    '退订后 30 天内我们会删除邮箱地址，只保留邮箱的哈希，用来识别这个地址，避免在没有新的确认时再次把它加入发送名单。',
    'Within 30 days of unsubscribe we delete the email address and keep only a hash of it, so we can recognize the address and will not add it back to the send list without a new confirmation.',
  ],
  'privacy.newsletterP6': [
    '我们会记录这次订阅的来源页面和活动标签，这条记录不包含 IP 地址。',
    'We record the referring page and campaign tag for the signup, and that record does not include an IP address.',
  ],
  'privacy.contactTitle': ['10. 联系方式', '10. Contact'],
  'privacy.contactP1': [
    '隐私问题、数据请求或投诉都可以发到 hello@signalgarden.site。',
    'Send privacy questions, data requests or complaints to hello@signalgarden.site.',
  ],

  /* ── Terms ───────────────────────────────────────────────────────── */
  'terms.kicker': ['服务条款', 'TERMS'],
  'terms.title': ['服务条款', 'Terms of Service'],
  'terms.intro': [
    '这些条款说明你使用 Signal Garden 时的规则。使用服务即表示你同意这些条款。',
    'These terms explain the rules for using Signal Garden. By using the service, you agree to them.',
  ],
  'terms.acceptTitle': ['1. 接受条款', '1. Acceptance'],
  'terms.acceptP1': [
    '访问或使用 Signal Garden，即表示你同意本条款和隐私政策。如果你不同意，请不要使用服务。',
    'By accessing or using Signal Garden, you agree to these terms and the Privacy Policy. If you do not agree, do not use the service.',
  ],
  'terms.serviceTitle': ['2. 服务说明', '2. The service'],
  'terms.serviceP1': [
    'Signal Garden 自动发现、索引和摘要公开的开发者项目，帮助你判断哪些项目值得打开。项目内容主要来自 GitHub 等公开来源。',
    'Signal Garden automatically discovers, indexes and summarizes public developer projects to help you decide what is worth opening. Project content comes mainly from public sources such as GitHub.',
  ],
  'terms.serviceP2': [
    '部分说明由 AI 辅助翻译、归纳和改写；数字和事实尽量来自解析器与公开 API。我们尽力保持准确，但不保证内容 100% 准确、完整或持续可用。',
    'Some descriptions are translated, summarized or rewritten with AI assistance; figures and facts are intended to come from parsers and public APIs. We work to keep it accurate, but do not guarantee that content is 100% accurate, complete or continuously available.',
  ],
  'terms.accountTitle': ['3. 账户规则', '3. Accounts'],
  'terms.accountP1': [
    '你需要提供真实邮箱，妥善保管密码，并对账户下发生的活动负责。禁止批量注册、共享账户或绕过限制。',
    'You must provide a real email address, keep your password secure and remain responsible for activity under your account. Bulk registration, account sharing and limit evasion are prohibited.',
  ],
  'terms.useTitle': ['4. 可接受使用', '4. Acceptable use'],
  'terms.useP1': [
    '你可以正常浏览、搜索和收藏项目。不得爬取整站、滥用接口、规避使用限制、转售内容，或用自动化方式对服务造成不合理负载。',
    'You may browse, search and save projects normally. You may not scrape the whole site, abuse APIs, bypass usage limits, resell content or place unreasonable automated load on the service.',
  ],
  'terms.paidTitle': ['5. 收费', '5. Charges'],
  'terms.paidP1': [
    'Signal Garden 不向读者出售订阅。',
    'Signal Garden does not sell a subscription to readers.',
  ],
  'terms.paidP2': [
    '品牌合作见赞助页，来信 hello@signalgarden.site。',
    'Brand partnerships are on the sponsor page. Email hello@signalgarden.site.',
  ],
  'terms.ipTitle': ['6. 知识产权', '6. Intellectual property'],
  'terms.ipP1': [
    '网站的设计、代码、编排、摘要和评分属于 Signal Garden 或其许可方。被收录的开源项目仍归各自作者所有，我们只做索引、链接和摘要。',
    'The site design, code, arrangement, summaries and scoring belong to Signal Garden or its licensors. Listed open-source projects remain owned by their authors; we only index, link and summarize them.',
  ],
  'terms.disclaimerTitle': ['7. 免责声明', '7. Disclaimer'],
  'terms.disclaimerP1': [
    '服务按“现状”和“可用”状态提供。我们不保证第三方项目的内容、安全性、许可证、可用性或维护状态。',
    'The service is provided “as is” and “as available”. We do not guarantee the content, security, license, availability or maintenance status of third-party projects.',
  ],
  'terms.disclaimerP2': [
    '你自行决定是否安装、运行或依赖任何第三方项目。因此产生的后果由你自行承担。',
    'You decide whether to install, run or rely on any third-party project. You are responsible for the consequences.',
  ],
  'terms.liabilityTitle': ['8. 责任限制', '8. Limitation of liability'],
  'terms.liabilityP1': [
    '在法律允许的最大范围内，Signal Garden 不对间接、附带、特殊、后果性或惩罚性损失负责，包括数据丢失、利润损失或第三方项目造成的问题。',
    'To the maximum extent permitted by law, Signal Garden is not liable for indirect, incidental, special, consequential or punitive damages, including data loss, lost profits or problems caused by third-party projects.',
  ],
  'terms.changeTitle': ['9. 服务变更与终止', '9. Changes and termination'],
  'terms.changeP1': [
    '我们可以增加、修改或停止部分功能，也可以因违规、安全风险或法律要求暂停账户。重大变更会通过站内或邮件通知。',
    'We may add, change or discontinue features, and may suspend accounts for abuse, security risk or legal requirements. Material changes will be announced in-product or by email.',
  ],
  'terms.lawTitle': ['10. 运营方与适用法律', '10. Operator and governing law'],
  'terms.lawP1': [
    'Signal Garden 目前由位于中国的个人独立运营。除适用的强制性消费者保护规则另有规定外，本条款受中华人民共和国法律管辖。与本服务有关的争议应先通过 hello@signalgarden.site 友好协商；协商不成的，可向有管辖权的人民法院提起诉讼。',
    'Signal Garden is currently operated by an independent individual based in China. Except where mandatory consumer-protection rules provide otherwise, these terms are governed by the laws of the People\'s Republic of China. Please first contact hello@signalgarden.site to resolve any dispute informally; unresolved disputes may be brought before a court with competent jurisdiction.',
  ],
  'terms.contactTitle': ['11. 联系方式', '11. Contact'],
  'terms.contactP1': [
    '条款问题请联系 hello@signalgarden.site。',
    'For questions about these terms, contact hello@signalgarden.site.',
  ],

  /* ── Refund ──────────────────────────────────────────────────────── */
  'refund.kicker': ['退款政策', 'REFUNDS'],
  'refund.title': ['退款政策', 'Refund Policy'],
  'refund.intro': [
    'Signal Garden 不向读者收费，因此没有可退的订单。',
    'Signal Garden does not charge readers, so there is no order to refund.',
  ],
  'refund.summary': [
    '简单说：没有向读者收费的订单，也就没有退款。',
    'In short: there is no reader charge, and nothing to refund.',
  ],
  'refund.canTitle': ['1. 能不能退？', '1. Can I get a refund?'],
  'refund.canP1': [
    '目前没有向读者收费，因此没有可申请的退款。',
    'There is no charge to readers, so there is no refund to request.',
  ],
  'refund.daysTitle': ['2. 多久内可以退？', '2. How long do I have?'],
  'refund.daysP1': [
    '从付款成功时间起算 14 个自然日内。超过 14 天后，通常不再接受退款，但消费者法律赋予你的权利不受影响。',
    'Within 14 calendar days from the successful payment. After 14 days, refunds are normally unavailable, but rights granted by your local consumer law are not affected.',
  ],
  'refund.howTitle': ['3. 怎么申请？', '3. How do I request one?'],
  'refund.howP1': [
    '发邮件到 hello@signalgarden.site，写明订单邮箱、订单号或付款时间，并简单说明原因。',
    'Email hello@signalgarden.site with your order email, order number or payment time, and a short reason.',
  ],
  'refund.timeTitle': ['4. 多久处理？', '4. How long does processing take?'],
  'refund.timeP1': [
    '我们会在 5 个工作日内回复。通过审核后，退款由 Dodo Payments 提交，银行或支付渠道入账时间可能再需要 5–10 个工作日。',
    'We reply within 5 business days. Once approved, Dodo Payments submits the refund; banks or payment channels may take another 5–10 business days to post it.',
  ],
  'refund.whereTitle': ['5. 退到哪里？', '5. Where does the money go?'],
  'refund.whereP1': [
    '退款会通过 Dodo Payments 原路退回原支付方式。我们无法把钱退到另一个卡、另一个支付宝或其他账户。',
    'Refunds are returned by Dodo Payments to the original payment method. We cannot send a refund to a different card, Alipay account or other destination.',
  ],
  'refund.noTitle': ['6. 什么情况不退？', '6. When is a refund not available?'],
  'refund.no1': ['超过 14 天的周期。', 'A billing period older than 14 days.'],
  'refund.no2': ['同一账户重复购买后再次以相同理由申请退款。', 'A repeat purchase on the same account refunded for the same reason.'],
  'refund.no3': ['因违规、欺诈、转售或滥用被封号的账户。', 'Accounts suspended for abuse, fraud, resale or misuse.'],
  'refund.no4': ['法律或 Dodo Payments 政策要求我们拒绝的情况。', 'Cases where law or Dodo Payments policy requires us to refuse.'],
  'refund.diffTitle': ['7. 取消订阅 vs 退款', '7. Cancelling vs refunding'],
  'refund.diffP1': [
    '取消：停止下一次扣费，当前周期内仍可使用到周期结束，已付的当期不退。',
    'Cancel: stops the next charge. You keep access until the end of the current period; the paid period is not refunded.',
  ],
  'refund.diffP2': [
    '退款：把已付的钱退回。当前没有这类订单。',
    'Refund: returns money already paid. There is no such order today.',
  ],
  'refund.duplicateTitle': ['8. 重复扣费 / 误扣', '8. Duplicate or mistaken charges'],
  'refund.duplicateP1': [
    '如果你发现重复扣费或误扣，请立即发邮件给我们，并附上订单邮箱、Dodo Payments 收据和扣费日期。确认后会优先处理退款。',
    'If you see a duplicate or mistaken charge, email us immediately with the order email, Dodo Payments receipt and charge date. Once confirmed, we prioritise the refund.',
  ],
  'refund.applyTitle': ['申请退款', 'REQUEST A REFUND'],
  'refund.applyBody': [
    '请用注册邮箱发送邮件，主题写“Refund request / 退款申请”。',
    'Send from your registered email with the subject “Refund request / 退款申请”.',
  ],
  'refund.mailButton': ['发送退款申请邮件', 'Email a refund request'],
  'refund.template': [
    '邮件模板：\n主题：Refund request / 退款申请\n订单邮箱：\nDodo Payments 订单号或付款时间：\n退款原因：',
    'Email template:\nSubject: Refund request / 退款申请\nOrder email:\nDodo Payments order number or payment time:\nReason:',
  ],
  'refund.lawTitle': ['消费者法律', 'Consumer law'],
  'refund.lawP1': [
    '如果你所在地区的消费者法律赋予你更多权利，以法律为准。',
    'If the consumer law in your region gives you more rights, those rights prevail.',
  ],

  /* ── Cookies ─────────────────────────────────────────────────────── */
  'cookies.kicker': ['Cookie 政策', 'COOKIES'],
  'cookies.title': ['Cookie 政策', 'Cookie Policy'],
  'cookies.intro': [
    '这份政策列出 Signal Garden 实际使用的 Cookie 和 localStorage。访问统计脚本只在配置后加载，而且是第一方或注重隐私的脚本。我们没有 Cookie 同意横幅，因为没有非必需的跟踪 Cookie。',
    'This policy lists the cookies and localStorage actually used by Signal Garden. A visitor analytics script loads only when configured, and only as a first-party or privacy-friendly script. We do not show a consent banner because we do not use non-essential tracking cookies.',
  ],
  'cookies.whatTitle': ['1. 什么是 Cookie', '1. What cookies are'],
  'cookies.whatP1': [
    'Cookie 是网站存在浏览器里的一小段数据，用来记住登录状态或临时偏好。localStorage 也是浏览器存储，但它不是 Cookie，不会随每个 HTTP 请求发送。',
    'Cookies are small pieces of data a site stores in your browser to remember login state or temporary preferences. localStorage is also browser storage, but it is not a cookie and is not sent with every HTTP request.',
  ],
  'cookies.essentialTitle': ['2. 严格必需的 Cookie', '2. Strictly necessary cookies'],
  'cookies.essentialP1': [
    '我们使用 Supabase Auth 的登录会话 Cookie。它们用于保持登录、刷新会话和防止未授权访问，不能关闭。',
    'We use Supabase Auth session cookies to keep you signed in, refresh sessions and prevent unauthorised access. They cannot be disabled while you use an account.',
  ],
  'cookies.essential1': ['名称：由 Supabase SDK 管理，通常以 sb-...-auth-token 开头。', 'Name: managed by the Supabase SDK, usually starting with sb-...-auth-token.'],
  'cookies.essential2': ['用途：登录会话、身份验证、安全。', 'Purpose: login session, authentication and security.'],
  'cookies.essential3': ['存储时长：由 Supabase Auth 根据会话和刷新策略设置。', 'Duration: set by Supabase Auth according to its session and refresh policy.'],
  'cookies.functionalTitle': ['3. 功能性 localStorage', '3. Functional localStorage'],
  'cookies.functionalP1': [
    '这些数据存在浏览器 localStorage 中，不上传到服务器，除非你主动登录后使用账号收藏。你可以随时清除浏览器数据。',
    'This data is stored in browser localStorage and is not uploaded unless you sign in and use account saves. You can clear it at any time through browser settings.',
  ],
  'cookies.functional1': ['signal-garden:lang：记住中英文语言选择。', 'signal-garden:lang: remembers your Chinese or English language choice.'],
  'cookies.functional2': ['signal-garden:theme：记住深色或浅色主题。', 'signal-garden:theme: remembers dark or light theme.'],
  'cookies.functional3': ['signal-garden:saved：保存匿名本地收藏的项目 slug。', 'signal-garden:saved: stores project slugs saved anonymously on this device.'],
  'cookies.analyticsTitle': ['4. 访问统计', '4. Visitor analytics'],
  'cookies.analyticsP1': [
    '我们不使用分析类 Cookie，也不接入广告追踪。首页有一套第一方、不使用 Cookie 的计数，只汇总卡片和任务入口的曝光与点击，不设置分析标识、不读取账号 Cookie，也不保存 IP、搜索词或来源页面。开启 Do Not Track 或 Global Privacy Control 时，这些计数不会发送。另外，如果配置了访问统计脚本，我们会加载那一段第一方或注重隐私的脚本，用来汇总页面浏览和来源；没有配置就不会加载。如果未来改用会设置 Cookie 的统计工具，我们会先更新本政策并重新评估是否需要同意横幅。',
    'We do not use analytics cookies or advertising trackers. First-party cookieless counters aggregate homepage card and task-link impressions and clicks, without an analytics identifier, account cookies, or stored IP addresses, search text or referrers. Those counters are not sent when Do Not Track or Global Privacy Control is enabled. Separately, when a visitor analytics script is configured, we load that first-party or privacy-friendly script to aggregate pageviews and referrers. When it is not configured, we load nothing. If we later use an analytics tool that sets cookies, we will update this policy first and reassess whether a consent banner is required.',
  ],
  'cookies.thirdTitle': ['5. 第三方 Cookie', '5. Third-party cookies'],
  'cookies.thirdP1': [
    'Supabase 可能在与身份认证有关的请求中设置 Cookie。我们不运行收款结账。',
    'Supabase may set cookies in requests related to authentication. We do not run a checkout.',
  ],
  'cookies.manageTitle': ['6. 如何管理 Cookie', '6. How to manage cookies'],
  'cookies.manageP1': [
    '你可以在浏览器设置中删除或阻止 Cookie 和 localStorage。阻止必需 Cookie 会导致无法登录或保持账户会话。',
    'You can delete or block cookies and localStorage in your browser settings. Blocking necessary cookies will prevent login or account sessions from working.',
  ],
  'cookies.contactTitle': ['7. 联系与更新', '7. Contact and updates'],
  'cookies.contactP1': [
    'Cookie 问题请联系 hello@signalgarden.site。本政策变更时会更新本页日期。',
    'For cookie questions, contact hello@signalgarden.site. When this policy changes, we update the date on this page.',
  ],


  /* ── 登录 / 注册（客户端组件用 useLang + t() 取名）────────────────── */
  'lg.hero': ['收藏项目、关注变化，建立属于你自己的 Signal Garden。', 'Save projects, follow what changes, and grow your own Signal Garden.'],
  'lg.google': ['使用 Google 继续', 'Continue with Google'],
  'lg.or': ['或', 'or'],
  'lg.email': ['邮箱', 'Email'],
  'lg.password': ['密码', 'Password'],
  'lg.passwordNew': ['密码（8–20 位）', 'Password (8–20 characters)'],
  'lg.passwordConfirm': ['再输一次密码', 'Confirm password'],
  'lg.code': ['验证码', 'Verification code'],
  'lg.forgot': ['忘记密码', 'Forgot password'],
  'lg.signIn': ['登录', 'Sign in'],
  'lg.signUp': ['注册', 'Create account'],
  'lg.busy': ['处理中…', 'Working…'],
  'lg.createTitle': ['创建账号', 'Create your account'],
  'lg.createSub': ['我们会给你发一个 6 位验证码。', 'We will email you a 6-digit code.'],
  'lg.sendCode': ['发送验证码', 'Send code'],
  'lg.codeTitle': ['输入验证码', 'Enter your code'],
  'lg.changeEmail': ['← 换一个邮箱', '← Use a different email'],
  'lg.noAccount': ['还没有账号？', 'No account yet?'],
  'lg.hasAccount': ['已经有账号？', 'Already have an account?'],
  'lg.agreePrefix': ['继续即表示你同意', 'By continuing you agree to the'],
  'lg.and': ['和', 'and'],
  'lg.terms': ['服务条款', 'Terms of Service'],
  'lg.privacy': ['隐私政策', 'Privacy Policy'],
  'lg.errSend': ['发送失败。', 'Could not send the code.'],
  'lg.errSignup': ['注册失败。', 'Could not create the account.'],
  'lg.errConfig': ['服务未配置。', 'Sign-in is not configured.'],
  'lg.msgCodeSent': ['验证码已发送，请检查邮箱（含垃圾邮件）。', 'Code sent. Check your inbox and spam folder.'],
  'lg.msgResetSent': ['已发送重置邮件，请检查邮箱。', 'Reset email sent. Check your inbox.'],
  'lg.errPasswordLen': ['密码需要 8–20 位。', 'Password must be 8–20 characters.'],
  'lg.errPasswordMatch': ['两次输入的密码不一致。', 'The two passwords do not match.'],
  'lg.errInvalidEmail': ['请输入有效的邮箱地址。', 'Enter a valid email address.'],
  'lg.errCooldown': ['验证码刚发过，请 60 秒后再试。', 'A code was just sent. Try again in 60 seconds.'],
  'lg.errCodeFormat': ['验证码应为 6 位数字。', 'The code must be 6 digits.'],
  'lg.errCodeInvalid': ['验证码错误或已过期。', 'That code is wrong or has expired.'],
  'lg.errEmailTaken': ['这个邮箱已经注册过了，请直接登录。', 'That email is already registered — sign in instead.'],

  /* ── 引导页（客户端组件用 T / useLang）───────────────────────────── */
  'ob.kicker': ['开始使用', 'GETTING STARTED'],
  'ob.title': ['你对什么感兴趣？', 'What are you interested in?'],
  'ob.body': [
    '先选几个方向。以后 Personalized Garden 会用这些兴趣，为你挑新的信号。',
    'Pick a few directions. Personalized Garden will use these interests to surface new signals for you.',
  ],
  'ob.saving': ['保存中…', 'Saving…'],
  'ob.continue': ['继续', 'Continue'],
} as const satisfies Record<string, Pair>;

export type DictKey = keyof typeof DICT;

/** 取一个键的两种语言。缺失时返回键名本身（便于发现漏配）。 */
export function pair(k: DictKey): { zh: string; en: string } {
  const v = DICT[k];
  return v ? { zh: v[0], en: v[1] } : { zh: String(k), en: String(k) };
}

/**
 * 字典文本组件 —— 渲染两种语言，由 CSS 决定显示哪个。
 *
 * 这是主力用法：服务端组件、客户端组件都能用，不需要 JS。
 * 交叉淡入由 globals.css 的 [data-lang-pair] 规则处理。
 */
export function T({
  k,
  as,
  className,
  style,
  /** 替换 {n} / {name} 这类占位符 */
  vars,
  /** 是否走 220ms 交叉淡入（块级文案建议开启） */
  fade = true,
}: {
  k: DictKey;
  as?: React.ComponentProps<typeof LANG>['as'];
  className?: string;
  style?: React.CSSProperties;
  vars?: Record<string, string | number>;
  fade?: boolean;
}) {
  let { zh, en } = pair(k);
  if (vars) {
    for (const [key, val] of Object.entries(vars)) {
      const token = `{${key}}`;
      zh = zh.split(token).join(String(val));
      en = en.split(token).join(String(val));
    }
  }
  return <LANG zh={zh} en={en} as={as} className={className} style={style} fade={fade} />;
}

/** 非渲染场景（<title>、meta、aria-label 的纯字符串）取单一语言。 */
export function t(lang: 'zh' | 'en', k: DictKey, vars?: Record<string, string | number>): string {
  // 显式标注 string：DICT 用了 as const，直接取会得到字面量联合类型，
  // 后面 split/join 的结果（string）就赋不进去。
  let s: string = lang === 'en' ? DICT[k][1] : DICT[k][0];
  if (vars) {
    for (const [key, val] of Object.entries(vars)) {
      s = s.split(`{${key}}`).join(String(val));
    }
  }
  return s;
}

/**
 * 取一对语言，用于**服务端组件**构造数据。
 *
 * 服务端在渲染时不知道客户端选了哪种语言（那是 <html data-lang> 上的属性），
 * 所以服务端不能"先选一种"。正确做法是两种都带上，交给 CSS 决定显示哪个 ——
 * 这也是整个双语机制的基础（见 globals.css 的 lang-pair 规则）。
 */
export function bi(k: DictKey, vars?: Record<string, string | number>): { zh: string; en: string } {
  return { zh: t('zh', k, vars), en: t('en', k, vars) };
}

/** 语言中立的值（纯数字、百分比、专有名词）包成一对，两种语言相同。 */
export function both(s: string): { zh: string; en: string } {
  return { zh: s, en: s };
}
