# Signal Garden

Daily ranking of rising open-source projects. Live site: [https://signalgarden.site](https://signalgarden.site)

Signal Garden collects signals (GitHub activity and related sources), ranks projects for the day, and publishes a `/today` list plus RSS (`/feed.xml`). Optional email newsletter uses double opt-in.

## 特性 / Features

- **每日 GitHub 雷达 / Daily GitHub radar.** 按最近 7 天新增 fork 排序，排名依据是 fork 数量（fork count），而不是 star 总数。Ranked by new forks in the last 7 days; the ranking is by fork count.
- **`/today` 列表 / `/today` list.** 当天的完整榜单。The full list for the day.
- **项目页 / Project pages.** 每个项目有独立页面。Each project has its own page.
- **RSS.** `/feed.xml`
- **周一邮件周报 / Monday weekly email digest.**
- **中英双语 / Bilingual zh/en.**
- **可自托管的 Next.js / Self-hostable Next.js.** 本地 `pnpm install && pnpm dev` 即可运行。
- **MIT.** 见 `LICENSE`。

## Stack

- Next.js (App Router) + React
- Drizzle ORM (PGlite locally, Postgres in production)
- Optional: Resend (email), Cloudflare Turnstile, Umami analytics, Supabase Auth, Stripe

## Quick start

```bash
pnpm install
cp .env.example .env.local
# fill only what you need; leave secrets empty for local mock email
pnpm db:migrate
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Useful scripts:

| Script | Purpose |
|--------|---------|
| `pnpm dev` | Local app |
| `pnpm build` / `pnpm start` | Production build |
| `pnpm test` | Unit tests |
| `pnpm job` | Background jobs CLI (collectors, newsletter) |

## Environment

Copy `.env.example` → `.env.local`. **Never commit** `.env`, `.env.local`, or production env files.

Secrets the live site may use (all optional for a local read-only run):

- `GITHUB_TOKEN` — higher GitHub API rate limit
- `RESEND_API_KEY`, `NEWSLETTER_*`, Turnstile keys — email signup
- `NEXT_PUBLIC_ANALYTICS_*` — Umami / Plausible snippet
- Supabase — accounts. Stripe routes remain in the API and have no public page.

See comments in `.env.example` for the full list.

## License

MIT (see `LICENSE`).
