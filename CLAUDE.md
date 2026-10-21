# AI-Challenge-Board (ACB)

AI-Challenge-Board, ACB for short, is a web service in Korean and English, later an app, that gathers AI
challenges, competitions, workshop paper calls, and conference-linked contests so that AI researchers can search,
filter, bookmark, and follow their deadlines. Its repository is `ai-challenge-board`.
Its first phase covers the major conferences (CVPR, ICCV, ECCV, NeurIPS, ICML, ICLR, AAAI); the project memory
holds GongJae's statement of the vision and the phase order.

Deadlines, venues, and calls in this project are the product's data, not GongJae's own research deadlines, so the
research-sprint routing in `~/.claude/CLAUDE.md` does not apply here. That skill and the other research-workflow
skills are turned off in `.claude/settings.json`.

## Current phase

Building the first working version, which GongJae uses alone and develops further before an official launch.
GongJae set these on 2026-10-21:
- The GitHub repository `GongJae00/ai-challenge-board` is public, so that the site is served free by GitHub Pages
  at https://gongjae00.github.io/ai-challenge-board/. Nothing secret goes into it, and the research folders below
  stay out of it.
- Working features come first. Until the official launch, a source needs no recorded terms review or per-source
  approval: the collector still obeys robots.txt and its Crawl-delay, keeps to facts, and runs at most twice a
  day, which the code enforces for every source.
- The data model, the repository setup, and the implementation are left to Claude, with each constraining choice
  recorded in `docs/decisions.md`.

## Scope

GongJae set these on 2026-10-20:
- Listed: time-bound challenges and competitions, workshop paper calls (CFPs), and domestic Korean competitions
  such as DACON, AIFactory, and 과기정통부 programs.
- Not listed: persistent benchmarks and leaderboards without a deadline.
- Not decided: whether journal special issues, fellowships, and internships are listed.

The landscape survey behind these choices is `reports/AI 챌린지 서비스 생태계 조사.md`, kept locally.

## Product constraints

GongJae set these on 2026-10-20:
- Non-commercial for now; the UI/UX, frontend, and backend are made stable before anything commercial is
  considered.
- No login and no personal data for now; every listing can be read without an account.
- Free hosting where possible.
- Only what is needed, cleanly built and maintainable, with a plain design taken from existing kits rather than
  made from scratch.
- Agents are used only to build ACB: no LLM or AI agent runs in the service or its collection pipeline. Other
  paid API calls need GongJae's approval.
- Collected listings go to the site automatically, with no manual review step. Sources whose terms forbid
  automated access, such as AIcrowd, DrivenData, and Devpost, are still collected, at low burden: facts only
  (title, dates, link), at most twice a day, under the collector's own User-Agent, within robots.txt's rules for
  it and its Crawl-delay, stopping when blocked.

## Layout

The site is a static Astro build; `docs/decisions.md` records the stack and why.
- `src/pages/`: routes, one folder per locale under `[locale]/`; `src/layouts/`, `src/components/`: the page
  frame and components, with shadcn/ui components under `src/components/ui/` (added with `npx shadcn add`).
- `src/i18n/`: the locale list and the KO/EN message catalog.
- `src/styles/global.css`: Tailwind and the shadcn design tokens, the one set of tokens.
- `e2e/`: Playwright tests against the production build, at phone and desktop widths, with an axe scan.
- `docs/`: `decisions.md`, and later `operations.md`.

These folders hold research material and stay local; `.gitignore` keeps them out of the repository:
- `lab/`: the working checklist of the current task, deleted when the task ends.
- `research_notes/`: notes on services and data sources, one file per topic, with evidence tags.
- `reports/`: finished reports.

## Commands

- `npm run check`: the full check, which runs formatting, lint, type check, unit tests, the build, and the
  end-to-end tests. CI runs the same command.
- `npm run dev`: the local server at http://localhost:4321/ai-challenge-board/.
- `npm run format`: apply Prettier.
- Deploy: a push to `main` that passes the check deploys to GitHub Pages; there is no separate preview deploy.
- Setup on a new machine: `npm ci`, then `npx playwright install chromium` for the end-to-end tests.

The project's `.mcp.json` runs the Playwright MCP server (headless Chromium) and the shadcn MCP server from the
installed dev dependencies, and `.claude/settings.json` enables the frontend-design plugin for this project.

## Harness

The production settings, rules, hooks, skills, and subagents in `.claude/` are kept by the harness session
(CLAUDE); `.claude/rules/engineering.md` names the project tools, such as plugins and MCP servers, that the project
adds itself. Report a correction or a missing rule to the harness session as `~/.claude/CLAUDE.md` describes,
rather than editing its parts of `.claude/` here. This file belongs to the project and changes with it.
