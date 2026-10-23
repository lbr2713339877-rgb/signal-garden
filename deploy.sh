#!/usr/bin/env bash
#
# Local helper: push the working tree to the Signal Garden VPS and rebuild.
#
#   ./deploy.sh                     # sync everything except node_modules/.next/data
#   ./deploy.sh /opt/signal-radar   # custom remote dir
#
# It does NOT reuse the server's own /opt/signal-radar/deploy.sh; the sync is
# tar+scp because the VPS has no rsync installed.
#
# The remote build stops pm2, rebuilds, and on failure restores the previous
# src from a timestamped tarball — so a broken commit cannot take the site down.
#
# After the loopback health check passes, the remote shell runs
# scripts/warm-cache.ts against http://127.0.0.1:3000. That script is part of
# this sync. A few warm-up failures are logged and the deploy still finishes.
# This does not edit the server's own /opt/signal-radar/deploy.sh.
set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:?Set REMOTE_HOST e.g. export REMOTE_HOST=root@YOUR_VPS_HOST}"
REMOTE_DIR="${1:-/opt/signal-radar}"
LOCAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
TARBALL="/tmp/sg-sync-${STAMP}.tgz"

cd "$LOCAL_DIR"

echo "==> packaging working tree"
tar czf "$TARBALL" \
  --exclude=node_modules --exclude=.next --exclude=.git \
  --exclude=data --exclude=tmp \
  src public package.json pnpm-lock.yaml next.config.ts \
  drizzle.config.ts postcss.config.mjs tsconfig.json \
  scripts/warm-cache.ts

echo "==> uploading $(du -h "$TARBALL" | cut -f1)"
scp -q "$TARBALL" "${REMOTE_HOST}:/tmp/$(basename "$TARBALL")"

echo "==> backing up remote src, extracting, building"
ssh "$REMOTE_HOST" "set -euo pipefail
  cd '${REMOTE_DIR}'
  tar czf '/opt/sg-backup-${STAMP}.tgz' src
  echo '    backup: /opt/sg-backup-${STAMP}.tgz'
  tar xzf '/tmp/$(basename "$TARBALL")'
  pm2 stop signal-garden >/dev/null 2>&1 || true
  if ! ./node_modules/.bin/next build > /tmp/sg-build.log 2>&1; then
    echo '    BUILD FAILED:'; tail -30 /tmp/sg-build.log
    tar xzf '/opt/sg-backup-${STAMP}.tgz'
    ./node_modules/.bin/next build >> /tmp/sg-build.log 2>&1 || true
    pm2 start signal-garden >/dev/null 2>&1 || true
    exit 1
  fi
  pm2 restart signal-garden --update-env >/dev/null
  sleep 4
  code=000
  attempt=1
  while [ \"\$attempt\" -le 10 ]; do
    code=\$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 http://127.0.0.1:3000/ || true)
    if [ -z \"\$code\" ]; then
      code=000
    fi
    echo \"    health attempt \$attempt: \$code\"
    if [ \"\$code\" = 200 ]; then
      break
    fi
    if [ \"\$attempt\" -lt 10 ]; then
      sleep 2
    fi
    attempt=\$((attempt + 1))
  done
  [ \"\$code\" = 200 ]
  echo '==> warming loopback cache'
  if [ -x ./node_modules/.bin/tsx ]; then
    if WARM_ORIGIN=http://127.0.0.1:3000 WARM_CONCURRENCY=2 ./node_modules/.bin/tsx scripts/warm-cache.ts; then
      echo '    warm-up ok'
    else
      echo '    warm-up finished with failures; deploy continues'
    fi
  else
    echo '    warm-up skipped: tsx is not installed; deploy continues'
  fi"

echo "==> done. live check: https://signalgarden.site/pricing"
