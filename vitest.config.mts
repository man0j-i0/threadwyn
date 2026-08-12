import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Unit tests only, and deliberately so.
 *
 * Everything these cover is pure: given the same input it returns the same
 * output, with no database, no network and no React. That is what makes the
 * suite worth having the day before a demo — it runs in well under a second, so
 * there is no reason not to run it before every push.
 *
 * `.mts`, because the config uses ESM syntax and the nearest package.json has
 * no `"type": "module"` — a plain `.ts` config gets loaded as CommonJS and
 * warns on every run.
 */
export default defineConfig({
  resolve: {
    // Reads the `@/*` alias straight out of tsconfig, so it can never drift
    // between the app and the tests. Native in this Vite version; the
    // `vite-tsconfig-paths` plugin is no longer needed for it.
    tsconfigPaths: true,
    alias: {
      // `server-only` throws on import unless the resolver picks its
      // `react-server` condition, which only the Next build does. Point it at
      // the same empty module that condition resolves to, so a server module
      // can be unit tested. The guard it provides is a bundler-time one — there
      // is no client boundary inside vitest for it to protect.
      //
      // Resolved to an absolute path rather than the specifier, because the
      // package's `exports` field publishes no subpaths and would reject
      // `server-only/empty.js`.
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // `.next` holds compiled copies of the same modules; picking those up would
    // find every test twice and report failures against files nobody edits.
    exclude: ["node_modules/**", ".next/**", ".next-verify/**"],
  },
});
