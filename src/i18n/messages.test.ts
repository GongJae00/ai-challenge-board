import { describe, expect, it } from "vitest"

import { locales } from "./locales"
import { messages } from "./messages"

describe("messages", () => {
  it.each(locales)("gives every key a non-empty %s string", (locale) => {
    const empty = Object.entries(messages[locale])
      .filter(([, text]) => text.trim() === "")
      .map(([key]) => key)
    expect(empty).toEqual([])
  })
})
