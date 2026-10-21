/// <reference types="node" />

import { defineConfig, devices } from "@playwright/test"

// Its own port, so that a running `npm run dev` on 4321 is never tested in place of the build.
const port = 4322

// Runs against the production build, as GitHub Pages serves it under /ai-challenge-board/.
export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${port}/ai-challenge-board/`,
  },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } },
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
  webServer: {
    // --ignore-lock keeps the server in the foreground, which Astro would otherwise
    // move to the background when it detects a coding agent.
    command: `npm run preview -- --port ${port} --ignore-lock`,
    url: `http://localhost:${port}/ai-challenge-board/`,
    reuseExistingServer: false,
  },
})
