# Visitor analytics

The site loads one script, and only when `NEXT_PUBLIC_ANALYTICS_SCRIPT_SRC` is set at **build** time. Leave it empty and nothing is requested. Homepage card and task counters (`DiscoveryTelemetry`) are separate and stay on.

`NEXT_PUBLIC_*` is inlined by `next build`. Put the variables in the env file the VPS build already reads (the same place as `NEXT_PUBLIC_SITE_URL`), then run `./deploy.sh`. A pm2 restart without a rebuild does not see them.

## Umami

After Umami is running and you have added the website `signalgarden.site` in its UI, copy the website id from the tracking code and set:

```
NEXT_PUBLIC_ANALYTICS_SCRIPT_SRC=https://analytics.signalgarden.site/script.js
NEXT_PUBLIC_ANALYTICS_WEBSITE_ID=<website id from Umami>
```

`data-website-id` is sent only when `NEXT_PUBLIC_ANALYTICS_WEBSITE_ID` is set.

## Plausible later

No account is required for this change. If a Plausible script URL exists later, point `NEXT_PUBLIC_ANALYTICS_SCRIPT_SRC` at it. For the classic shared script, also set:

```
NEXT_PUBLIC_ANALYTICS_DATA_DOMAIN=signalgarden.site
```

That becomes `data-domain`. Do not invent a `pa-` script id.

## Umami on the VPS

Signal Garden already listens on port 3000. Do not publish Umami on host port 3000. Bind it to localhost and put a reverse proxy on a subdomain such as `analytics.signalgarden.site`.

This repo does not install anything on the server. On the VPS, in a directory of its own (not `/opt/signal-radar`):

```yaml
services:
  umami:
    image: ghcr.io/umami-software/umami:latest
    ports:
      - "127.0.0.1:3001:3000"
    environment:
      DATABASE_URL: postgresql://umami:${UMAMI_DB_PASSWORD}@db:5432/umami
      APP_SECRET: ${UMAMI_APP_SECRET}
    depends_on:
      db:
        condition: service_healthy
    init: true
    restart: always
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: umami
      POSTGRES_USER: umami
      POSTGRES_PASSWORD: ${UMAMI_DB_PASSWORD}
    volumes:
      - umami-db-data:/var/lib/postgresql/data
    restart: always
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 5
volumes:
  umami-db-data:
```

Generate `UMAMI_APP_SECRET` with `openssl rand -base64 32`. Use a database password that is not `umami`. Point DNS for the subdomain at the VPS, proxy it to `127.0.0.1:3001`, then create the website in Umami and set the two `NEXT_PUBLIC_ANALYTICS_*` lines before `./deploy.sh`.

Default login on a fresh Umami install is `admin` / `umami`. Change it before the proxy is public.
