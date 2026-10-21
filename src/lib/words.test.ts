import { describe, expect, it } from "vitest"

import type { Listing } from "./listing.ts"
import { namedConferences, words } from "./words.ts"

describe("words", () => {
  it("splits on anything but letters and digits, in lower case, folding full-width forms", () => {
    expect(words("ＮｅｕｒＩＰＳ 2026 — Track 1: Coding")).toEqual([
      "neurips",
      "2026",
      "track",
      "1",
      "coding",
    ])
  })
})

describe("namedConferences", () => {
  const listing = (
    title: string,
    conference: Listing["conference"]
  ): Listing => ({
    id: "codabench:1",
    source: "codabench",
    kind: "challenge",
    title,
    organizer: null,
    conference,
    url: "https://www.codabench.org/competitions/1/",
    sourceUrl: "https://www.codabench.org/competitions/1/",
    opensAt: null,
    deadlines: [
      { kind: "end", label: null, at: "2026-11-01T00:00:00.000Z", zone: "UTC" },
    ],
  })

  it("takes the conference from the field, or else from the title", () => {
    expect(
      namedConferences(listing("Workshop", { name: "AAAI", year: 2027 }))
    ).toEqual(new Set(["AAAI"]))
    expect(namedConferences(listing("NeurIPS Agenthon", null))).toEqual(
      new Set(["NeurIPS"])
    )
    expect(namedConferences(listing("항만 AI 공모전", null))).toEqual(new Set())
  })

  it("trusts the conference field over conferences a title mentions", () => {
    expect(
      namedConferences(
        listing("Reproducing NeurIPS and ICML Results", {
          name: "AAAI",
          year: 2027,
        })
      )
    ).toEqual(new Set(["AAAI"]))
  })

  it("does not take a conference name inside another word", () => {
    expect(namedConferences(listing("ICMLA style contest", null))).toEqual(
      new Set()
    )
  })
})
