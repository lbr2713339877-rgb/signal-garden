/**
 * One process, one pool from getDb(). Prints one safe JSON line.
 * The SHA is this checkout. The port is pg's parsed connection port.
 */
import { execFileSync } from "node:child_process";
import { closeDb, getDb } from "./client";

function classify(err: unknown): "missing-url" | "init-off" | "timeout" | "fail" {
  const message = err instanceof Error ? err.message : "";
  if (message.includes("://")) return "fail";
  if (message.includes("nonempty DATABASE_URL")) return "missing-url";
  if (message.includes("read-only init failed")) return "init-off";
  if (/timeout/i.test(message)) return "timeout";
  return "fail";
}

function checkoutSha(): string {
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: process.cwd(), encoding: "utf8" }).trim();
}

const flag = process.env.SG_BUILD_READ_ONLY === "true";
const urlNonempty = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim());
let code = 1;
let body: Record<string, unknown> = {
  ok: false,
  reason: "fail",
  candidate: "",
  flag,
  urlNonempty,
  driver: "none",
  init: "off",
  query: "off",
  attempt: 1,
};

try {
  body.candidate = checkoutSha();
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
      const samePort = Number(row.server_port) === parsedPort;
      const reason = !samePort ? "port" : queryOn ? "ok" : "init-off";
      body = {
        ...body,
        ok: reason === "ok" && flag,
        reason,
        port: parsedPort,
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
  console.log(JSON.stringify(body));
  process.exit(code);
}
