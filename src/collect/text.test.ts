import { describe, expect, it } from "vitest"

import { cleanName, cleanText, webUrl } from "./text.ts"

describe("cleanText", () => {
  it("collapses whitespace and control characters into single spaces", () => {
    expect(cleanText("  Machine\r\n Learning\tfor\u0000Systems ", 100)).toBe(
      "Machine Learning for Systems"
    )
  })

  it("returns null for missing or blank text", () => {
    expect(cleanText(undefined, 10)).toBeNull()
    expect(cleanText(" \n ", 10)).toBeNull()
  })

  it("cuts text at the limit with an ellipsis", () => {
    expect(cleanText("abcdefghij", 5)).toBe("abcd…")
  })
})

describe("webUrl", () => {
  it("keeps an http(s) link", () => {
    expect(webUrl("https://mlforsystems.org")).toBe("https://mlforsystems.org/")
  })

  it("adds https to a bare host", () => {
    expect(webUrl("www.simbiochem.com")).toBe("https://www.simbiochem.com/")
  })

  it("rejects other schemes, words, and blanks", () => {
    expect(webUrl("javascript:alert(1)")).toBeNull()
    expect(webUrl("mailto:a@b.org")).toBeNull()
    expect(webUrl("TBA")).toBeNull()
    expect(webUrl("")).toBeNull()
    expect(webUrl(undefined)).toBeNull()
  })
})

describe("cleanName", () => {
  it("reads a placeholder entry as no name", () => {
    for (const name of [
      "nill",
      "nil",
      "NULL",
      "None",
      "n/a",
      "N/A",
      "TBD",
      "-",
      "---",
    ])
      expect(cleanName(name, 200), name).toBeNull()
  })

  it("keeps a real name as written, abbreviations included", () => {
    expect(cleanName("  Acme  Inc. ", 200)).toBe("Acme Inc.")
    expect(cleanName("NA", 200)).toBe("NA")
  })
})
