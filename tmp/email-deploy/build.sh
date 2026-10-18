#!/usr/bin/env bash
set -euo pipefail
cd "/opt/$1"
node <<'JS'
const nextRequire=require('node:module').createRequire(require.resolve('next/package.json'));
nextRequire('@next/env').loadEnvConfig(process.cwd());
const site=process.env.NEXT_PUBLIC_SITE_URL;
const ready=Boolean(process.env.RESEND_API_KEY);
console.log('Mail configured:',ready,'Site:',site);
if(!ready||new URL(site).origin!=='https://signalgarden.site') process.exit(1);
JS
./node_modules/.bin/tsx --test src/lib/email.test.ts
if ! ./node_modules/.bin/next build > build.log 2>&1; then
  tail -60 build.log
  exit 1
fi
tail -12 build.log
printf 'Staged build ready: %s\n' "$PWD"
