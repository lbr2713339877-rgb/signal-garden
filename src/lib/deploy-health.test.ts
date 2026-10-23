import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/** The ssh payload is one double-quoted local string. Undo those escapes. */
function remoteScript(source: string): string {
  const marker = 'ssh "$REMOTE_HOST" "';
  const start = source.indexOf(marker);
  assert.notEqual(start, -1);
  const end = source.indexOf('\n\necho "==> done.');
  assert.notEqual(end, -1);
  const quoted = source.slice(start + marker.length, end - 1);
  return quoted.replace(/\\([$`"\\])/g, "$1");
}

test("deploy.sh health check retries up to 10 times and stays valid bash", () => {
  const source = readFileSync(new URL("../../deploy.sh", import.meta.url), "utf8");
  execFileSync("bash", ["-n", new URL("../../deploy.sh", import.meta.url).pathname]);

  const remote = remoteScript(source);
  const checked = spawnSync("bash", ["-n"], { input: remote });
  assert.equal(checked.status, 0, checked.stderr.toString());
  const gate = remote.lastIndexOf('[ "$code" = 200 ]');
  assert.notEqual(gate, -1);
  const health = remote.slice(remote.indexOf("code=000"), gate);
  assert.match(health, /attempt=1/);
  assert.match(health, /while \[ "\$attempt" -le 10 \]; do/);
  assert.match(health, /curl -s -o \/dev\/null -w '%\{http_code\}' --max-time 15 http:\/\/127\.0\.0\.1:3000\/ \|\| true/);
  assert.match(health, /if \[ -z "\$code" \]; then\n      code=000/);
  assert.match(health, /echo "    health attempt \$attempt: \$code"/);
  assert.match(health, /if \[ "\$code" = 200 \]; then\n      break/);
  assert.match(health, /if \[ "\$attempt" -lt 10 \]; then\n      sleep 2/);
  assert.match(health, /attempt=\$\(\(attempt \+ 1\)\)/);
  assert.doesNotMatch(health, /warm-cache/);
  assert.doesNotMatch(health, /echo "    health: \$code"/);

  const warm = remote.slice(gate);
  assert.match(warm, /WARM_ORIGIN=http:\/\/127\.0\.0\.1:3000/);
  assert.match(warm, /WARM_CONCURRENCY=2/);
  assert.match(warm, /scripts\/warm-cache\.ts/);
  assert.match(warm, /warm-up finished with failures; deploy continues/);
  assert.match(warm, /warm-up skipped: tsx is not installed; deploy continues/);
  assert.doesNotMatch(warm, /\bexit\s+1\b/);
  const packed = source.slice(source.indexOf("tar czf"), source.indexOf("echo \"==> uploading"));
  assert.match(packed, /scripts\/warm-cache\.ts/);
});
