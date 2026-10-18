#!/usr/bin/env bash
set -euo pipefail
release="$1"
live=/opt/signal-radar
stage="/opt/$release"
backup="/opt/$release-rollback"
exec 9>/tmp/sg-email-deploy.lock
flock -n 9
cd "$live"
cmp .next/BUILD_ID "$stage/.baseline-build-id"
find src public -type f -print0 | sort -z | xargs -0 sha256sum > "$stage/.current-files"
cmp "$stage/.baseline-files" "$stage/.current-files"
mkdir "$backup"
tar tzf "/tmp/$release.tgz" > "$stage/.release-files"
: > "$backup/existing-files"
: > "$backup/new-files"
while IFS= read -r file; do
  if [ -f "$live/$file" ]; then printf '%s\n' "$file" >> "$backup/existing-files";
  else printf '%s\n' "$file" >> "$backup/new-files"; fi
done < "$stage/.release-files"
tar czf "$backup/files.tgz" -T "$backup/existing-files"
rollback() {
  code=$?
  trap - ERR
  set +e
  echo 'Deployment check failed; restoring previous release.'
  if [ -f "$backup/patch-installed" ]; then
    tar xzf "$backup/files.tgz" -C "$live"
    while IFS= read -r file; do rm -f "$live/$file"; done < "$backup/new-files"
  fi
  if [ -d "$backup/.next" ]; then
    [ ! -d "$live/.next" ] || mv "$live/.next" "$stage/failed-next"
    mv "$backup/.next" "$live/.next"
  fi
  pm2 restart signal-garden --update-env >/dev/null
  exit "$code"
}
trap rollback ERR
pm2 stop signal-garden >/dev/null
touch "$backup/patch-installed"
tar xzf "/tmp/$release.tgz" -C "$live" 2>/dev/null
mv "$live/.next" "$backup/.next"
mv "$stage/.next" "$live/.next"
pm2 restart signal-garden --update-env >/dev/null
for attempt in $(seq 1 15); do
  if curl -fsS --max-time 8 http://127.0.0.1:3000/login > /dev/null 2>&1; then break; fi
  sleep 2
done
for path in / /login /email/logo.png /email/x.png /email/xiaohongshu.png; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "http://127.0.0.1:3000$path")
  printf 'Live %s: %s\n' "$path" "$code"
  [ "$code" = 200 ]
done
trap - ERR
touch "$stage/deployment-ok"
printf 'Deployed %s; rollback retained at %s\n' "$release" "$backup"
