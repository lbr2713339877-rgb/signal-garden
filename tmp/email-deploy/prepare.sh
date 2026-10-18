#!/usr/bin/env bash
set -euo pipefail
release="$1"
live=/opt/signal-radar
stage="/opt/$release"
mkdir "$stage"
cd "$live"
cp .next/BUILD_ID "$stage/.baseline-build-id"
find src public -type f -print0 | sort -z | xargs -0 sha256sum > "$stage/.baseline-files"
cp -a src public package.json pnpm-lock.yaml next.config.ts drizzle.config.ts postcss.config.mjs tsconfig.json next-env.d.ts "$stage/"
[ ! -d drizzle ] || cp -a drizzle "$stage/"
ln -s "$live/node_modules" "$stage/node_modules"
[ ! -d data ] || ln -s "$live/data" "$stage/data"
for envfile in .env .env.local .env.production .env.production.local; do
  [ ! -f "$live/$envfile" ] || ln -s "$live/$envfile" "$stage/$envfile"
done
cd "$stage"
tar xzf "/tmp/$release.tgz"
node <<'JS'
const nextRequire=require('node:module').createRequire(require.resolve('next/package.json'));
nextRequire('@next/env').loadEnvConfig(process.cwd());
const site=process.env.NEXT_PUBLIC_SITE_URL;
const ready=Boolean(process.env.RESEND_API_KEY);
console.log('Mail configured:',ready,'Site:',site);
if(!ready||site!=='https://signalgarden.site') process.exit(1);
JS
./node_modules/.bin/tsx --test src/lib/email.test.ts
if ! ./node_modules/.bin/next build > build.log 2>&1; then
  tail -60 build.log
  exit 1
fi
tail -12 build.log
printf 'Staged build ready: %s\n' "$stage"
