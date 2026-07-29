import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Agent tooling and machine-local checkouts, which `.gitignore` already
    // keeps out of the repository. Flat config does not consult `.gitignore`,
    // so the gate has to be told separately or a stray worktree gets linted as
    // if it were source.
    ".claude/**",
  ]),
]);

export default eslintConfig;
