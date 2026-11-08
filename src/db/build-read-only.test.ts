import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Pool, type PoolConfig } from "pg";
import {
  BUILD_READ_ONLY_SQL,
  buildReadOnlyEnabled,
  enforceBuildReadOnly,
  postgresPoolConfig,
} from "./build-read-only";

type QueryCallback = (err: Error | null, result?: { rows: Array<Record<string, string>> }) => void;

class Deferred {
  promise: Promise<void>;
  resolve!: () => void;
  constructor() {
    this.promise = new Promise((resolve) => {
      this.resolve = resolve;
    });
  }
}

class FakeClient extends EventEmitter {
  static all: FakeClient[] = [];
  static setGate = new Deferred();
  static show = { default_transaction_read_only: "on", transaction_read_only: "on" };
  static failSet = false;
  queries: string[] = [];
  ended = false;
  _queryable = false;

  constructor() {
    super();
    FakeClient.all.push(this);
  }

  connect(cb: (err?: Error) => void) {
    this._queryable = true;
    cb();
  }

  end(cb?: () => void) {
    this.ended = true;
    this._queryable = false;
    cb?.();
  }

  query(text: string, values?: unknown, cb?: QueryCallback) {
    if (typeof values === "function") {
      cb = values as QueryCallback;
      values = undefined;
    }
    const sql = String(text);
    this.queries.push(sql);
    const finish = async () => {
      if (sql === BUILD_READ_ONLY_SQL) {
        if (FakeClient.failSet) throw new Error("set failed");
        await FakeClient.setGate.promise;
        return { rows: [] };
      }
      if (sql === "SHOW default_transaction_read_only") {
        return { rows: [{ default_transaction_read_only: FakeClient.show.default_transaction_read_only }] };
      }
      if (sql === "SHOW transaction_read_only") {
        return { rows: [{ transaction_read_only: FakeClient.show.transaction_read_only }] };
      }
      return { rows: [{ ok: "1" }] };
    };
    const pending = finish();
    if (cb) {
      pending.then(
        (result) => cb!(null, result),
        (err: Error) => cb!(err),
      );
      return undefined;
    }
    return pending;
  }
}

function resetFakes() {
  FakeClient.all = [];
  FakeClient.setGate = new Deferred();
  FakeClient.show = { default_transaction_read_only: "on", transaction_read_only: "on" };
  FakeClient.failSet = false;
}

function readOnlyPool() {
  return new Pool({
    Client: FakeClient as unknown as PoolConfig["Client"],
    max: 2,
    idleTimeoutMillis: 60_000,
    onConnect: enforceBuildReadOnly,
  });
}

test("the switch is exactly true and the off pool matches the previous settings", () => {
  assert.equal(buildReadOnlyEnabled({}), false);
  assert.equal(buildReadOnlyEnabled({ SG_BUILD_READ_ONLY: "1" }), false);
  assert.equal(buildReadOnlyEnabled({ SG_BUILD_READ_ONLY: "true" }), true);
  const off = postgresPoolConfig({ connectionString: "postgres://local/db", readOnly: false });
  assert.deepEqual(off, {
    connectionString: "postgres://local/db",
    max: Number(process.env.PG_POOL_MAX ?? 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  assert.equal("onConnect" in off, false);
  const on = postgresPoolConfig({ connectionString: "postgres://local/db", readOnly: true });
  assert.equal(on.onConnect, enforceBuildReadOnly);
  const client = readFileSync(new URL("./client.ts", import.meta.url), "utf8");
  assert.match(client, /postgresPoolConfig/);
  assert.match(client, /buildReadOnlyEnabled/);
  assert.doesNotMatch(client, /\.on\(\s*["']connect["']/);
});

test("a switched-off pool runs no read-only SQL", async () => {
  resetFakes();
  const config = postgresPoolConfig({ connectionString: "postgres://local/db", readOnly: false });
  const pool = new Pool({ ...config, Client: FakeClient as unknown as PoolConfig["Client"], max: 1 });
  try {
    const result = await pool.query("SELECT app");
    assert.equal(result.rows[0].ok, "1");
    assert.deepEqual(FakeClient.all[0]?.queries, ["SELECT app"]);
  } finally {
    await pool.end();
  }
});

test("concurrent checkouts run no application SQL before read-only init finishes", async () => {
  resetFakes();
  const pool = readOnlyPool();
  pool.on("error", () => {});
  try {
    const pending = Promise.all([pool.query("SELECT app"), pool.query("SELECT app")]);
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(FakeClient.all.length, 2);
    for (const client of FakeClient.all) {
      assert.deepEqual(client.queries, [BUILD_READ_ONLY_SQL]);
    }
    FakeClient.setGate.resolve();
    const rows = await pending;
    assert.equal(rows.length, 2);
    for (const client of FakeClient.all) {
      assert.deepEqual(client.queries, [
        BUILD_READ_ONLY_SQL,
        "SHOW default_transaction_read_only",
        "SHOW transaction_read_only",
        "SELECT app",
      ]);
    }
  } finally {
    FakeClient.setGate.resolve();
    await pool.end();
  }
});

test("an off show or a failed set ends the client and rejects before application SQL", async () => {
  resetFakes();
  FakeClient.show.transaction_read_only = "off";
  FakeClient.setGate.resolve();
  const off = readOnlyPool();
  off.on("error", () => {});
  try {
    await assert.rejects(off.query("SELECT app"), /transaction_read_only=off/);
    assert.equal(FakeClient.all[0]?.ended, true);
    assert.equal(FakeClient.all[0]?.queries.includes("SELECT app"), false);
  } finally {
    await off.end();
  }

  resetFakes();
  FakeClient.failSet = true;
  const failed = readOnlyPool();
  failed.on("error", () => {});
  try {
    await assert.rejects(failed.query("SELECT app"), /set failed/);
    assert.equal(FakeClient.all[0]?.ended, true);
    assert.equal(FakeClient.all[0]?.queries.includes("SELECT app"), false);
  } finally {
    await failed.end();
  }
});

test("a replaced connection runs read-only init again before the next query", async () => {
  resetFakes();
  FakeClient.setGate.resolve();
  const pool = readOnlyPool();
  pool.on("error", () => {});
  try {
    await pool.query("SELECT app");
    assert.equal(FakeClient.all.length, 1);
    const first = FakeClient.all[0];
    assert.ok(first);
    first.emit("error", new Error("socket closed"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(first.ended, true);
    await pool.query("SELECT again");
    assert.equal(FakeClient.all.length, 2);
    assert.deepEqual(FakeClient.all[1]?.queries, [
      BUILD_READ_ONLY_SQL,
      "SHOW default_transaction_read_only",
      "SHOW transaction_read_only",
      "SELECT again",
    ]);
  } finally {
    await pool.end();
  }
});
