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
