import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { locales } from "./locales"
import { messages, t } from "./messages"

describe("messages", () => {
  it.each(locales)("gives every key a non-empty %s string", (locale) => {
    const empty = Object.entries(messages[locale])
      .filter(([, text]) => text.trim() === "")
      .map(([key]) => key)
    expect(empty).toEqual([])
  })
})

describe("t", () => {
  it("fills in named values and leaves unknown placeholders visible", () => {
    expect(t("ko", "home.summary", { count: 3 })).toBe("마감 전 3건")
    expect(t("en", "deadline.phase")).toBe("{name} ends")
  })
})

describe("footer.schedule", () => {
  it("states the hours the Collect workflow runs at, 00:17 and 12:17 UTC", () => {
    // If this fails, the workflow's schedule changed: update footer.schedule in both languages, then this test.
    const workflow = readFileSync(
      new URL("../../.github/workflows/collect.yml", import.meta.url),
      "utf8"
    )
    expect(workflow).toContain('cron: "17 0,12 * * *"')
    expect(t("ko", "footer.schedule")).toContain("오전 9시와 오후 9시")
    expect(t("en", "footer.schedule")).toContain("9:00 and 21:00 KST")
  })
})
