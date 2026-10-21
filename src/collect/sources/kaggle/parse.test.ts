import { describe, expect, it } from "vitest"

import { listingSchema } from "../../../lib/listing.ts"
import page1 from "./fixtures/list-general-page1.json"
import page2 from "./fixtures/list-general-page2.json"
import { parseListPage, toListing } from "./parse.ts"

const now = new Date("2026-10-21T07:00:00Z")
const competitions = [
  ...parseListPage(page1).competitions,
  ...parseListPage(page2).competitions,
]

describe("parseListPage", () => {
  it("reads every competition on a page, with the fields Kaggle leaves out as empty", () => {
    expect(parseListPage(page1).competitions).toHaveLength(20)
    expect(parseListPage(page2).competitions).toHaveLength(2)
  })

  it("rejects a response without a competitions list", () => {
    expect(() => parseListPage({ items: [] })).toThrow(/Kaggle list/)
  })
})

describe("toListing", () => {
  const listings = competitions.flatMap((c) => {
    const listing = toListing(c, now)
    return listing ? [listing] : []
  })

  it("leaves out Getting Started competitions and their placeholder 2030 deadlines", () => {
    expect(listings).toHaveLength(11)
    expect(
      listings.every((l) => !l.deadlines.some((d) => d.at.startsWith("2030")))
    ).toBe(true)
  })

  it("gives each listing the entry, team merger, and final deadlines still ahead, in UTC", () => {
    const listing = listings.find((l) =>
      l.deadlines.some((d) => d.at === "2027-01-14T23:59:00.817Z")
    )
    expect(listing?.deadlines).toEqual([
      {
        kind: "entry",
        label: null,
        at: "2027-01-06T23:59:00.000Z",
        zone: "UTC",
      },
      {
        kind: "submission",
        label: null,
        at: "2027-01-14T23:59:00.817Z",
        zone: "UTC",
      },
    ])
  })

  it("keeps a team merger deadline only when it differs from the entry deadline", () => {
    const listing = listings.find((l) =>
      l.deadlines.some((d) => d.at === "2026-10-26T11:59:00.000Z")
    )
    expect(listing?.deadlines.map((d) => d.kind)).toEqual([
      "entry",
      "merger",
      "submission",
    ])
  })

  it("counts an entry deadline in the same minute as the final one as the same deadline", () => {
    // Gemma 4 Paper Track: entry 23:59:00.000Z, final 23:59:00.807Z.
    const listing = listings.find((l) =>
      l.deadlines.some((d) => d.at === "2026-11-12T23:59:00.807Z")
    )
    expect(listing?.deadlines.map((d) => d.kind)).toEqual(["submission"])
  })

  it("fills the fields ACB shows and fits the schema", () => {
    for (const listing of listings) {
      expect(listingSchema.safeParse(listing).success).toBe(true)
      expect(listing.source).toBe("kaggle")
      expect(listing.kind).toBe("challenge")
      expect(listing.url).toMatch(/^https:\/\/www\.kaggle\.com\/competitions\//)
    }
  })

  it("lists nothing once the final deadline has passed", () => {
    const later = new Date("2028-01-01T00:00:00Z")
    expect(
      competitions.map((c) => toListing(c, later)).filter(Boolean)
    ).toEqual([])
  })
})
