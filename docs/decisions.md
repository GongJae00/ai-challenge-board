# Decisions

Decisions that constrain later work, newest first, each with its reason and the alternatives considered.

## 2026-10-21: Search, filters, platforms, and the sources footer

Above the table and the calendar sit a search box and, beneath it, one labeled row of chips for each way to narrow
both views: 형식 (kind), 학회 (conference), and 플랫폼 (platform), conferences and platforms in alphabetical order.
The first version put the kinds and conferences in dropdown menus beside the search box, as the language menu is;
GongJae asked for chips instead ("형식이랑 모든학회같은거 약간 체크하는 블록처럼 상단에서 바꾸는거 어떰?
Compact하게?"), then for the rows under the search box, in alphabetical order, with the competition platforms in
a row of their own ("DACON AIFactory Kaggle도 따로 빼서 이렇게 대회 막 올리는곳 따로 해서 분류 깔끔하게 만들자
줄바꿈 단위로 잘 해서"). The language stays a menu. Any number of chips can be pressed, and none pressed in a row
sets no filter for it. Every phase-1 conference and every platform has a chip, dimmed while nothing open fits:
the first menu listed only the conferences with open listings, and GongJae asked why only two appeared, which a
visitor would ask too. Each chip counts the listings it would show given the search and the other rows, so a
count does not move when another chip in its own row is pressed.

- **Platforms:** the sites that run competitions, AIFactory, Codabench, DACON, EvalAI, and Kaggle. GongJae named
  DACON, AIFactory, and Kaggle; Codabench and EvalAI run competitions the same way. OpenReview takes workshop
  papers for a conference, which is the host, so it has no chip and a listing from it names no platform. A
  listing from a platform shows the platform's name under its organizer in the host column, as in 해양수산부 above
  DACON, since GongJae found the organizer alone did not say where to enter; it is left out when the platform
  is the organizer, as for Kaggle's own competitions. `src/lib/sites.ts` holds each site's name, link, and
  whether it is a platform and Korean.
- **Search:** each space-separated term must appear in a listing's title, organizer, conference, or platform,
  the text its row shows besides the type, which the chips cover; terms are compared after NFKC and
  lower-casing. A plain substring match finds part of a Korean word without a tokenizer. It runs in the browser
  over the listings the page already holds, tens of them; a search index such as Pagefind is for when they reach
  thousands.
- **A listing's conferences, for the chips:** the conference field, or else each conference named as a whole word
  in the title, since Codabench titles such as "NeurIPS Predictive AI Evaluation Competition" name it without the
  field. A filled field wins, because a title can mention conferences a listing only relates to. The field itself
  stays filled only from structured data. Deduplication reads conferences the same way, and both use
  `src/lib/words.ts`.
- **URL:** `?q=`, `?kind=`, `?conference=`, and `?platform=`, with unencoded commas between several values, beside
  `?view=` and `?month=`, so that a filtered page survives a reload and can be shared. These names are now part of
  the public URL. Values are written in lower case (`conference=neurips`, `platform=dacon`) and read in any case,
  since a messenger app may change a link's case. The query filters as it is typed but reaches the URL once typing
  pauses or the page is left, because browsers limit how often a page may rewrite its URL, Safari to about 100
  times in 30 seconds. The calendar opens on the month of the first deadline that passes the filters. A filter
  that leaves a chosen `?month=` out of range shows the opening month and keeps the parameter, so clearing the
  filter returns to the month chosen.
- **Clearing:** the clear button sits beside the count it resets, so the search box keeps its width, and the
  keyboard returns to the search box after a clear. The browser's own clear button inside the search field is
  hidden, since it takes no design tokens.
- **Sources footer:** every page ends with the conferences ACB covers, the sites it collects from, abroad and in
  Korea, linked, and how often it collects, so that a visitor can tell what an empty result means. GongJae asked
  for it on 2026-10-21. The rows come from `src/lib/sites.ts`, which the type check requires to hold every
  source; a unit test fails if the Collect workflow's schedule no longer matches the hours the footer states.
- **Phones:** each row of chips stays one line that scrolls sideways, so that the listings start on the first
  screen; a wider screen wraps the rows. Each row is a toolbar, whose chips the arrow keys move between.
- **Language:** the language menu carries the filters and the view to the other language's page.
- **No inline styles:** the CSP blocks style attributes, so a kit component that sets one, as shadcn's
  ToggleGroup did for its gap, is changed to take a class; the end-to-end tests fail on the console error.

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
zone as an argument, so a reader's own region can replace it later. A deadline the organizers state in another
zone than the page's also shows its date and time in that zone, so that "AoE 11월 15일 23:59" on a workshop's page
reads the same on ACB; a KST deadline therefore shows no second time while the page shows KST. A deadline marked
`UTC` comes from a source that gives only an instant, with no zone of its own, so it shows no second time either.
`formatSourceTime` in `src/lib/datetime.ts` holds this rule for every view; the source's date is left out when it
is the date the page shows, as in "GMT+5:30 17:00", and a zone whose clock reads as KST's, such as JST, shows no
second time. The deadline cell keeps to two lines: the date and time, then the days left, the name of a deadline
that is not the plain end, such as 참가 신청 마감 or a phase, and the source's time. On a wide screen that second
line does not wrap, and a long phase name is cut short; a submission deadline or the end of a challenge has no
name, since the column already means the deadline. A phone lets the line wrap.

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

- **Deadlines:** each deadline is an instant in UTC with the zone the source gives it in: a code, `UTC`, `AoE`,
  `KST`, or `JST`, or else the zone's IANA name, such as `America/Los_Angeles`. A listing keeps every deadline
  still ahead, such as each challenge phase's end, and the page shows the next one. OpenReview, EvalAI, and
  Codabench store instants without the organizers' own zone. A deadline at 11:59 or 12:00 UTC is 23:59 or midnight
  AoE, the convention of paper deadlines, so `src/collect/time.ts` marks it `AoE`; the instant is the same either
  way, and the AoE form matches the organizers' announcement. Any other deadline from these sources carries `UTC`.
  The Korean sources, DACON and AIFactory, state their times in Korean time, so their deadlines carry `KST`; DACON
  writes a local time without a zone, which `isoFromLocal` converts in any IANA zone, daylight saving included.
  IANA names became necessary on 2026-10-21 with Devpost, whose deadlines fall in each event's own zone, such as
  Pacific or Helsinki time, and with Tianchi's China time; a fixed list of codes could not hold them, and the codes
  already stored stay valid. The page names a code as written and any other zone by its English short name, such
  as "PDT", or its offset, such as "GMT+8".
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
  it and its Crawl-delay, keeps one request at a time per site at least 5 seconds apart, the hosts of one site
  such as Devpost's per-hackathon subdomains counting as one, times out each request,
  tries each request up to three times on network errors, server errors, and rate limits, stops on 401, 403, a
  challenge page, or a rate limit that does not clear, and follows a redirect only through the same checks, so a
  redirect to another host first reads that host's robots.txt. `src/collect/run.ts` fetches a source at most once
  in each half of the UTC day, counting a failed attempt through the file's `attemptedAt`, which keeps every
  source to twice a day even when a scheduled run starts late. It keeps the last good file when the source fails,
  when a listing does not fit the schema, or when more than half of the listings that should still be open
  vanish.
- **Not yet:** conditional requests and a cache of detail pages. Most sources answer in a few API calls twice a
  day, and the validators would have to be stored per URL in the repository. AIFactory's list page (about 600 KB)
  carries no ETag or Last-Modified, so it cannot be asked conditionally, and the DACON and AIFactory detail pages
  are requested only for competitions still open, a few at a time. A per-id cache of organizers, kept like
  Codabench's state, waits until those requests grow.

Sources in order: OpenReview first, because one public API covers the workshop calls of five of the seven
phase-1 conferences (37 open on 2026-10-21); then EvalAI, Codabench, and Kaggle; then DACON and AIFactory, the
Korean platforms GongJae chose on 2026-10-21; then, the same day, eight more sites that run their own
competitions, after GongJae asked for every such site: DrivenData, lablab.ai, Zindi, SIGNATE, Tianchi, Devpost,
grand-challenge.org, and AIcrowd. DAKER is left out because its robots.txt disallows the only path with its
listings (see `CLAUDE.md`).
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
- **DACON** has no documented API, but its competitions page fills itself from a public JSON list,
  `app.dacon.io/api/v1/competition/list`, 15 competitions a page, which the collector reads. The list is ordered
  by end date only roughly, so paging stops after a page on which every competition ended more than 180 days ago.
  DACON writes dates as Korean local times without a zone. A listing has one deadline, the end of the
  competition period, as kind `end`, because its leaderboard can close before then; the other milestones are
  left out, since the detail page's fields disagree with its prose. The flags `practice`, `on_going`, and
  `private_open` do not mean what their names suggest and are not used. The organizer, 주최, is read from each
  open competition's page, best effort; 주관 and 운영, usually DACON itself, are never taken for it.
- **AIFactory** serves its whole list, 112 competitions on 2026-10-21, in the Next.js data of one server-rendered
  page, which the collector reads without running it. Its instants are exact, and the organizers enter and the
  site shows them in Korean time, so the deadlines carry `KST`: the end of the competition period as `end`, and
  the registration deadline as `entry` when it falls before the end. The organizer comes only from the
  structured 주최 row of a competition's page; the list's host page name is sometimes a series or AIFactory
  itself, so it is not used. Practice entries and recruitment posts are dropped by their title prefixes. Nothing
  was open on 2026-10-21, so the source lists nothing until a competition opens.
- **DrivenData:** one request to the server-rendered competitions page; only the cards in its prize section are
  listed, since the page also holds benchmarks, practice, and completed competitions. The end date is written
  in UTC in a tooltip; the organizer is the host logo's alt text.
- **lablab.ai:** one request; all its AI hackathons are in the page's Next.js data. The end of an event is its
  deadline, in the event's own time zone when it has one; there is no organizer field.
- **Zindi:** one request to the JSON list behind its site, with all 515 entries. Entries that need a private code
  are left out. Times are exact UTC instants.
- **SIGNATE:** the JSON list behind its site, then one overview request per open competition for its submission
  deadline, which carries a +09:00 offset and is shown as `JST`. Titles are in Japanese only.
- **Tianchi:** the JSON race list behind its site, paged until a page has only competitions that ended long ago.
  Times are China local times read as `Asia/Shanghai`. Learning competitions, leaderboard competitions (打榜赛),
  and series containers are left out;
  the English name is used when there is one.
- **Devpost:** the JSON list behind its site, asked for open and upcoming hackathons with the "Machine
  Learning/AI" theme and checked for that theme item by item; invite-only events are left out, and an organizer
  entered as a placeholder, such as "nill" or "N/A", is taken as none. The list gives
  dates only, so the exact deadline and its zone come from each hackathon's calendar file, a request GongJae
  approved; `src/data/state/devpost.json` remembers each one, so a calendar is fetched again only when the
  hackathon's dates change or three days have passed, which catches a deadline moved within the same day. A
  calendar ACB cannot place, such as an all-day event, leaves that hackathon out rather than stopping the source.
- **grand-challenge.org:** its robots.txt disallows the API, so the collector reads the HTML list of open
  challenges. A card states a deadline only while exactly one phase is open, so the source lists few; post-
  challenge phases, open leaderboards after a challenge, are left out as persistent. A practice phase such as
  Debug or Sanity Check is listed by its name, since it is the only deadline the card shows while the challenge
  takes entrants.
- **AIcrowd:** its robots.txt turns away AI crawlers but allows the collector with a 10-second Crawl-delay. The
  running list's cards give the current phase's end; a challenge page with the newer overview gives every round.
  Only cards that offer a prize or another award are listed, which leaves out the coursework and test entries
  that also run there.
- **HTML pages:** DrivenData, grand-challenge.org, and AIcrowd publish their lists only as server-rendered HTML,
  which the collectors read with `node-html-parser` and CSS selectors rather than regular expressions. It was
  chosen on 2026-10-21 over cheerio, which brings eleven dependencies and about 1 MB, and parse5, which has no
  selectors; it is pinned to 9.0.4, the release before one published two days earlier.
- **Duplicates:** a challenge that two sources carry, such as NeurIPS's Predictive AI Evaluation Competition on
  OpenReview and Codabench, is listed once. `src/lib/duplicates.ts` merges two listings from different sources at
  build time when they have the same kind, the same title words once conference names, years, "at", and "the" are
  set aside, no conflicting conference in their conference fields or titles, and a deadline in the same minute.
  The title words keep apart the tracks of one challenge, which share a deadline; the deadline keeps apart the
  yearly editions of one, whose titles may differ only in the year. Two entries of one source are never merged,
  since the source counts them as two. The challenge platform's listing is kept, because it has the phases and
  the submission page; it takes the conference, organizer, and opening date it lacks from the other, and every
  deadline it does not have, so that a merge loses no deadline. Between two platforms the lower id is kept. The
  shown id therefore changes when a source starts or stops carrying the challenge, which bookmarks will have to
  allow for. The source files stay as each source gave them, since the collector's checks compare a source with its
  own last run. A pair whose titles differ in other words is still listed twice.

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
