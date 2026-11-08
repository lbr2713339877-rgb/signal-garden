/**
 * One process, one pool from getDb(). Prints one safe JSON line.
 * Approved SHA and the real flag are checked before getDb().
 * `port` is pg's parsed frontend connectionParameters.port.
 * inet_server_port is backend-only and is not compared to that port.
 */
import { execFileSync } from "node:child_process";

function classify(err: unknown): "missing-url" | "init-off" | "timeout" | "fail" {
  const message = err instanceof Error ? err.message : "";
  if (message.includes("://")) return "fail";
  if (message.includes("nonempty DATABASE_URL")) return "missing-url";
  if (message.includes("read-only init failed")) return "init-off";
  if (/timeout/i.test(message)) return "timeout";
  return "fail";
}

function checkoutSha(): string {
  return execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 1_000,
  }).trim();
}

const flag = process.env.SG_BUILD_READ_ONLY === "true";
const urlNonempty = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim());
let actual = "";
try {
  actual = checkoutSha();
} catch {
  actual = "";
}
const approved = process.env.BUILD_RO_EXPECT_SHA ?? "";
const shaOk = /^[0-9a-f]{40}$/.test(actual) && actual === approved;

function emit(body: Record<string, unknown>, code: number): never {
  console.log(JSON.stringify(body));
  process.exit(code);
}

if (!flag || !shaOk) {
  emit({
    ok: false,
    reason: flag ? "sha" : "flag",
    candidate: actual,
    flag,
    urlNonempty,
    driver: "none",
    init: "off",
    query: "off",
    attempt: 1,
  }, 1);
}

const { closeDb, getDb } = await import("./client");
let code = 1;
let body: Record<string, unknown> = {
  ok: false,
  reason: "fail",
  candidate: actual,
  flag,
  urlNonempty,
  driver: "none",
  init: "off",
  query: "off",
  attempt: 1,
};

try {
  const handle = await getDb();
  if (handle.driver !== "postgres") {
    body = { ...body, reason: "driver", driver: handle.driver };
    code = 2;
  } else {
    const client = await handle.raw.connect();
    try {
      const parsedPort = Number(client.connectionParameters?.port);
      const result = await client.query(
        process.env.BUILD_RO_TEST_SLEEP === "1"
          ? "SELECT pg_sleep(2)"
          : "SELECT current_setting('default_transaction_read_only') AS default_transaction_read_only, current_setting('transaction_read_only') AS transaction_read_only, inet_server_port() AS server_port",
      );
      const row = result.rows[0] ?? {};
      const queryOn = row.default_transaction_read_only === "on" && row.transaction_read_only === "on";
      const backendPort = Number(row.server_port);
      const frontendOk = Number.isInteger(parsedPort) && parsedPort > 0;
      const reason = frontendOk ? (queryOn ? "ok" : "init-off") : "port";
      body = {
        ...body,
        ok: reason === "ok",
        reason,
        port: frontendOk ? parsedPort : undefined,
        backendPort: Number.isInteger(backendPort) ? backendPort : undefined,
        driver: "postgres",
        init: "on",
        query: queryOn ? "on" : "off",
      };
      code = body.ok ? 0 : 3;
    } finally {
      client.release();
    }
  }
} catch (err) {
  body = { ...body, reason: classify(err), driver: urlNonempty ? "postgres" : "none" };
  code = 1;
} finally {
  await closeDb().catch(() => {});
  emit(body, code);
}
