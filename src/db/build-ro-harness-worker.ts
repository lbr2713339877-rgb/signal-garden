/**
 * One process, one pool from getDb(). Prints one safe JSON line.
 * Approved SHA and the real flag are checked before getDb().
 * driver, init, and query are written only after the call that produced them.
 * `port` is pg's parsed frontend connectionParameters.port.
 * inet_server_port is backend-only and is not compared to that port.
 */
import { execFileSync } from "node:child_process";
import {
  allowlistedSqlState,
  knownDriver,
  measuredOff,
  stageOnError,
  type KnownDriver,
  type Measured,
  type WorkerStage,
} from "./build-ro-report";

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
    driver: "unknown",
    init: "unknown",
    query: "unknown",
    attempt: 1,
  }, 1);
}

let closeDb: (() => Promise<void>) | undefined;
let failed = false;
let stage: WorkerStage = "import";
let driver: KnownDriver = "unknown";
let init: Measured = "unknown";
let queryState: Measured = "unknown";
let sqlstate: string | undefined;
let reason: "ok" | "driver" | "port" | "fail" = "fail";
let port: number | undefined;
let backendPort: number | undefined;
let code = 1;

function note(err: unknown, fallback: WorkerStage) {
  failed = true;
  stage = stageOnError(err) ?? fallback;
  const state = allowlistedSqlState(err);
  if (state) sqlstate = state;
  if (measuredOff(err)) init = "off";
  if (reason === "ok") reason = "fail";
  if (code === 0) code = 1;
}

try {
  const loaded = await import("./client");
  closeDb = loaded.closeDb;
  stage = "getDb";
  const handle = await loaded.getDb();
  driver = knownDriver(handle.driver);
  if (driver !== "postgres") {
    failed = true;
    reason = "driver";
    code = 2;
  } else {
    stage = "connect";
    const client = await handle.raw.connect();
    init = "on";
    const parsedPort = Number(client.connectionParameters?.port);
    if (Number.isInteger(parsedPort) && parsedPort > 0) port = parsedPort;
    try {
      stage = "query";
      const sleep = process.env.BUILD_RO_TEST_SLEEP === "1";
      const result = await client.query(
        sleep
          ? "SELECT pg_sleep(2)"
          : "SELECT current_setting('default_transaction_read_only') AS default_transaction_read_only, current_setting('transaction_read_only') AS transaction_read_only, inet_server_port() AS server_port",
      );
      if (!sleep) {
        const row = result.rows[0] ?? {};
        const queryOn = row.default_transaction_read_only === "on" && row.transaction_read_only === "on";
        queryState = queryOn ? "on" : "off";
        const serverPort = Number(row.server_port);
        if (Number.isInteger(serverPort)) backendPort = serverPort;
        if (!port) reason = "port";
        else if (queryOn) {
          reason = "ok";
          code = 0;
        } else {
          reason = "fail";
          code = 3;
        }
      } else {
        reason = "fail";
        code = 3;
      }
    } catch (err) {
      note(err, "query");
    } finally {
      try {
        client.release();
      } catch (err) {
        if (!failed) note(err, "release");
      }
    }
  }
} catch (err) {
  if (!failed) note(err, stage);
} finally {
  if (closeDb) {
    try {
      await closeDb();
    } catch (err) {
      if (!failed) note(err, "close");
    }
  }
  emit({
    ok: reason === "ok" && !failed,
    reason,
    stage,
    sqlstate,
    candidate: actual,
    flag,
    urlNonempty,
    port,
    backendPort,
    driver,
    init,
    query: queryState,
    attempt: 1,
  }, code);
}
