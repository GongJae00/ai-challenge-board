// @ts-check

import react from "@astrojs/react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "astro/config"

import { defaultLocale, locales } from "./src/i18n/locales.ts"

// GitHub Pages serves the site under the repository name.
export default defineConfig({
  site: "https://gongjae00.github.io",
  base: "/ai-challenge-board",
  trailingSlash: "always",
  i18n: {
    locales: [...locales],
    defaultLocale,
    routing: {
      prefixDefaultLocale: true,
    },
  },
  // GitHub Pages cannot set response headers, so the policy ships as a meta tag;
  // Astro adds hashes for its own scripts and styles.
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
    },
  },
  // The dev server's toolbar overlays the page GongJae reviews; its audits are covered by the e2e axe scan.
  devToolbar: { enabled: false },
  // No Markdown content yet, and Shiki's inline styles would conflict with the CSP.
  markdown: { syntaxHighlight: false },
  vite: {
    plugins: [tailwindcss()],
    // Subagent worktrees hold whole copies of the project, configs included; watching them restarts the dev server.
    server: { watch: { ignored: ["**/.claude/worktrees/**"] } },
  },
  integrations: [react()],
})
