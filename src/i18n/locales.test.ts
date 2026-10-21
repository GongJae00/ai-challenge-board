import { describe, expect, it } from "vitest"

import { otherLocale } from "./locales"

describe("otherLocale", () => {
  it("pairs Korean and English", () => {
    expect(otherLocale("ko")).toBe("en")
    expect(otherLocale("en")).toBe("ko")
  })
})
