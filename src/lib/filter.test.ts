import { describe, expect, it } from "vitest"

import { facetCounts, filterListings, type Filters } from "./filter.ts"
import type { Listing } from "./listing.ts"

const workshop: Listing = {
  id: "openreview:AAAI.org/2027/Workshop/TrustAI",
  source: "openreview",
  kind: "cfp",
  title: "Workshop on Trustworthy AI",
  organizer: null,
  conference: { name: "AAAI", year: 2027 },
  url: "https://example.org/trust",
  sourceUrl: "https://openreview.net/group?id=AAAI.org/2027/Workshop/TrustAI",
  opensAt: null,
  deadlines: [
    {
      kind: "submission",
      label: null,
      at: "2026-11-01T11:59:00.000Z",
      zone: "AoE",
    },
  ],
}

// Codabench names the conference only in the title.
const challenge: Listing = {
  ...workshop,
  id: "codabench:17828",
  source: "codabench",
  kind: "challenge",
  title: "NeurIPS Predictive AI Evaluation Competition",
  conference: null,
  url: "https://www.codabench.org/competitions/17828/",
  sourceUrl: "https://www.codabench.org/competitions/17828/",
}

const dacon: Listing = {
  ...workshop,
  id: "dacon:236771",
  source: "dacon",
  kind: "challenge",
  title: "항만 문제해결을 위한 AI 기술 공모전",
  organizer: "해양수산부",
  conference: null,
  url: "https://dacon.io/competitions/official/236771/overview/description",
  sourceUrl:
    "https://dacon.io/competitions/official/236771/overview/description",
}

const all = [workshop, challenge, dacon]
const none: Filters = { query: "", kinds: [], conferences: [], platforms: [] }

describe("filterListings", () => {
  it("keeps every listing when no filter is set", () => {
    expect(filterListings(all, none)).toEqual(all)
  })

  it("finds a listing by part of its title, in any case", () => {
    expect(filterListings(all, { ...none, query: "trustworthy" })).toEqual([
      workshop,
    ])
    expect(filterListings(all, { ...none, query: "PREDICT" })).toEqual([
      challenge,
    ])
  })

  it("finds a Korean title by part of a word", () => {
    expect(filterListings(all, { ...none, query: "항만" })).toEqual([dacon])
  })

  it("finds a listing by its organizer or its conference", () => {
    expect(filterListings(all, { ...none, query: "해양수산부" })).toEqual([
      dacon,
    ])
    expect(filterListings(all, { ...none, query: "aaai 2027" })).toEqual([
      workshop,
    ])
  })

  it("needs every word of the query, in any order", () => {
    expect(filterListings(all, { ...none, query: "AI workshop" })).toEqual([
      workshop,
    ])
    expect(filterListings(all, { ...none, query: "workshop 항만" })).toEqual([])
  })

  it("ignores spaces around and between the words", () => {
    expect(filterListings(all, { ...none, query: "  " })).toEqual(all)
    expect(
      filterListings(all, { ...none, query: " trustworthy   ai " })
    ).toEqual([workshop])
  })

  it("keeps the listings of the kinds picked", () => {
    expect(filterListings(all, { ...none, kinds: ["challenge"] })).toEqual([
      challenge,
      dacon,
    ])
    expect(
      filterListings(all, { ...none, kinds: ["challenge", "cfp"] })
    ).toEqual(all)
  })

  it("keeps the listings of the conferences picked, including those that name one only in the title", () => {
    expect(filterListings(all, { ...none, conferences: ["NeurIPS"] })).toEqual([
      challenge,
    ])
    expect(
      filterListings(all, { ...none, conferences: ["NeurIPS", "AAAI"] })
    ).toEqual([workshop, challenge])
  })

  it("keeps the listings of the platforms picked", () => {
    expect(filterListings(all, { ...none, platforms: ["dacon"] })).toEqual([
      dacon,
    ])
    expect(
      filterListings(all, { ...none, platforms: ["codabench", "dacon"] })
    ).toEqual([challenge, dacon])
  })

  it("finds a listing by the platform its row names", () => {
    expect(filterListings(all, { ...none, query: "dacon" })).toEqual([dacon])
  })

  it("applies every filter together", () => {
    expect(
      filterListings(all, { ...none, query: "ai", kinds: ["challenge"] })
    ).toEqual([challenge, dacon])
    expect(
      filterListings(all, {
        ...none,
        query: "ai",
        kinds: ["cfp"],
        conferences: ["NeurIPS"],
      })
    ).toEqual([])
  })
})

describe("facetCounts", () => {
  it("counts each kind and each conference, 0 for those with none", () => {
    const counts = facetCounts(all, none)
    expect(counts.kinds).toEqual({ challenge: 2, cfp: 1 })
    expect(counts.platforms).toEqual({
      aifactory: 0,
      codabench: 1,
      dacon: 1,
      evalai: 0,
      kaggle: 0,
    })
    expect(counts.conferences).toEqual({
      CVPR: 0,
      ICCV: 0,
      ECCV: 0,
      NeurIPS: 1,
      ICML: 0,
      ICLR: 0,
      AAAI: 1,
    })
  })

  it("counts within the query and the other list, but not the list itself", () => {
    const counts = facetCounts(all, {
      ...none,
      query: "ai",
      kinds: ["cfp"],
      conferences: ["NeurIPS"],
    })
    // Kinds within NeurIPS: the challenge only.
    expect(counts.kinds).toEqual({ challenge: 1, cfp: 0 })
    // Conferences within the paper calls: AAAI only.
    expect(counts.conferences.AAAI).toBe(1)
    expect(counts.conferences.NeurIPS).toBe(0)
  })
})
