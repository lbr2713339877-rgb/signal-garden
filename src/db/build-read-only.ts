/**
 * Opt-in session read-only for a build's Postgres pool.
 *
 * pg-pool 3.14 awaits `options.onConnect` before it gives the client to
 * `pool.query` / `pool.connect`. It does not await `pool.on('connect')`.
 * The hook is the only place a new connection, a worker's pool, or a
 * reconnect can run SET and both SHOW checks before application SQL.
 *
 * PostgreSQL rejects `SET SESSION READ ONLY`. The session statement is
 * `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`. After that, a
 * following statement's implicit transaction is read-only, so both
 * `default_transaction_read_only` and `transaction_read_only` show `on`.
 *
 * This is not a privilege boundary. A later `SET default_transaction_read_only
 * TO off` in the same session still works. No role is created.
 */
import type { ClientBase, PoolConfig } from "pg";

export const BUILD_READ_ONLY_SQL = "SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY";

export function buildReadOnlyEnabled(env?: { SG_BUILD_READ_ONLY?: string }): boolean {
  return (env ?? process.env).SG_BUILD_READ_ONLY === "true";
}

function showValue(rows: Array<Record<string, unknown>>, key: string): string {
  const value = rows[0]?.[key];
  return typeof value === "string" ? value : "";
}

/** Run on each new client. Throws so pg-pool ends the client and fails checkout. */
export async function enforceBuildReadOnly(client: ClientBase): Promise<void> {
  await client.query(BUILD_READ_ONLY_SQL);
  const defaultReadOnly = await client.query("SHOW default_transaction_read_only");
  const transactionReadOnly = await client.query("SHOW transaction_read_only");
  const defaultValue = showValue(defaultReadOnly.rows, "default_transaction_read_only");
  const transactionValue = showValue(transactionReadOnly.rows, "transaction_read_only");
  if (defaultValue !== "on" || transactionValue !== "on") {
    throw new Error(
      `build read-only init failed: default_transaction_read_only=${defaultValue || "missing"} transaction_read_only=${transactionValue || "missing"}`,
    );
  }
}

/** Same pool settings as the Postgres branch. `onConnect` exists only when the switch is on. */
export function postgresPoolConfig(input: { connectionString: string; readOnly: boolean; max?: number }): PoolConfig {
  const config: PoolConfig = {
    connectionString: input.connectionString,
    // Serverless-friendly: few connections per instance, recycled quickly.
    max: input.max ?? Number(process.env.PG_POOL_MAX ?? 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  };
  if (input.readOnly) config.onConnect = enforceBuildReadOnly;
  return config;
}
