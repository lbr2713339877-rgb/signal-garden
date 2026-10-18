#!/usr/bin/env bash
set -euo pipefail
cd "/opt/$1"
cat > transport-check.mjs <<'JS'
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const nextRequire=createRequire(require.resolve('next/package.json'));
nextRequire('@next/env').loadEnvConfig(process.cwd());
const outgoing=[];
globalThis.fetch=async(url,options)=>{
  assert.equal(String(url),'https://api.resend.com/emails');
  outgoing.push(JSON.parse(options.body));
  return new Response(JSON.stringify({id:'preview-only'}),{status:200,headers:{'Content-Type':'application/json'}});
};
const {sendWelcomeEmail}=await import('./src/lib/email.ts');
const {sendVerificationEmail}=await import('./src/lib/email-code.ts');
for(const locale of ['zh','en']) {
  assert.equal((await sendWelcomeEmail({email:'preview@example.invalid',username:'Ray',locale})).sent,true);
  assert.equal((await sendVerificationEmail('preview@example.invalid','012345',locale)).sent,true);
}
for(const [index,mail] of outgoing.entries()){
  const en=index>=2;
  assert.ok(mail.html.includes(`<html lang="${en?'en':'zh-CN'}">`));
  assert.ok(mail.html.includes('https://x.com/SIGNoffical'));
  assert.ok(mail.html.includes('/email/logo.png'));
  if(en){assert.doesNotMatch(mail.subject,/[\u4e00-\u9fff]/);assert.doesNotMatch(mail.text,/[\u4e00-\u9fff]/);}
}
assert.equal(outgoing.length,4);
console.log('Production-configured senders verified in both languages with intercepted transport; no emails sent.');
JS
./node_modules/.bin/tsx transport-check.mjs
./node_modules/.bin/next start --hostname 127.0.0.1 --port 3108 > smoke.log 2>&1 &
stage_pid=$!
trap 'kill "$stage_pid" 2>/dev/null || true' EXIT
for attempt in $(seq 1 15); do
  if curl -fsS --max-time 8 http://127.0.0.1:3108/login > /dev/null 2>&1; then break; fi
  sleep 2
done
for path in / /login /email/logo.png /email/x.png /email/xiaohongshu.png; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "http://127.0.0.1:3108$path")
  printf 'Staging %s: %s\n' "$path" "$code"
  [ "$code" = 200 ]
done
node <<'JS'
const fs=require('node:fs');
function walk(p){return fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${p}/${e.name}`):[`${p}/${e.name}`]);}
const server=walk('.next/server').filter(p=>p.endsWith('.js')).map(p=>fs.readFileSync(p,'utf8')).join('\n');
if(!server.includes('Your Signal Garden account is ready')||!server.includes('Valid for 10 minutes')) throw new Error('Localized mail missing from production build');
console.log('Localized mail found in compiled production routes.');
JS
