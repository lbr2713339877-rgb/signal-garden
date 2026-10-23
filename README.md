# Signal Garden

Daily ranking of rising open-source projects. Live site: [https://signalgarden.site](https://signalgarden.site)

Signal Garden collects signals (GitHub activity and related sources), ranks projects for the day, and publishes a `/today` list plus RSS (`/feed.xml`). Optional email newsletter uses double opt-in.

## 特性 / Features

- **每日 GitHub 雷达 / Daily GitHub radar.** 按热度分排序：以近 24 小时和近 7 日的 star 增长为主，兼顾社区讨论、可用性和提交活跃度。Ranked by a momentum score driven mainly by 24-hour and 7-day star growth, plus community discussion, usability and commit activity.
- **`/today` 列表 / `/today` list.** 当天的完整榜单。The full list for the day.
- **项目页 / Project pages.** 每个项目有独立页面。Each project has its own page.
- **RSS.** `/feed.xml`
- **README 徽章 / README badge.** 上过已发布榜单的仓库可在项目页复制 `Featured on | Signal Garden` 徽章。Repos that have appeared in a published edition can copy a badge from the project page.
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
| `pnpm job` | Background jobs CLI (collectors, newsletter, IndexNow) |

## Environment

Copy `.env.example` → `.env.local`. **Never commit** `.env`, `.env.local`, or production env files.

Secrets the live site may use (all optional for a local read-only run):

- `GITHUB_TOKEN` — higher GitHub API rate limit
- `RESEND_API_KEY`, `NEWSLETTER_*`, Turnstile keys — email signup
- `NEXT_PUBLIC_ANALYTICS_*` — Umami / Plausible snippet
- `INDEXNOW_KEY` — public IndexNow key, 32 lowercase hex characters. Empty means `pnpm job indexnow` does nothing. The same value is served at `/<INDEXNOW_KEY>.txt`.
- Supabase — accounts. Stripe routes remain in the API and have no public page.

See comments in `.env.example` for the full list.

## API

`GET /api/today.json` is a public, read-only copy of the current edition (the same list as `/today`).

Each item includes rank, name, `owner` / `repo` when the project is a GitHub repository, the upstream `url`, a `project_url` on this site, Chinese and English descriptions, `stars`, `stars_24h`, `stars_7d`, `heat_score`, `forks_7d` when we have it, and `edition_date`.

Responses send `Access-Control-Allow-Origin: *` and `Cache-Control: public, s-maxage=600`. Apply migration `0016_public_api` (`pnpm db:migrate`) before relying on the request counter.

`project_url` has no tracking parameters. Callers may add an optional `utm_source` (and the other `utm_*` fields) themselves.

## Jobs

`pnpm job daily` pings IndexNow after publish. A missed ping does not unpublish the edition. Run it on its own with:

```bash
pnpm job indexnow
```

That command is a no-op until `INDEXNOW_KEY` is set. It POSTs `https://signalgarden.site/today`, project pages whose first published edition is today, `https://signalgarden.site/`, and `https://signalgarden.site/feed.xml` to `https://api.indexnow.org/indexnow`. The same list is not sent twice on the same day.

Cron to add, in `Asia/Singapore`, after the morning publish:

```cron
20 6 * * * cd /opt/signal-garden && pnpm job indexnow
```

When a GitHub repository is renamed, `project.slug` stays on the old name until it is repaired. Apply migration `0017_project_slug_alias` (`pnpm db:migrate`), back up the database, then:

```bash
pnpm job slugs --dry-run
pnpm job slugs --backfill
```

`--dry-run` lists the rows it would change and writes nothing. `--backfill` stores each previous slug in `project_slug_alias` and moves `project.slug` to `toSlug(full_name)` when that name is free. Old `/p/<slug>` links then redirect with 308. Sitemap, IndexNow, `/api/today.json`, the feed, emails and cards keep using the current `project.slug`. This command is not part of `pnpm job daily`.

## Database

`pnpm db:migrate` applies `drizzle/*.sql` in filename order and records each tag in `_sg_migrations`. That table is separate from Supabase's migration history.

`0019_enable_rls_newsletter_and_ops_tables` enables row level security and adds no policies on `newsletter_subscriber`, `newsletter_send`, `newsletter_rate_event`, `indexnow_submission`, `api_request_daily`, and `project_slug_alias`. The `anon` and `authenticated` roles are denied. Server code using `DATABASE_URL` (the table owner) and Supabase `service_role` still bypass RLS.

Production already applied this SQL as Supabase migration `enable_rls_newsletter_and_ops_tables`. The first `pnpm db:migrate` against that database runs the statements again, then stores the Drizzle tag. Re-running `ENABLE ROW LEVEL SECURITY` is safe. Do not apply a second copy under another name.

## License

MIT (see `LICENSE`).
