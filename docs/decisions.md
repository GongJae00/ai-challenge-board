# Decisions

Decisions that constrain later work, newest first, each with its reason and the alternatives considered.

## 2026-10-21: A table and a calendar of the listings

The home page shows the open listings in a table, with a calendar one tab away, on a page as wide as a desktop
screen allows (`max-w-6xl`), and the language is chosen from a menu in the header. GongJae rejected the first
layout, a narrow feed of rows grouped by month, as app-like and cluttered for a website, and named the table's
columns: start date, deadline, host, title, and type (paper call or challenge). The table has one row per
listing with its next deadline; the calendar places every deadline ahead, each challenge phase included, on its
day: each day cell counts its deadlines and links to that date in a list of the month's deadlines below the
grid, since titles cut to fit a cell told readers little. On a phone the table keeps the deadline and title
columns and puts the type and host under the title. The chosen view and month stay in the URL, so a return from a
listing's site, a reload, or a shared link opens the same view.

Every date and time is shown in Korean time (KST), on the English page too, as GongJae decided: "시작일과
마감일이나 시간같은거 한국시간 기준으로하자. 나중에 로그인같은거 기능만들면 국가선택같은거 해서 그 국가나지역
표준시에 맞게 알아서 변환되도록하면 편할거같음." The deadline column's header and the calendar say so, and
`DISPLAY_TIME_ZONE` in `src/lib/datetime.ts` is the one place to change it; the formatting functions take the
zone as an argument, so a reader's own region can replace it later. A deadline the organizers state in AoE also
shows its AoE date and time, so that "AoE 11월 15일 23:59" on a workshop's page reads the same on ACB. A
deadline marked `UTC` comes from a source that gives only an instant, with no zone of its own, so it shows no
second time. The deadline cell keeps to two lines: the date and time, then the days left and the AoE time.

## 2026-10-21: Type and spacing

One typeface, Pretendard, in a small scale, so that new pages look like the existing ones without a decision
each time:
- **Page title:** `text-2xl` (24px) semibold, one per page.
- **Section or month title:** `text-lg` (18px) semibold.
- **Body and table text:** `text-sm` (14px); a listing's title is medium weight, as the thing a reader scans for.
- **Secondary facts:** `text-xs` (12px) in `text-muted-foreground`, such as the days left, a phase's name, or
  the AoE time beneath a deadline. A deadline a week or less away turns its days left semibold in the
  foreground color; no other color marks urgency.
- **Numbers:** dates, times, and counts that line up in a column use `tabular-nums`.
- **Width and spacing:** content sits in `max-w-6xl` with `px-4` side gutters, and spacing comes from
  Tailwind's scale; colors come only from the shadcn tokens in `global.css`.

These rules write down what the first pages use. GongJae's design reviews refine them, and ui-reviewer checks a
new page against them.

## 2026-10-21: A light page only

The site is light whatever the viewer's system setting. GongJae read the dark rendering, which the page had
followed from the operating system, as not the real design ("왜 검은색 배경이야 사이트 웹 실제 디자인으로
볼래"). The dark tokens stay in `global.css` as shadcn ships them, under a `.dark` class that nothing sets, so a
switch can be added later without new tokens.

## 2026-10-21: Listing data and the collectors

A listing is one challenge or workshop paper call. Its fields are its source, its kind (`challenge` or `cfp`),
its title and organizer, its conference and year when the source states them, the link a visitor follows, the
source page the facts came from, when it opens, and one or more deadlines. `src/lib/listing.ts` holds the schema,
and the collector, the build, and the pages all use it. A listing's id is `<source>:<the source's own id>`, so it
stays the same across runs and can later key bookmarks and calendar events.

- **Deadlines:** each deadline is an instant in UTC with the zone the source gives it in, `UTC` or `AoE`. A
  listing keeps every deadline still ahead, such as each challenge phase's end, and the page shows the next one.
  OpenReview, EvalAI, and Codabench store instants without the organizers' own zone. A deadline at 11:59 or
  12:00 UTC is 23:59 or midnight AoE, the convention of paper deadlines, so `src/collect/time.ts` marks it `AoE`;
  the instant is the same either way, and the AoE form matches the organizers' announcement. Any other deadline
  carries `UTC`.
- **Conference:** filled only from a structured field, such as OpenReview's venue group or an EvalAI tag like
  `cvpr2026`, never guessed from a title or description, since these mention conferences that a challenge merely
  follows.
- **What is listed:** calls and challenges that have not closed. A challenge that ends more than two years ahead
  is treated as a persistent benchmark and left out, because EvalAI marks benchmarks only with placeholder ends
  such as 2099.
- **Storage:** the collector writes one JSON file per source to `src/data/sources/`, which the repository keeps,
  so that each run's data is versioned and a failed run leaves the last good file in place. An Astro content
  collection validates the files at build time, and the home page renders them.
- **Collection rules in code:** `src/collect/http.ts` reads robots.txt before anything else on a host and obeys
  it and its Crawl-delay, keeps one request at a time per host at least 5 seconds apart, times out each request,
  tries each request up to three times on network errors, server errors, and rate limits, stops on 401, 403, a
  challenge page, or a rate limit that does not clear, and follows a redirect only through the same checks, so a
  redirect to another host first reads that host's robots.txt. `src/collect/run.ts` fetches a source at most once
  in each half of the UTC day, counting a failed attempt through the file's `attemptedAt`, which keeps every
  source to twice a day even when a scheduled run starts late. It keeps the last good file when the source fails,
  when a listing does not fit the schema, or when more than half of the listings that should still be open
  vanish.
- **Not yet:** conditional requests. Each source answers in a few API calls twice a day, and the validators would
  have to be stored per URL in the repository; they wait until a source serves large pages.

Sources in order: OpenReview first, because one public API covers the workshop calls of five of the seven
phase-1 conferences (37 open on 2026-10-21); then EvalAI, Codabench, and Kaggle.
- **Codabench** lists 1,536 public entries, most of them coursework and tests, sends its API responses at a few
  kilobytes a second, and gives deadlines only in a request per competition. The collector therefore takes only
  the competitions whose title names a phase-1 conference, found through Codabench's search and checked against
  the title, and reads the conference and its year from the title. It remembers in
  `src/data/state/codabench.json` the competitions that ended more than 30 days ago or never end, so it does not
  request them again; one that ended lately is still checked, in case its deadline is extended. A challenge whose title names no conference is
  missed. This was chosen over dropping Codabench, which GongJae raised on 2026-10-21, because Codabench hosts
  most of the CVPR and NeurIPS workshop challenges.
- **Kaggle** is read through its official API with GongJae's token (see `CLAUDE.md`). Getting Started
  competitions, which stay open with placeholder 2030 deadlines, are left out. A listing carries the entry and
  team merger deadlines as well as the final one, as the deadline kinds `entry` and `merger`.
- **Not yet deduplicated:** a competition that both OpenReview and Codabench list, such as NeurIPS's Predictive AI
  Evaluation Competition, appears twice.

The collector runs in Node 22 directly from TypeScript, using Node's type stripping, so it needs no build step;
its modules import each other with `.ts` extensions. Alternatives considered: `tsx` as a runner, which adds a
dependency Node no longer needs; and storing listings in a hosted database, which a static site cannot query
without a server.

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
