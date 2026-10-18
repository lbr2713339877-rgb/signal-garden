/**
 * The GitHub search matrix — the discovery half of the pipeline.
 *
 * Search only finds candidates. Whether something is a Skill is decided later
 * by reading its files (src/parsers), never by the fact that a query matched.
 */

import { ghGet } from "./client";

export interface SearchQuery {
  id: string;
  kind: "repo" | "code";
  q: string;
  /** Pages of 100. Search caps at 1000 results per query. */
  pages: number;
}

export interface DiscoveredRepo {
  githubId: number;
  nodeId: string;
  fullName: string;
  owner: string;
  name: string;
  htmlUrl: string;
  description: string | null;
  fork: boolean;
  /** Only present from repository search; code search omits counts. */
  stars?: number;
  forks?: number;
  topics?: string[];
  language?: string | null;
  createdAt?: string;
  pushedAt?: string;
  archived?: boolean;
  homepage?: string | null;
  license?: string | null;
  matchedQueries: Set<string>;
  /** SKILL.md paths seen via code search — a strong hint worth prioritising. */
  codeHitPaths: Set<string>;
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Query matrix, scoped to the product's focus themes (src/normalizers/focus.ts):
 * indie-site building, design, motion, and token saving.
 *
 * Two families of queries, on purpose:
 *
 *   A. Skill-type — `filename:SKILL.md` code search plus MCP/agent keyword
 *      repo search. These find AI skills and servers.
 *   B. Resource-type — libraries, component kits, fonts, analytics, auth,
 *      CMS, animation runtimes, prompt/token utilities. These have no
 *      SKILL.md at all, and the old matrix could never find them: a search
 *      restricted to `filename:SKILL.md` only ever returns repos that contain
 *      that file. Lenis, GSAP, React Bits and uiverse/galaxy all lived outside
 *      discovery because of it.
 *
 * Query ids follow `focus:<theme>:<code|repo>:<slug>`; the focus scorer reads
 * the theme and kind back out of them. Dates roll forward on every run.
 *
 * Keyword repo queries match name/description only. `in:readme` was dropped
 * after the first live run: a README full-text match pulled in huge unrelated
 * repos (sindresorhus/awesome, a Java interview guide).
 */
export function buildQueryMatrix(): SearchQuery[] {
  const active = isoDaysAgo(60);
  const fresh = isoDaysAgo(30);

  const repo = (theme: string, slug: string, q: string, pages = 1): SearchQuery => ({ id: `focus:${theme}:repo:${slug}`, kind: "repo", q, pages });
  const code = (theme: string, slug: string, q: string, pages = 2): SearchQuery => ({ id: `focus:${theme}:code:${slug}`, kind: "code", q, pages });

  return [
    // Consumer products and playful experiments: refreshed every discovery run.
    repo('play', 'telegram-bot', `topic:telegram-bot deepseek stars:>=20 pushed:>${active}`, 2),
    repo('play', 'ai-bot', `topic:ai-bot stars:>=20 pushed:>${active}`, 2),
    repo('play', 'personal-assistant', `personal AI assistant in:name,description stars:>=20 pushed:>${active}`),
    repo('play', 'video-editing', `topic:video-editing stars:>=20 pushed:>${active}`, 2),
    repo('play', 'video-generation', `topic:video-generation stars:>=20 pushed:>${active}`),
    repo('play', 'creative-coding', `topic:creative-coding stars:>=20 pushed:>${active}`),
    repo('play', 'browser-game', `topic:browser-game stars:>=20 pushed:>${active}`),
    repo('play', 'new-ai-bot', `AI bot in:name,description created:>${fresh} stars:>=20`),
    repo('play', 'musebot', 'repo:yincongcyincong/MuseBot'),
    repo('play', 'onetake', 'repo:feitangyuan/onetake'),
    // --- 动效 Motion
    code("motion", "animation", "animation filename:SKILL.md", 3),
    code("motion", "gsap", "gsap filename:SKILL.md"),
    code("motion", "framer-motion", '"framer motion" filename:SKILL.md'),
    code("motion", "threejs", "three.js filename:SKILL.md"),
    repo("motion", "topic-animation", `topic:animation stars:>=50 pushed:>${active}`, 2),
    repo("motion", "topic-framer-motion", `topic:framer-motion stars:>=30`),
    repo("motion", "topic-gsap", `topic:gsap stars:>=30`),
    repo("motion", "animated-components", `"animated components" in:name,description`),
    repo("motion", "animation-skill", `animation skill in:name,description`),

    // --- 设计与 UI Design
    code("design", "design-system", '"design system" filename:SKILL.md', 3),
    code("design", "ui-ux", '"UI/UX" filename:SKILL.md'),
    code("design", "figma", "figma filename:SKILL.md"),
    code("design", "typography", "typography filename:SKILL.md"),
    repo("design", "design-skill", `design skill in:name,description`, 2),
    repo("design", "ui-ux-ai", `ui ux claude in:name,description`),
    repo("design", "figma-mcp", `figma mcp in:name,description`),
    repo("design", "design-agent", `design agent in:name,description pushed:>${active}`),

    // --- 独立站开发 Indie web
    code("web", "landing-page", '"landing page" filename:SKILL.md', 3),
    code("web", "tailwind", "tailwind filename:SKILL.md"),
    code("web", "nextjs", "next.js filename:SKILL.md"),
    code("web", "seo", "SEO filename:SKILL.md"),
    repo("web", "landing-page", `landing page ai in:name,description pushed:>${active}`),
    repo("web", "website-builder", `website builder ai in:name,description pushed:>${active}`),
    repo("web", "saas-boilerplate", `saas boilerplate in:name,description pushed:>${active}`),
    repo("web", "vibe-coding", `vibe coding in:name,description`),

    // --- 省 Token
    code("token", "save-tokens", '"save tokens" filename:SKILL.md'),
    code("token", "token-usage", '"token usage" filename:SKILL.md'),
    code("token", "context-window", '"context window" filename:SKILL.md'),
    repo("token", "token-saving", `token saving in:name,description`),
    repo("token", "reduce-tokens", `reduce tokens in:name,description`),
    repo("token", "context-compression", `context compression in:name,description`),
    repo("token", "prompt-compression", `prompt compression in:name,description`),
    repo("token", "topic-context-engineering", `topic:context-engineering`),

    // --- Resources that are useful without shipping a SKILL.md at all:
    // component libraries, UI kits, animation collections. uiverse-io/galaxy
    // is the reference example — 13k stars, pure CSS/Tailwind components, no
    // SKILL.md anywhere. The SKILL.md queries above can never find these.
    repo("web", "ui-library", `ui library tailwind in:name,description stars:>=200`, 2),
    repo("web", "component-library", `component library in:name,description stars:>=300`, 2),
    repo("design", "ui-components", `ui components in:name,description stars:>=500`),
    repo("design", "design-resources", `topic:design-resources stars:>=200`),
    repo("design", "ui-kit", `ui kit in:name,description stars:>=300`),
    repo("design", "design-tokens", `topic:design-tokens stars:>=50`),
    repo("design", "component-library", `topic:component-library stars:>=50`),
    repo("design", "icon-set", `topic:icon-set stars:>=100`),
    repo("design", "figma-plugin", `figma plugin in:name,description stars:>=100`),
    repo("motion", "animation-library", `animation library in:name,description stars:>=300`, 2),
    repo("motion", "css-animation", `topic:css-animation stars:>=100`),
    repo("motion", "animated-ui", `animated ui components in:name,description stars:>=200`),
    repo("motion", "lottie", `topic:lottie stars:>=50`),
    repo("motion", "remotion", `remotion in:name,description stars:>=50`),
    repo("web", "topic-tailwindcss", `topic:tailwindcss stars:>=500`, 2),
    repo("web", "astro", `astro site in:name,description stars:>=300`),
    repo("web", "shadcn", `shadcn in:name,description stars:>=200`),
    repo("web", "seo-tool", `seo tool in:name,description stars:>=200`),
    repo("token", "topic-token-optimization", `topic:token-optimization stars:>=10`),
    repo("token", "topic-llm-cost", `topic:llm-cost stars:>=10`),
    repo("token", "prompt-cache", `prompt caching in:name,description stars:>=50`),
    repo("token", "rag-compression", `rag compression in:name,description stars:>=20`),

    // ── Resource-type queries (family B) ─────────────────────────────────
    // Libraries and kits indie builders import or copy. No SKILL.md
    // requirement; star floors stay generous so 200–1000 star projects are not
    // filtered out.

    // Motion — scroll/animation runtimes and interaction primitives.
    repo("motion", "scroll-library", `scroll animation library in:name,description stars:>=200`, 2),
    repo("motion", "spring", `spring animation in:name,description stars:>=200`),
    repo("motion", "transition", `css transition library in:name,description stars:>=200`),
    repo("motion", "cursor", `custom cursor in:name,description stars:>=200`),
    repo("motion", "parallax", `parallax in:name,description stars:>=200`),
    repo("motion", "motion-one", `motion one in:name,description stars:>=200`),
    repo("motion", "autoanimate", `autoanimate in:name,description stars:>=200`),
    repo("motion", "webgl-shader", `webgl shader in:name,description stars:>=200`),

    // Design — assets, type, colour and tokens.
    repo("design", "icon-library", `icon library in:name,description stars:>=300`, 2),
    repo("design", "font", `font in:name,description stars:>=200`),
    repo("design", "color-palette", `color palette in:name,description stars:>=200`),
    repo("design", "design-token", `design token in:name,description stars:>=200`),
    repo("design", "ui-component-kit", `ui component kit in:name,description stars:>=300`, 2),
    repo("design", "tailwind-ui", `tailwind ui components in:name,description stars:>=300`),

    // Indie web — the plumbing a solo builder wires into a site.
    repo("web", "analytics", `self-hosted analytics in:name,description stars:>=300`, 2),
    repo("web", "form", `form library in:name,description stars:>=300`),
    repo("web", "auth", `authentication library in:name,description stars:>=300`),
    repo("web", "cms", `headless cms in:name,description stars:>=300`, 2),
    repo("web", "seo-tool", `seo tool in:name,description stars:>=200`),
    repo("web", "image-optimization", `image optimization in:name,description stars:>=200`),
    repo("web", "email", `transactional email in:name,description stars:>=200`),

    // Token / context — cost and prompt tooling.
    repo("token", "prompt-optimizer", `prompt optimizer in:name,description stars:>=100`),
    repo("token", "context-compression", `context compression in:name,description stars:>=100`),
    repo("token", "llm-cache", `llm cache in:name,description stars:>=100`),
    repo("token", "cost-tracker", `llm cost in:name,description stars:>=100`),

    // ── Known classics (family B, exact) ─────────────────────────────────
    // High-star, genuinely useful libraries whose topics are inconsistent or
    // whose names collide with common words, so topic/keyword search misses
    // them. `repo:` pins the exact repository.
    repo("motion", "lenis", `repo:darkroomengineering/lenis`),
    repo("motion", "gsap", `repo:greensock/GSAP`),
    repo("motion", "threejs", `repo:mrdoob/three.js`),
    repo("motion", "motion", `repo:motiondivision/motion`),
    repo("motion", "autoanimate", `repo:formkit/auto-animate`),
    repo("design", "react-bits", `repo:davidhdev/react-bits`),
    repo("design", "uiverse-galaxy", `repo:uiverse-io/galaxy`),
    repo("design", "vanta", `repo:tengbao/vanta`),
    repo("web", "zod", `repo:colinhacks/zod`),
    repo("web", "prisma", `repo:prisma/prisma`),
    repo("web", "drizzle", `repo:drizzle-team/drizzle-orm`),
    repo("web", "payload", `repo:payloadcms/payload`),
    repo("web", "medusa", `repo:medusajs/medusa`),
    repo("web", "calcom", `repo:calcom/cal.com`),
    repo("web", "resend", `repo:resend/resend-node`),
    repo("design", "sonner", `repo:emilkowalski/sonner`),
    repo("design", "vaul", `repo:emilkowalski/vaul`),

    // --- New repos this month, any theme — the focus scorer decides.
    repo("any", "new-skill", `skill in:name created:>${fresh} stars:>=3`, 2),
    repo("any", "new-design", `design in:name,description created:>${fresh} stars:>=5`),
    repo("any", "new-animation", `animation in:name,description created:>${fresh} stars:>=5`),
  ];
}

interface RepoSearchItem {
  id: number;
  node_id: string;
  full_name: string;
  name: string;
  owner: { login: string };
  html_url: string;
  description: string | null;
  fork: boolean;
  stargazers_count: number;
  forks_count: number;
  topics?: string[];
  language: string | null;
  created_at: string;
  pushed_at: string;
  archived: boolean;
  homepage: string | null;
  license: { spdx_id: string | null } | null;
}

interface CodeSearchItem {
  path: string;
  repository: {
    id: number;
    node_id: string;
    full_name: string;
    name: string;
    owner: { login: string };
    html_url: string;
    description: string | null;
    fork: boolean;
  };
}

interface SearchPage<T> {
  total_count: number;
  items: T[];
}

function merge(map: Map<number, DiscoveredRepo>, base: Omit<DiscoveredRepo, "matchedQueries" | "codeHitPaths">, queryId: string) {
  const existing = map.get(base.githubId);
  if (!existing) {
    map.set(base.githubId, { ...base, matchedQueries: new Set([queryId]), codeHitPaths: new Set() });
    return map.get(base.githubId)!;
  }
  existing.matchedQueries.add(queryId);
  // Repository search carries the richer payload; let it fill gaps.
  for (const [k, v] of Object.entries(base)) {
    if (v !== undefined && (existing as any)[k] === undefined) (existing as any)[k] = v;
  }
  return existing;
}

export interface MatrixProgress {
  query: SearchQuery;
  page: number;
  items: number;
  total: number;
}

export async function runSearchMatrix(
  queries: SearchQuery[],
  onProgress?: (p: MatrixProgress) => void,
): Promise<{ repos: Map<number, DiscoveredRepo>; failures: { id: string; error: string }[] }> {
  const repos = new Map<number, DiscoveredRepo>();
  const failures: { id: string; error: string }[] = [];

  for (const query of queries) {
    try {
      for (let page = 1; page <= query.pages; page++) {
        const q = encodeURIComponent(query.q);
        if (query.kind === "repo") {
          const res = await ghGet<SearchPage<RepoSearchItem>>(
            `/search/repositories?q=${q}&sort=stars&order=desc&per_page=100&page=${page}`,
          );
          const items = res?.items ?? [];
          for (const it of items) {
            merge(repos, {
              githubId: it.id,
              nodeId: it.node_id,
              fullName: it.full_name,
              owner: it.owner.login,
              name: it.name,
              htmlUrl: it.html_url,
              description: it.description,
              fork: it.fork,
              stars: it.stargazers_count,
              forks: it.forks_count,
              topics: it.topics ?? [],
              language: it.language,
              createdAt: it.created_at,
              pushedAt: it.pushed_at,
              archived: it.archived,
              homepage: it.homepage,
              license: it.license?.spdx_id ?? null,
            }, query.id);
          }
          onProgress?.({ query, page, items: items.length, total: res?.total_count ?? 0 });
          if (items.length < 100) break;
        } else {
          const res = await ghGet<SearchPage<CodeSearchItem>>(
            `/search/code?q=${q}&per_page=100&page=${page}`,
          );
          const items = res?.items ?? [];
          for (const it of items) {
            const r = it.repository;
            const entry = merge(repos, {
              githubId: r.id,
              nodeId: r.node_id,
              fullName: r.full_name,
              owner: r.owner.login,
              name: r.name,
              htmlUrl: r.html_url,
              description: r.description,
              fork: r.fork,
            }, query.id);
            entry.codeHitPaths.add(it.path);
          }
          onProgress?.({ query, page, items: items.length, total: res?.total_count ?? 0 });
          if (items.length < 100) break;
        }
      }
    } catch (err) {
      // One failing query must not sink the whole discovery run.
      failures.push({ id: query.id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return { repos, failures };
}
