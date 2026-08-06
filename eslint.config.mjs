import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    rules: {
      // `const { embedding: _e, ...rest } = row` is how we strip a 256-float
      // vector before it crosses the wire. The underscore prefix marks the
      // omission as deliberate rather than forgotten.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },

  // `.next-verify` is the throwaway dist dir used by `npm run build:check`, so a
  // production build can be verified without stomping on the running dev
  // server's `.next`. It is build output like any other — never lint it.
  // `.claude` and `.agents` hold installed agent tooling, not application code.
  // Without them here, `npm run lint` reports hundreds of warnings from someone
  // else's source.
  globalIgnores([
    ".next/**",
    ".next-verify/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".claude/**",
    ".agents/**",
  ]),
]);

export default eslintConfig;
