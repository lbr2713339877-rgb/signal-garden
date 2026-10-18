/**
 * Database client.
 *
 * One driver, two backends, chosen by environment:
 *
 *   DATABASE_URL empty  ->  PGlite (WASM Postgres in-process, data in ./data/pg)
 *   DATABASE_URL set    ->  node-postgres against a real server
 *
 * Both speak the Postgres dialect, so src/db/schema.ts and every query in
 * src/db/queries/ are identical in both. Switching to production is an
 * environment variable, not a migration.
 *
 * PGlite is loaded with a dynamic import and kept out of the Next bundle via
 * serverExternalPackages, so client bundles never pull the WASM binary.
 */

import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Driver = "pglite" | "postgres";

/**
 * Both drivers produce a database that extends PgDatabase, so this is the
 * common supertype — which keeps every query fully typed while still allowing
 * the runtime to pick a backend. Typing this as `any` would silently disable
 * type checking across every page and job.
 */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface DbHandle {
  driver: Driver;
  /** Drizzle instance. Fully typed; both backends are assignable. */
  db: Database;
  /** Raw driver handle, for the few places that need unpadded SQL. */
  raw: any;
  close: () => Promise<void>;
}

/**
 * The handle lives on globalThis, not in module scope. Next's dev server
 * re-evaluates modules on every edit; a module-level cache would be lost and a
 * second PGlite instance opened on the same directory in the same process —
 * which PGlite aborts on.
 */
const store = globalThis as unknown as {
  __sgDb?: DbHandle | null;
  __sgDbInit?: Promise<DbHandle> | null;
};

function driverFromEnv(): Driver {
  return process.env.DATABASE_URL && process.env.DATABASE_URL.length > 0
    ? "postgres"
    : "pglite";
}

/** Raised when a second process tries to open a PGlite directory already in use. */
export class DatabaseLockedError extends Error {
  constructor(
    public dir: string,
    public holderPid: number | null,
  ) {
    super(
      `PGlite directory ${dir} is already open${holderPid ? ` by pid ${holderPid}` : ""}. ` +
        `PGlite does not support concurrent processes: wait for the running job to finish, ` +
        `or point PGLITE_DIR at a separate directory.`,
    );
    this.name = "DatabaseLockedError";
  }
}

/**
 * PGlite allows one process per data directory. It does not expose a usable
 * owner pid — its postmaster.pid holds a synthetic value, not the process that
 * opened it — so the lock has to be our own.
 *
 * The file holds our pid. A lock whose pid is dead is stale and is reclaimed;
 * a lock whose pid is alive means another job is running and we refuse to
 * start rather than letting PGlite abort with an opaque WASM error.
 */
const LOCK_NAME = "signal-garden.lock";

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0); // signal 0 tests for existence
    return true;
  } catch (err) {
    // EPERM: exists but owned by another user. ESRCH: gone.
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

async function acquireLock(dir: string): Promise<void> {
  const fs = await import("node:fs/promises");
  const file = `${dir}/${LOCK_NAME}`;

  const write = async () => {
    await fs.writeFile(file, `${process.pid}\n${new Date().toISOString()}\n`, "utf8");
  };

  try {
    // wx fails if the file exists, which makes the check-and-write atomic.
    await fs.writeFile(file, "", { flag: "wx" });
    await write();
    return;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
  }

  let holder: number | null = null;
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = Number(raw.split("\n")[0].trim());
    holder = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    holder = null;
  }

  if (holder !== null && holder !== process.pid && pidAlive(holder)) {
    throw new DatabaseLockedError(dir, holder);
  }

  // No readable pid, or the holder is gone: the lock is stale.
  await write();
}

async function releaseLock(dir: string): Promise<void> {
  const fs = await import("node:fs/promises");
  const file = `${dir}/${LOCK_NAME}`;
  try {
    const raw = await fs.readFile(file, "utf8");
    if (Number(raw.split("\n")[0].trim()) === process.pid) await fs.rm(file, { force: true });
  } catch {
    // Already gone, or unreadable: nothing to release.
  }
}

async function create(): Promise<DbHandle> {
  const driver = driverFromEnv();

  if (driver === "postgres") {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Serverless-friendly: few connections per instance, recycled quickly.
      max: Number(process.env.PG_POOL_MAX ?? 5),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });

    return {
      driver,
      db: drizzle(pool, { schema }) as unknown as Database,
      raw: pool,
      close: () => pool.end(),
    };
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");

  const dir = process.env.PGLITE_DIR ?? "./data/pg";
  await acquireLock(dir);

  const client = new PGlite(dir);

  return {
    driver,
    db: drizzle(client, { schema }) as unknown as Database,
    raw: client,
    close: async () => {
      await client.close();
      await releaseLock(dir);
    },
  };
}

/**
 * Returns the process-wide handle, creating it once. Concurrent callers share
 * a single initialisation promise so a burst of requests cannot open the
 * PGlite directory twice.
 */
export async function getDb(): Promise<DbHandle> {
  if (store.__sgDb) return store.__sgDb;
  if (!store.__sgDbInit) {
    store.__sgDbInit = create()
      .then((handle) => {
        store.__sgDb = handle;
        return handle;
      })
      .finally(() => {
        store.__sgDbInit = null;
      });
  }
  return store.__sgDbInit;
}

/** Convenience for the common case where only the Drizzle instance is needed. */
export async function db(): Promise<Database> {
  return (await getDb()).db;
}

export async function closeDb(): Promise<void> {
  if (store.__sgDb) {
    await store.__sgDb.close();
    store.__sgDb = null;
  }
}

export { schema };
