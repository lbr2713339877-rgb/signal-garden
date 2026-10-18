import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * `base` pins Tailwind's source scan to this project.
 *
 * Tailwind v4 otherwise scans from process.cwd(). Started from another
 * directory — a preview server launched from a parent folder, a monorepo
 * script, CI — it finds none of these components, emits no utility classes,
 * and every layout collapses while colours still work. Anchoring to this
 * file's own directory makes the build independent of where it runs.
 */
const root = dirname(fileURLToPath(import.meta.url));

const config = {
  plugins: {
    "@tailwindcss/postcss": { base: root },
  },
};

export default config;
