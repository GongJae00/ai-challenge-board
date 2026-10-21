import { describe, expect, it } from "vitest"

import { flightText, jsonAt } from "./flight.ts"

function page(...payloads: string[]): string {
  const scripts = payloads.map(
    (p) => `<script>self.__next_f.push([1,${JSON.stringify(p)}])</script>`
  )
  return `<html><body>${scripts.join("")}</body></html>`
}

describe("flightText", () => {
  it("decodes every payload's string literal and joins them in order", () => {
    const html = page('a:["x",{"n":"\\u003cb\\u003e"}]\n', "b:1\n")
    expect(flightText(html)).toBe('a:["x",{"n":"\\u003cb\\u003e"}]\nb:1\n')
  })

  it("joins a value that the site split across two scripts", () => {
    expect(flightText(page('{"task":{"id":"1', '2"}}'))).toBe(
      '{"task":{"id":"12"}}'
    )
  })

  it("is empty for a page with no flight data", () => {
    expect(flightText("<html><body>Not found</body></html>")).toBe("")
  })
})

describe("jsonAt", () => {
  it("reads the object or array that opens at an index, brackets inside strings included", () => {
    const text = 'x:{"a":"}]","b":[1,{"c":2}]},y'
    expect(jsonAt(text, 2, "value")).toEqual({ a: "}]", b: [1, { c: 2 }] })
    expect(jsonAt(text, text.indexOf("["), "value")).toEqual([1, { c: 2 }])
  })

  it("says what is wrong when the value is cut off, malformed, or not there", () => {
    expect(() => jsonAt('{"a":1', 0, "Site list")).toThrow(
      "Site list is cut off"
    )
    expect(() => jsonAt("{a:1}", 0, "Site list")).toThrow(
      "Site list does not parse"
    )
    expect(() => jsonAt("1", 0, "Site list")).toThrow(
      "Site list does not start with { or ["
    )
  })
})
