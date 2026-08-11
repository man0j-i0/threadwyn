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
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // `.next` holds compiled copies of the same modules; picking those up would
    // find every test twice and report failures against files nobody edits.
    exclude: ["node_modules/**", ".next/**", ".next-verify/**"],
  },
});
