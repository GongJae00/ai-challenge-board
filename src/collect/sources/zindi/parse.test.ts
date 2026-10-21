import { describe, expect, it } from "vitest"

import { listingSchema } from "../../../lib/listing.ts"
import list from "./fixtures/competitions-list.json"
import {
  competitionUrl,
  isOpenToPublic,
  parseCompetitions,
  toListing,
  type Competition,
} from "./parse.ts"

const now = new Date("2026-10-21T12:00:00Z")

/**
 * The fixture holds 7 of the 515 records its meta counts, as the real response did before they were cut down, so
 * the response a test parses states the 7 it holds.
 */
const complete = {
  data: list.data,
  meta: { ...list.meta, total_count: list.data.length },
}

const competitions = parseCompetitions(complete)
const byId = (id: string): Competition => {
  const found = competitions.find((c) => c.id === id)
  if (!found) throw new Error(`fixture has no competition ${id}`)
  return found
}

/** A response of one record, the fixture's first with fields replaced, as the API would send it. */
function withRecord(change: Record<string, unknown>) {
  return {
    data: [{ ...list.data[0], ...change }],
    meta: { ...list.meta, total_count: 1 },
  }
}

describe("parseCompetitions", () => {
  it("reads each record's id, title, organization, state, and times", () => {
    expect(competitions.map((c) => c.id)).toEqual(list.data.map((r) => r.id))
    expect(byId("google-mumbai-data-challenge")).toEqual({
      id: "google-mumbai-data-challenge",
      title: "Google Mumbai Data Challenge: Air Quality Mapping & Forecasting",
      organization: "Google",
      open: true,
      secretCodeRequired: false,
      startTime: "2026-10-26T12:00:00.000Z",
      endTime: "2026-11-13T12:00:00.000Z",
      entriesCloseAt: null,
    })
    expect(
      byId("geoai-aquaculture-pond-identification-challenge")
    ).toMatchObject({
      organization: "FAO and ITU",
      open: false,
      entriesCloseAt: "2026-08-07T21:59:00.000Z",
    })
  })

  it("reads an organization of null as null", () => {
    expect(byId("bias-bounty-mapping-equity-challenge").organization).toBeNull()
  })

  it("fails when the meta counts more records than the response holds", () => {
    // The real meta: 515 records, of which the fixture keeps 7.
    expect(() => parseCompetitions(list)).toThrow(
      /Zindi has 515 competitions but the response holds 7/
    )
  })

  it.each([
    ["is not an object", "<html>"],
    ["has no data", { meta: list.meta }],
    ["has no meta", { data: list.data }],
    ["has a meta without a total", { data: [], meta: {} }],
    ["has a record without an id", withRecord({ id: undefined })],
    ["has an id that is not a path segment", withRecord({ id: "a/../b" })],
    ["has a blank title", withRecord({ title: "  " })],
    [
      "has an end time that is not an instant",
      withRecord({ end_time: "soon" }),
    ],
    [
      "has an end time with an offset",
      withRecord({ end_time: "2026-10-31T23:59:00+02:00" }),
    ],
    ["has no start time", withRecord({ start_time: null })],
    ["has an open flag that is not a boolean", withRecord({ open: "yes" })],
    [
      "has no secret_code_required flag",
      withRecord({ secret_code_required: undefined }),
    ],
    [
      "has an entries_close_at that is not an instant",
      withRecord({ entries_close_at: "later" }),
    ],
  ])("fails on a response that %s", (_name, json) => {
    expect(() => parseCompetitions(json)).toThrow(/Zindi .* does not fit/)
  })
})

describe("isOpenToPublic", () => {
  it("accepts an open record that ends ahead and asks for no code", () => {
    expect(
      isOpenToPublic(byId("bias-bounty-mapping-equity-challenge"), now)
    ).toBe(true)
  })

  it("accepts an upcoming record, which is open before it starts", () => {
    expect(isOpenToPublic(byId("google-mumbai-data-challenge"), now)).toBe(true)
  })

  it("rejects a record that needs a secret code", () => {
    expect(isOpenToPublic(byId("eswatini-indabax-hack"), now)).toBe(false)
    expect(
      isOpenToPublic(byId("climate-risk-health-prediction-challenge-miva"), now)
    ).toBe(false)
  })

  it("rejects closed records", () => {
    expect(
      isOpenToPublic(
        byId("geoai-aquaculture-pond-identification-challenge"),
        now
      )
    ).toBe(false)
    expect(isOpenToPublic(byId("fowl-escapades"), now)).toBe(false)
  })

  it("rejects an open record whose end has passed", () => {
    const late = new Date("2026-11-01T00:00:00Z")
    expect(
      isOpenToPublic(byId("bias-bounty-mapping-equity-challenge"), late)
    ).toBe(false)
  })

  it("rejects an open record whose end is a placeholder years ahead", () => {
    const record: Competition = {
      ...byId("bias-bounty-mapping-equity-challenge"),
      endTime: "2099-12-31T23:59:00.000Z",
    }
    expect(isOpenToPublic(record, now)).toBe(false)
  })
})

describe("competitionUrl", () => {
  it("is the competition's page on zindi.world", () => {
    expect(competitionUrl("fowl-escapades")).toBe(
      "https://zindi.world/competitions/fowl-escapades"
    )
  })
})

describe("toListing", () => {
  it("takes the title, links, opening, and end of an open record", () => {
    const listing = toListing(byId("bias-bounty-mapping-equity-challenge"), now)
    const url =
      "https://zindi.world/competitions/bias-bounty-mapping-equity-challenge"
    expect(listing).toEqual({
      id: "zindi:bias-bounty-mapping-equity-challenge",
      source: "zindi",
      kind: "challenge",
      title: "Bias Bounty Mapping Equity Challenge",
      organizer: null,
      conference: null,
      url,
      sourceUrl: url,
      opensAt: "2026-08-28T14:00:00.000Z",
      deadlines: [
        {
          kind: "end",
          label: null,
          at: "2026-10-31T23:59:00.000Z",
          zone: "UTC",
        },
      ],
    })
    expect(listingSchema.safeParse(listing).success).toBe(true)
  })

  it("names the organization as the organizer", () => {
    expect(toListing(byId("google-mumbai-data-challenge"), now).organizer).toBe(
      "Google"
    )
  })

  it("lists an upcoming record with its opening in the future", () => {
    const listing = toListing(byId("google-mumbai-data-challenge"), now)
    expect(listing.opensAt).toBe("2026-10-26T12:00:00.000Z")
    expect(Date.parse(listing.opensAt!)).toBeGreaterThan(now.getTime())
  })

  it("keeps a deadline at noon UTC as UTC, since Zindi gives exact instants and states no AoE", () => {
    const listing = toListing(byId("google-mumbai-data-challenge"), now)
    expect(listing.deadlines).toEqual([
      { kind: "end", label: null, at: "2026-11-13T12:00:00.000Z", zone: "UTC" },
    ])
  })

  it("adds the entry deadline when it is ahead and earlier than the end", () => {
    const record: Competition = {
      ...byId("bias-bounty-mapping-equity-challenge"),
      entriesCloseAt: "2026-10-25T21:59:00.000Z",
    }
    expect(toListing(record, now).deadlines).toEqual([
      {
        kind: "entry",
        label: null,
        at: "2026-10-25T21:59:00.000Z",
        zone: "UTC",
      },
      { kind: "end", label: null, at: "2026-10-31T23:59:00.000Z", zone: "UTC" },
    ])
  })

  it("skips an entry deadline that has passed", () => {
    // The fixture's own entries_close_at, 2026-08-07, is behind now.
    const record: Competition = {
      ...byId("geoai-aquaculture-pond-identification-challenge"),
      open: true,
      endTime: "2026-12-01T21:59:00.000Z",
    }
    expect(toListing(record, now).deadlines.map((d) => d.kind)).toEqual(["end"])
  })

  it("skips an entry deadline in the same minute as the end or after it", () => {
    const base = byId("bias-bounty-mapping-equity-challenge")
    for (const entriesCloseAt of [
      "2026-10-31T23:59:30.000Z",
      "2026-11-02T00:00:00.000Z",
    ])
      expect(
        toListing({ ...base, entriesCloseAt }, now).deadlines.map((d) => d.kind)
      ).toEqual(["end"])
  })

  it("cleans the title and organizer", () => {
    const record: Competition = {
      ...byId("google-mumbai-data-challenge"),
      title: "  Data \n Challenge\u0000 ",
      organization: "  ",
    }
    const listing = toListing(record, now)
    expect(listing.title).toBe("Data Challenge")
    expect(listing.organizer).toBeNull()
  })
})
