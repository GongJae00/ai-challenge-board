# Decisions

Decisions that constrain later work, newest first, each with its reason and the alternatives considered.

## 2026-10-21: Toolchain for the first scaffold

- TypeScript 6.0 rather than 7.0, because typescript-eslint 8.72 and @astrojs/check 0.9 accept only versions
  below 6.1.
- ESLint 10 with eslint-plugin-astro, typescript-eslint, React hooks rules, and eslint-plugin-jsx-a11y-x, a
  maintained fork used because eslint-plugin-jsx-a11y 6.10 does not support ESLint 10. Prettier formats code,
  not Markdown or `.claude/`.
- Vitest for unit tests. Playwright with axe runs end-to-end tests against the production build at a phone and
  a desktop width, both on Chromium, and fails on WCAG 2.2 AA violations and on console errors, which is where a
  script blocked by the CSP would show.
- `npm run check` runs every check in one command, and CI runs that command before the deploy, so the deployed
  files are the build the tests ran against.
- Versions are exact (`save-exact` in `.npmrc`) and recorded in the lockfile, Node is pinned in `.node-version`,
  GitHub Actions are pinned to commit SHAs, and Dependabot proposes grouped updates monthly.
- Pretendard Variable (SIL OFL 1.1) is the one typeface, since it covers Hangul and Latin; its subsets are served
  from the site, so the CSP needs no font host.
- `npm audit` reports a high-severity denial-of-service issue in `braces`, reached through the shadcn CLI's
  file globbing. The CLI runs only on a developer machine with the project's own patterns and is not part of the
  built site, so it is accepted until shadcn updates the dependency.
- Astro 7 moves `astro preview` to the background when it detects a coding agent, which Playwright reads as the
  server exiting; the Playwright config passes `--ignore-lock` to keep it in the foreground.
- Claude Code tools are installed for this project only: the frontend-design plugin, enabled in
  `.claude/settings.json`, and the Playwright and shadcn MCP servers in `.mcp.json`, run from the dev
  dependencies so that the lockfile sets their versions. The marketplace's Playwright plugin was not used
  because it runs `@playwright/mcp@latest`. Not used: claude-code-action, which bills the Claude API per pull
  request.

## 2026-10-21: A static Astro site on GitHub Pages

ACB is a static site built by Astro, with React islands where a page needs interaction and shadcn/ui
components, deployed to GitHub Pages from the public repository by GitHub Actions. It has no server, database,
or accounts.

Listings change at most twice a day and every visitor sees the same data, so pages built ahead of time can
serve them, and the CDN in front of Pages carries the traffic at no cost. GongJae chose a public repository on
2026-10-21 so that Pages and Actions are free. Astro sends no JavaScript by default and hydrates only the islands
that need it, such as filters and search. shadcn/ui is the most widely used React component kit, and its
components are copied into the repository, so they can be read and changed like the project's own code. When
collection starts, a scheduled workflow will write the data into the repository and trigger the same build,
so a new deadline needs no server either.

Alternatives considered:
- Next.js with static export works, but its conventions assume a server and it ships more client code for the
  same pages.
- SvelteKit or Vue would serve equally well, but their component kits are less established than shadcn/ui.
- Cloudflare Pages also hosts private repositories for free, but it adds a second account, which a public
  repository on GitHub Pages does not need.
- A server with a database, such as Supabase, would add per-request state that nothing needs: there is no
  login, and bookmarks can live in the visitor's browser.

This choice sets these constraints:
- The site lives under `/ai-challenge-board/`, so internal links go through `getRelativeLocaleUrl` from
  `astro:i18n` or `import.meta.env.BASE_URL`, and never start with a bare `/`.
- Pages cannot set response headers. The Content Security Policy ships as a meta tag, with hashes Astro computes
  for its own scripts and styles; `frame-ancestors` cannot be set that way, so the site has no clickjacking
  protection, which matters only once it has forms or actions worth hijacking.
- Both locales carry a prefix, `/ko/` and `/en/`, and the root redirects to `/ko/` with a meta refresh.
