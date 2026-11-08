import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { test } from "node:test";

const SECRET = "entry-secret-value";

function runEntry(env: Record<string, string>): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const child = spawn("pnpm", ["exec", "tsx", "src/db/build-ro-harness-entry.ts"], {
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += String(chunk); });
  child.stderr.on("data", (chunk) => { stderr += String(chunk); });
  return new Promise((resolve) => child.on("close", (code) => resolve({ code, stdout, stderr })));
}

test("a failed production entry exits nonzero and does not print the URL", async () => {
  const refused = await runEntry({
    DATABASE_URL: `postgresql://diaguser:${SECRET}@127.0.0.1:1/garden`,
    SG_BUILD_READ_ONLY: "false",
  });
  assert.equal(refused.code, 1);
  const report = JSON.parse(refused.stdout.trim()) as { ok: boolean; reason: string; attempts: number };
  assert.equal(report.ok, false);
  assert.equal(report.reason, "flag");
  assert.equal(report.attempts, 0);
  assert.equal(refused.stdout.includes(SECRET), false);
  assert.equal(refused.stderr.includes(SECRET), false);

  const missing = await runEntry({
    DATABASE_URL: "",
    SG_BUILD_READ_ONLY: "true",
  });
  assert.equal(missing.code, 1);
  const missingReport = JSON.parse(missing.stdout.trim()) as { ok: boolean; reason: string; attempts: number };
  assert.equal(missingReport.ok, false);
  assert.equal(missingReport.reason, "missing-url");
  assert.equal(missingReport.attempts, 0);
});
