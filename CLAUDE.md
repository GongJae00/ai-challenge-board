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

Research and design. The stack and the hosting are not chosen, and no feature is implemented until GongJae
approves the first scope and the stack. This directory is a local git repository; the GitHub repository will be
private and does not exist yet.

## Scope

GongJae set these on 2026-10-20:
- Listed: time-bound challenges and competitions, workshop paper calls (CFPs), and domestic Korean competitions
  such as DACON, AIFactory, and 과기정통부 programs.
- Not listed: persistent benchmarks and leaderboards without a deadline.
- Not decided: whether journal special issues, fellowships, and internships are listed.

The landscape survey behind these choices is `reports/AI 챌린지 서비스 생태계 조사.md`.

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

These folders hold research material and stay local; `.gitignore` keeps them out of the repository, which
holds only the service.

- `lab/`: the working checklist of the current task, deleted when the task ends.
- `research_notes/`: notes on services and data sources, one file per topic, with evidence tags.
- `reports/`: finished reports.

## Commands

None yet. When the stack is chosen, name here the one command that runs the full check (formatting, lint, type
check, tests, and build) and the commands that run the service locally and deploy a preview.

## Harness

The production rules, skills, and settings in `.claude/` are kept by the harness session (CLAUDE). Report a
correction or a missing rule to it as `~/.claude/CLAUDE.md` describes, rather than editing `.claude/` here. This
file belongs to the project and changes with it.
