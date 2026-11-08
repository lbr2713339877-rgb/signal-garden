import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { test } from "node:test";
import { enforceBuildReadOnly } from "./build-read-only";
import {
  allowlistedSqlState,
  knownDriver,
  measuredOff,
  stageOnError,
  stampStage,
} from "./build-ro-report";

const SECRET = "diag-secret-value";
const SECRET_URL = `postgresql://diaguser:${SECRET}@db.internal:6543/garden`;
const HEAD = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();

function leaked(value: unknown): boolean {
  const text = JSON.stringify(value);
  return text.includes(SECRET)
    || text.includes(SECRET_URL)
    || text.includes("://")
    || text.includes("diaguser")
    || text.includes("password authentication")
    || text.includes("set failed near")
    || text.includes("stack")
    || text.includes("ECONNREFUSED");
}

function failureView(err: unknown, fallback: "import" | "getDb" | "connect" | "init-set" | "init-show-default" | "init-show-tx" | "query" | "release" | "close", driver: unknown, init: "on" | "off" | "unknown", query: "on" | "off" | "unknown") {
  return {
    ok: false,
    stage: stageOnError(err) ?? fallback,
    sqlstate: allowlistedSqlState(err),
    driver: knownDriver(driver),
    init: measuredOff(err) ? "off" as const : init,
    query,
  };
}

test("config, connection, auth, SET, SHOW, and query failures keep the stage and drop the text", () => {
  const config = Object.assign(new Error(`invalid config ${SECRET_URL}`), { code: "ECONNREFUSED", stack: `Error\n    at ${SECRET_URL}` });
  const configView = failureView(config, "getDb", undefined, "unknown", "unknown");
  assert.equal(configView.stage, "getDb");
  assert.equal(configView.driver, "unknown");
  assert.equal(configView.init, "unknown");
  assert.equal(configView.query, "unknown");
  assert.equal(configView.sqlstate, undefined);
  assert.equal(leaked(configView), false);

  const connection = Object.assign(new Error(`connect ECONNREFUSED ${SECRET_URL}`), { code: "ECONNREFUSED", stack: "stack" });
  const connectionView = failureView(connection, "connect", "postgres", "unknown", "unknown");
  assert.equal(connectionView.stage, "connect");
  assert.equal(connectionView.sqlstate, undefined);
  assert.equal(connectionView.driver, "postgres");
  assert.equal(connectionView.init, "unknown");
  assert.equal(leaked(connectionView), false);

  const auth = Object.assign(new Error(`password authentication failed for user diaguser ${SECRET_URL}`), { code: "28P01" });
  const authView = failureView(auth, "connect", "postgres", "unknown", "unknown");
  assert.equal(authView.stage, "connect");
  assert.equal(authView.sqlstate, "28P01");
  assert.equal(leaked(authView), false);

  const setFailed = stampStage(Object.assign(new Error(`set failed near ${SECRET_URL}`), { code: "42601" }), "init-set");
  const setView = failureView(setFailed, "connect", "postgres", "unknown", "unknown");
  assert.equal(setView.stage, "init-set");
  assert.equal(setView.sqlstate, "42601");
  assert.equal(setView.init, "unknown");
  assert.equal(leaked(setView), false);

  const showThrown = stampStage(Object.assign(new Error(`SHOW failed ${SECRET}`), { code: "XX000" }), "init-show-default");
  const showThrownView = failureView(showThrown, "connect", "postgres", "unknown", "unknown");
  assert.equal(showThrownView.stage, "init-show-default");
  assert.equal(showThrownView.init, "unknown");
  assert.equal(showThrownView.sqlstate, "XX000");
  assert.equal(leaked(showThrownView), false);

  const showOff = stampStage(new Error(`build read-only init failed: default_transaction_read_only=off transaction_read_only=on ${SECRET}`), "init-show-default", "off");
  const showOffView = failureView(showOff, "connect", "postgres", "unknown", "unknown");
  assert.equal(showOffView.stage, "init-show-default");
  assert.equal(showOffView.init, "off");
  assert.equal(showOffView.sqlstate, undefined);
  assert.equal(leaked(showOffView), false);

  const queryFailed = Object.assign(new Error(`Query read timeout ${SECRET_URL}`), { code: "57014", stack: "stack" });
  const queryView = failureView(queryFailed, "query", "postgres", "on", "unknown");
  assert.equal(queryView.stage, "query");
  assert.equal(queryView.sqlstate, "57014");
  assert.equal(queryView.query, "unknown");
  assert.equal(queryView.init, "on");
  assert.equal(leaked(queryView), false);

  assert.equal(allowlistedSqlState({ code: "postgresql://nope" }), undefined);
  assert.equal(knownDriver("postgres-from-url"), "unknown");
});

test("enforceBuildReadOnly stamps the stage at the statement and keeps the original text", async () => {
  const secret = new Error(`set failed near ${SECRET_URL}`);
  await assert.rejects(
    enforceBuildReadOnly({
      query: async () => { throw secret; },
    } as never),
    (err: unknown) => {
      assert.equal(err, secret);
      assert.equal(stageOnError(err), "init-set");
      assert.equal(measuredOff(err), false);
      return true;
    },
  );

  await assert.rejects(
    enforceBuildReadOnly({
      query: async (sql: string) => {
        if (sql.startsWith("SET")) return { rows: [] };
        if (sql.includes("default_transaction_read_only")) return { rows: [{ default_transaction_read_only: "off" }] };
        return { rows: [{ transaction_read_only: "on" }] };
      },
    } as never),
    (err: unknown) => {
      assert.equal(stageOnError(err), "init-show-default");
      assert.equal(measuredOff(err), true);
      assert.match(err instanceof Error ? err.message : "", /transaction_read_only=on/);
      return true;
    },
  );

  const showErr = Object.assign(new Error(`SHOW failed ${SECRET}`), { code: "57014" });
  await assert.rejects(
    enforceBuildReadOnly({
      query: async (sql: string) => {
        if (sql.startsWith("SET")) return { rows: [] };
        throw showErr;
      },
    } as never),
    (err: unknown) => {
      assert.equal(err, showErr);
      assert.equal(stageOnError(err), "init-show-default");
      assert.equal(measuredOff(err), false);
      assert.equal(allowlistedSqlState(err), "57014");
      return true;
    },
  );
});

test("a refused local connection does not print the URL or treat init as measured", async () => {
  const child = spawn("pnpm", ["exec", "tsx", "src/db/build-ro-harness-worker.ts"], {
    env: {
      ...process.env,
      DATABASE_URL: `postgresql://diaguser:${SECRET}@127.0.0.1:1/garden`,
      SG_BUILD_READ_ONLY: "true",
      BUILD_RO_EXPECT_SHA: HEAD,
      PG_POOL_MAX: "1",
      SG_BUILD_DB_CONNECT_TIMEOUT_MS: "1000",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += String(chunk); });
  child.stderr.on("data", (chunk) => { stderr += String(chunk); });
  const code = await new Promise<number | null>((resolve) => child.on("close", resolve));
  const report = JSON.parse(stdout.trim()) as Record<string, unknown>;
  assert.notEqual(code, 0);
  assert.equal(report.stage, "connect");
  assert.equal(report.driver, "postgres");
  assert.equal(report.init, "unknown");
  assert.equal(report.query, "unknown");
  assert.equal(stdout.includes(SECRET), false);
  assert.equal(stdout.includes("://"), false);
  assert.equal(stderr.includes(SECRET), false);
  assert.equal(stderr.includes("://"), false);
});
