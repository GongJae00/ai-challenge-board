import { describe, expect, it } from "vitest"

import { listingSchema } from "../../../lib/listing.ts"
import learningPage from "./fixtures/race-page-learning.json"
import page1 from "./fixtures/race-page-p1.json"
import { isListed, parseRacePage, toListing, type Race } from "./parse.ts"

// 532514 is open until 2026-11-16 23:59:59 China time, which is 2026-11-16T15:59:59Z.
const now = new Date("2026-10-21T09:00:00Z")
const races = parseRacePage(page1)
const ENTRANCE = "https://tianchi.aliyun.com/competition/entrance/532514"

function byId(id: number): Race {
  const found = races.find((r) => r.id === id)
  if (!found) throw new Error(`fixture has no race ${id}`)
  return found
}

/** A page whose one row is the first fixture row with some fields replaced. */
function pageWith(overrides: Record<string, unknown>) {
  const [row] = page1.data.list
  return { ...page1, data: { ...page1.data, list: [{ ...row, ...overrides }] } }
}

describe("parseRacePage", () => {
  it("reads every row on a page, with its times as UTC instants", () => {
    expect(races.map((r) => r.id)).toEqual([532514, 532480, 532511, 532512, 41])
    expect(byId(532514)).toMatchObject({
      name: "蚂蚁灵波具身大模型挑战赛",
      nameEn: null,
      referUrl: null,
      signupStartsAt: "2026-09-10T16:00:00.000Z",
      startsAt: "2026-09-10T16:00:00.000Z",
      signupEndsAt: "2026-10-26T15:59:59.000Z",
      endsAt: "2026-11-16T15:59:59.000Z",
      learning: false,
      series: false,
    })
  })

  it("reads China time at the start of a day and at the last second of one", () => {
    // 532511 has a race start (08-30) well before its sign-up start (10-09).
    expect(byId(532511)).toMatchObject({
      startsAt: "2026-08-29T16:00:00.000Z",
      signupStartsAt: "2026-10-08T16:00:00.000Z",
      endsAt: "2026-10-25T15:59:59.000Z",
    })
  })

  it("keeps a time of day that looks odd exactly as given", () => {
    expect(byId(532480).endsAt).toBe("2026-10-14T03:59:59.000Z")
  })

  it("reads an English name, and takes an empty one as none", () => {
    expect(byId(532480).nameEn).toBe("medCodeGPT Evaluation")
    expect(byId(41).nameEn).toBe("2026具身世界realworld挑战赛")
    expect(
      parseRacePage(pageWith({ nameEn: "" })).map((r) => r.nameEn)
    ).toEqual([null])
  })

  it("marks a series container and a learning row", () => {
    expect(byId(41).series).toBe(true)
    expect(byId(41).learning).toBe(false)
    const learning = parseRacePage(learningPage)
    expect(learning.find((r) => r.id === 231573)?.learning).toBe(true)
  })

  it("reads a row without sign-up times", () => {
    expect(byId(532480)).toMatchObject({
      signupStartsAt: null,
      signupEndsAt: null,
    })
  })

  it("reads an empty page as no rows", () => {
    expect(
      parseRacePage({ ...page1, data: { ...page1.data, list: [] } })
    ).toEqual([])
  })

  it.each([
    ["a response that is not an object", "<html></html>"],
    ["a response without data", { code: "SUCCESS", success: true }],
    ["a null data, as isActive=true returns", { success: true, data: null }],
    ["a failure", { code: "ERROR", success: false, data: page1.data }],
    ["a row without an id", pageWith({ raceId: undefined })],
    ["a row with an id that is not positive", pageWith({ raceId: 0 })],
    ["a row without an end time", pageWith({ raceEndTime: undefined })],
  ])("rejects %s, naming Tianchi", (_what, json) => {
    expect(() => parseRacePage(json)).toThrow(/Tianchi race list/)
  })

  it.each([
    "soon",
    "2026-11-16",
    "2026-02-30 23:59:59",
    "2026/11/16 23:59:59",
    "2026-11-16T15:59:59Z",
  ])("rejects a time it cannot read as China time, quoting it: %s", (text) => {
    for (const field of ["raceEndTime", "signupEndTime", "raceStartTime"])
      expect(() => parseRacePage(pageWith({ [field]: text }))).toThrow(
        `"${text}" is not a China date and time`
      )
  })
})

describe("isListed", () => {
  it("lists the open competitions, and not the ended one", () => {
    expect(races.filter((r) => isListed(r, now)).map((r) => r.id)).toEqual([
      532514, 532511,
    ])
  })

  it("does not list a learning competition, though it ends within two years", () => {
    const learning = parseRacePage(learningPage).find((r) => r.id === 231573)
    expect(learning?.endsAt).toBe("2027-05-06T15:59:59.000Z")
    expect(learning && isListed(learning, now)).toBe(false)
  })

  it("does not list a series container, though it ends ahead", () => {
    expect(Date.parse(byId(41).endsAt)).toBeGreaterThan(now.getTime())
    expect(isListed(byId(41), now)).toBe(false)
  })

  it("does not list a persistent competition whose end is more than two years ahead", () => {
    expect(byId(532512).endsAt).toBe("2029-10-03T15:59:59.000Z")
    expect(isListed(byId(532512), now)).toBe(false)
  })

  it("does not list a competition that ends at this moment", () => {
    const open = byId(532514)
    expect(isListed(open, new Date(open.endsAt))).toBe(false)
  })

  it("lists a competition that has not started", () => {
    expect(isListed(byId(532514), new Date("2026-08-01T00:00:00Z"))).toBe(true)
  })
})

describe("toListing", () => {
  const listing = toListing(byId(532514), now)

  it("fills the fields ACB shows, with China time as the zone, and fits the schema", () => {
    expect(listing).toEqual({
      id: "tianchi:532514",
      source: "tianchi",
      kind: "challenge",
      title: "蚂蚁灵波具身大模型挑战赛",
      organizer: null,
      conference: null,
      url: ENTRANCE,
      sourceUrl: ENTRANCE,
      opensAt: "2026-09-10T16:00:00.000Z",
      deadlines: [
        {
          kind: "entry",
          label: null,
          at: "2026-10-26T15:59:59.000Z",
          zone: "Asia/Shanghai",
        },
        {
          kind: "end",
          label: null,
          at: "2026-11-16T15:59:59.000Z",
          zone: "Asia/Shanghai",
        },
      ],
    })
    expect(listingSchema.safeParse(listing).success).toBe(true)
  })

  it("gives only the end when the entry closes in the same minute as the end", () => {
    const single = toListing(byId(532511), now)
    expect(single?.deadlines).toEqual([
      {
        kind: "end",
        label: null,
        at: "2026-10-25T15:59:59.000Z",
        zone: "Asia/Shanghai",
      },
    ])
    expect(single?.opensAt).toBe("2026-10-08T16:00:00.000Z")
  })

  it("leaves out an entry deadline that has passed", () => {
    const later = new Date("2026-10-27T00:00:00Z")
    expect(
      toListing(byId(532514), later)?.deadlines.map((d) => d.kind)
    ).toEqual(["end"])
  })

  it("opens at the race start when the row has no sign-up start, and at none without either", () => {
    const race = { ...byId(532514), signupStartsAt: null }
    expect(toListing(race, now)?.opensAt).toBe("2026-09-10T16:00:00.000Z")
    expect(toListing({ ...race, startsAt: null }, now)?.opensAt).toBeNull()
  })

  it("titles a competition by its English name when it has one", () => {
    const race = { ...byId(532514), nameEn: "Ant Lingbo Challenge" }
    expect(toListing(race, now)?.title).toBe("Ant Lingbo Challenge")
  })

  it("titles an ended row of the fixture by its English name", () => {
    const before = new Date("2026-10-01T00:00:00Z")
    expect(toListing(byId(532480), before)?.title).toBe("medCodeGPT Evaluation")
  })

  it("falls back to the Chinese name when the English name has no text", () => {
    const race = { ...byId(532514), nameEn: " \n " }
    expect(toListing(race, now)?.title).toBe("蚂蚁灵波具身大模型挑战赛")
  })

  it("returns null when the name has no text", () => {
    expect(toListing({ ...byId(532514), name: " " }, now)).toBeNull()
  })

  it("cuts a long title to the schema's limit", () => {
    const long = toListing({ ...byId(532514), name: "天".repeat(400) }, now)
    expect(long?.title).toHaveLength(300)
    expect(listingSchema.safeParse(long).success).toBe(true)
  })

  it("links to the address the row gives, and to the entrance page otherwise", () => {
    const given = toListing(
      { ...byId(532514), referUrl: "https://example.org/contest" },
      now
    )
    expect(given?.url).toBe("https://example.org/contest")
    expect(given?.sourceUrl).toBe(ENTRANCE)
    for (const referUrl of ["javascript:alert(1)", "not a link"]) {
      const odd = toListing({ ...byId(532514), referUrl }, now)
      expect(odd?.url).toBe(ENTRANCE)
    }
  })
})
