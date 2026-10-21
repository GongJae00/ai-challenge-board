import { describe, expect, it } from "vitest"

import type { Client } from "../../http.ts"
import page1 from "./fixtures/race-page-p1.json"
import learningPage from "./fixtures/race-page-learning.json"
import { tianchi } from "./index.ts"

const now = new Date("2026-10-21T09:00:00Z")
const LIST = "https://tianchi.aliyun.com/v3/proxy/competition/api/race/page"

type Row = (typeof page1.data.list)[number]
const [open, ended, single] = page1.data.list

const envelope = (list: Row[]) => ({
  ...page1,
  data: { ...page1.data, list },
})
const emptyPage = envelope([])

/** A copy of a fixture row with another id, ending at 23:59:59 China time on the given date. */
function row(base: Row, raceId: number, endsOn: string): Row {
  return { ...base, raceId, raceEndTime: `${endsOn} 23:59:59` }
}
/** A full page of ten rows that ended recently, with the given rows in front. */
function fullPage(first: Row[], firstId: number) {
  const filler = Array.from({ length: 10 - first.length }, (_, i) =>
    row(ended, firstId + i, "2026-09-30")
  )
  return envelope([...first, ...filler])
}

function fakeClient(pages: unknown[]) {
  const requested: string[] = []
  const client: Client = {
    postJson: async () => ({}),
    getText: async () => "",
    getJson: async (url) => {
      requested.push(url)
      const pageNum = Number(new URL(url).searchParams.get("pageNum"))
      return pages[pageNum - 1] ?? emptyPage
    },
  }
  return { client, requested }
}

const pageUrl = (pageNum: number) =>
  `${LIST}?visualTab=&raceName=&isActive=&pageNum=${pageNum}&pageSize=10`

describe("tianchi", () => {
  it("lists the open competitions on the page, and requests nothing else", async () => {
    const { client, requested } = fakeClient([page1])
    const listings = await tianchi.collect(client, now, { previous: null })
    expect(listings.map((l) => l.id)).toEqual([
      "tianchi:532514",
      "tianchi:532511",
    ])
    // The fixture page has five rows, so it is the last page, but the next one is asked for to be sure.
    expect(requested).toEqual([pageUrl(1), pageUrl(2)])
  })

  it("does not list learning competitions or series containers", async () => {
    const { client } = fakeClient([learningPage, page1])
    const listings = await tianchi.collect(client, now, { previous: null })
    expect(listings.map((l) => l.id)).toEqual([
      "tianchi:532514",
      "tianchi:532511",
    ])
  })

  it("goes on past a short page, since the list does not say where it ends", async () => {
    const { client, requested } = fakeClient([
      envelope([open]),
      envelope([single]),
    ])
    const listings = await tianchi.collect(client, now, { previous: null })
    expect(listings.map((l) => l.id)).toEqual([
      "tianchi:532514",
      "tianchi:532511",
    ])
    expect(requested).toEqual([pageUrl(1), pageUrl(2), pageUrl(3)])
  })

  it("stops at an empty page", async () => {
    const { client, requested } = fakeClient([fullPage([open], 800000)])
    await tianchi.collect(client, now, { previous: null })
    expect(requested).toEqual([pageUrl(1), pageUrl(2)])
  })

  it("lists a competition once when it moves onto the next page between requests", async () => {
    const { client } = fakeClient([fullPage([open], 800000), envelope([open])])
    const listings = await tianchi.collect(client, now, { previous: null })
    expect(listings.map((l) => l.id)).toEqual(["tianchi:532514"])
  })

  it("stops after a full page on which every competition ended more than 180 days ago", async () => {
    // 2026-04-20 is 184 days before now.
    const old = Array.from({ length: 10 }, (_, i) =>
      row(ended, 700000 + i, "2026-04-20")
    )
    const { client, requested } = fakeClient([
      fullPage([open], 800000),
      envelope(old),
      fullPage([row(open, 600000, "2026-12-31")], 500000),
    ])
    const listings = await tianchi.collect(client, now, { previous: null })
    expect(listings.map((l) => l.id)).toEqual(["tianchi:532514"])
    expect(requested).toEqual([pageUrl(1), pageUrl(2)])
  })

  it("goes on past a full page on which one competition ended within 180 days", async () => {
    // 2026-05-01 is 173 days before now.
    const mostlyOld = Array.from({ length: 10 }, (_, i) =>
      row(ended, 700000 + i, i === 7 ? "2026-05-01" : "2026-04-20")
    )
    const { client, requested } = fakeClient([envelope(mostlyOld)])
    await tianchi.collect(client, now, { previous: null })
    expect(requested).toHaveLength(2)
  })

  it("does not stop at a short page of old competitions", async () => {
    const old = [row(ended, 700000, "2026-04-20")]
    const { client, requested } = fakeClient([envelope(old), envelope([open])])
    const listings = await tianchi.collect(client, now, { previous: null })
    expect(listings.map((l) => l.id)).toEqual(["tianchi:532514"])
    expect(requested).toHaveLength(3)
  })

  it("fails when the list runs past 80 pages", async () => {
    const pages = Array.from({ length: 100 }, (_, i) =>
      fullPage([], 100000 + i * 100)
    )
    const { client, requested } = fakeClient(pages)
    await expect(
      tianchi.collect(client, now, { previous: null })
    ).rejects.toThrow(/Tianchi.*80 pages/)
    expect(requested).toHaveLength(80)
  })

  it("fails on a list response that does not fit, naming Tianchi", async () => {
    const { client } = fakeClient([{ success: true, data: null }])
    await expect(
      tianchi.collect(client, now, { previous: null })
    ).rejects.toThrow(/Tianchi race list/)
  })

  it("fails on a time it cannot read, so that the last data is kept", async () => {
    const bad = { ...open, raceEndTime: "2026-13-45 99:99:99" }
    const { client } = fakeClient([envelope([bad])])
    await expect(
      tianchi.collect(client, now, { previous: null })
    ).rejects.toThrow(/"2026-13-45 99:99:99" is not a China date and time/)
  })
})
