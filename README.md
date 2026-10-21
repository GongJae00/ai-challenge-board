# AI Challenge Board

Deadlines for AI challenges, competitions, and workshop paper calls in one place, in Korean and English.

AI 챌린지, 대회, 워크숍 논문 모집의 마감일을 한곳에서 확인합니다.

- Site: https://gongjae00.github.io/ai-challenge-board/
- Status: early development, with no listings yet.

## Development

Requires Node.js 22.22 or later; `.node-version` names the version CI uses.

```sh
npm ci
npx playwright install chromium   # once, for the end-to-end tests
npm run dev                       # http://localhost:4321/ai-challenge-board/
npm run check                     # format, lint, type check, unit tests, build, e2e tests
```

A push to `main` that passes `npm run check` deploys the site to GitHub Pages.

## Stack

A static [Astro](https://astro.build) site with React islands, [shadcn/ui](https://ui.shadcn.com), and Tailwind
CSS, built and deployed by GitHub Actions. [docs/decisions.md](docs/decisions.md) records why.
