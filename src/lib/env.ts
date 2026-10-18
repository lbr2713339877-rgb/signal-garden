import { existsSync } from "node:fs";

/**
 * Loads .env.local, then .env, into process.env for CLI entry points.
 * Next.js does this itself for the web app; tsx-run jobs need it explicitly.
 *
 * Variables already present in the environment always win, so a CI secret is
 * never shadowed by a stray local file, and .env.local wins over .env.
 */
export function loadLocalEnv(): void {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    const before = { ...process.env };
    process.loadEnvFile(file);
    for (const [k, v] of Object.entries(before)) process.env[k] = v;
  }
}
