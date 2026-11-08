/**
 * Sanctioned production entry. Exits 0 only when the harness result is ok.
 *
 *   pnpm exec tsx src/db/build-ro-harness-entry.ts
 *
 * Reads DATABASE_URL and SG_BUILD_READ_ONLY from the environment.
 * Does not accept limit overrides. Prints one JSON line and no error text.
 */
import { actualCheckoutSha, runBuildRoHarness, type HarnessResult } from "./build-ro-harness";

function publicLine(result: HarnessResult): string {
  return JSON.stringify({
    ok: result.ok === true,
    reason: result.reason,
    attempts: result.attempts,
    failures: result.failures,
    port: result.port,
    reports: result.reports.map((report) => ({
      ok: report.ok,
      reason: report.reason,
      stage: report.stage,
      sqlstate: report.sqlstate,
      candidate: report.candidate,
      flag: report.flag,
      urlNonempty: report.urlNonempty,
      port: report.port,
      backendPort: report.backendPort,
      driver: report.driver,
      init: report.init,
      query: report.query,
      attempt: report.attempt,
    })),
  });
}

let code = 1;
try {
  let candidate = "";
  try {
    candidate = actualCheckoutSha();
  } catch {
    candidate = "";
  }
  const result = await runBuildRoHarness({
    mode: "production",
    databaseUrl: process.env.DATABASE_URL,
    flag: process.env.SG_BUILD_READ_ONLY,
    candidate,
  });
  console.log(publicLine(result));
  code = result.ok ? 0 : 1;
} catch {
  console.log(JSON.stringify({ ok: false, reason: "fail" }));
  code = 1;
}
process.exit(code);
