/**
 * One process, one pool. Prints the session flags after the build hook.
 * The parent owns the disposable database URL.
 */
import { Pool } from "pg";
import { postgresPoolConfig } from "./build-read-only";

const connectionString = process.env.BUILD_RO_DATABASE_URL ?? "";
const pool = new Pool(postgresPoolConfig({
  connectionString,
  readOnly: process.env.SG_BUILD_READ_ONLY === "true",
}));

const seen = await pool.query(
  "SELECT current_setting('default_transaction_read_only') AS default_transaction_read_only, current_setting('transaction_read_only') AS transaction_read_only, pg_backend_pid() AS pid",
);
let write = "ok";
try {
  await pool.query("CREATE TEMP TABLE build_ro_probe(id int)");
} catch (err) {
  write = err instanceof Error ? err.message.split("\n")[0] : String(err);
}
console.log(JSON.stringify({
  default_transaction_read_only: seen.rows[0]?.default_transaction_read_only,
  transaction_read_only: seen.rows[0]?.transaction_read_only,
  pid: seen.rows[0]?.pid,
  write,
}));
await pool.end();
