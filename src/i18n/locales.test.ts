import { describe, expect, it } from "vitest"

import { localeNames, locales } from "./locales"

describe("locales", () => {
  it("gives every locale a name", () => {
    for (const locale of locales) expect(localeNames[locale]).toBeTruthy()
  })
})
