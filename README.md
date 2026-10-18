# Signal Garden

Daily ranking of rising open-source projects. Live site: [https://signalgarden.site](https://signalgarden.site)

Signal Garden collects signals (GitHub activity and related sources), ranks projects for the day, and publishes a `/today` list plus RSS (`/feed.xml`). Optional email newsletter uses double opt-in.

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
- Supabase / Stripe — account and Pro features

See comments in `.env.example` for the full list.

## License

MIT (see `LICENSE`).
