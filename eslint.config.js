import js from "@eslint/js"
import astro from "eslint-plugin-astro"
import jsxA11y from "eslint-plugin-jsx-a11y-x"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import globals from "globals"
import tseslint from "typescript-eslint"
import { defineConfig, globalIgnores } from "eslint/config"

export default defineConfig([
  globalIgnores(["dist", ".astro", "test-results", "playwright-report"]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.configs.recommended,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  astro.configs.recommended,
  astro.configs["jsx-a11y-recommended"],
  {
    files: ["*.{js,mjs,ts}"],
    languageOptions: {
      globals: globals.node,
    },
  },
])
