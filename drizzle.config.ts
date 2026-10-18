import type { Config } from "drizzle-kit";

/**
 * Migrations are generated against the Postgres dialect regardless of which
 * backend runs them, so the SQL is valid on PGlite locally and on a hosted
 * Postgres in production.
 */
export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      // drizzle-kit only needs this to reach the server when pushing directly.
      // Generation is offline, so this placeholder is never dialled.
      "postgres://localhost:5432/signal_garden",
  },
  strict: true,
  verbose: false,
} satisfies Config;
