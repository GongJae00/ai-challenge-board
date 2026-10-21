import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import type { Client } from "../../http.ts"
import emptyPage from "./fixtures/list-empty-page.json"
import page0 from "./fixtures/list-page0.json"
import { dacon } from "./index.ts"

const now = new Date("2026-10-21T09:00:00Z")
const LIST = "https://app.dacon.io/api/v1/competition/list"
const DETAIL = "https://dacon.io/competitions/official"

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")
}
const ongoing = fixture("detail-ongoing-236771.html")
const closed = fixture("detail-closed-236736.html")

type Raw = (typeof page0.data)[number]
const [open, ...ended] = page0.data

/** A copy of a fixture record with another id, ending at 10:00 KST on the given date. */
function record(base: Raw, id: number, endsOn: string): Raw {
  return {
    ...base,
    cpt_id: id,
    period_start: "2026-01-01 10:00:00",
    period_end: `${endsOn} 10:00:00`,
  }
}
const envelope = (data: Raw[]) => ({ message: "ok", status: 1, data })
/** A full page of competitions that ended recently, with the given records in front. */
function fullPage(first: Raw[], firstId: number) {
  const filler = Array.from({ length: 15 - first.length }, (_, i) =>
    record(ended[0], firstId + i, "2026-09-30")
  )
  return envelope([...first, ...filler])
}

function fakeClient(pages: unknown[], detail = ongoing) {
  const requested: string[] = []
  const client: Client = {
    postJson: async () => ({}),
    getJson: async (url) => {
      requested.push(url)
      const offset = Number(new URL(url).searchParams.get("offset"))
      return pages[offset] ?? emptyPage
    },
    getText: async (url) => {
      requested.push(url)
      return url.includes("/236736/") ? closed : detail
    },
  }
  return { client, requested }
}

const listRequests = (requested: string[]) =>
  requested.filter((url) => url.startsWith(LIST))

describe("dacon", () => {
  it("lists the open competition with its organizer from the detail page", async () => {
    const { client, requested } = fakeClient([page0])
    const listings = await dacon.collect(client, now, { previous: null })
    expect(listings.map((l) => [l.id, l.organizer])).toEqual([
      ["dacon:236771", "해양수산부"],
    ])
    expect(requested).toEqual([
      `${LIST}?offset=0&range=`,
      `${DETAIL}/236771/overview/description`,
    ])
  })

  it("stops at a page shorter than 15, and requests a detail page only for each open competition", async () => {
    const second = envelope([
      record(open, 900001, "2026-12-31"),
      record(ended[0], 900002, "2026-09-01"),
    ])
    const { client, requested } = fakeClient([fullPage([open], 800000), second])
    const listings = await dacon.collect(client, now, { previous: null })
    expect(listings.map((l) => l.id)).toEqual(["dacon:236771", "dacon:900001"])
    expect(requested).toEqual([
      `${LIST}?offset=0&range=`,
      `${LIST}?offset=1&range=`,
      `${DETAIL}/236771/overview/description`,
      `${DETAIL}/900001/overview/description`,
    ])
  })

  it("stops at an empty page", async () => {
    const { client, requested } = fakeClient([fullPage([open], 800000)])
    await dacon.collect(client, now, { previous: null })
    expect(listRequests(requested)).toEqual([
      `${LIST}?offset=0&range=`,
      `${LIST}?offset=1&range=`,
    ])
  })

  it("stops after a full page on which every competition ended more than 180 days ago", async () => {
    // 2026-04-20 is 184 days before now. The list is out of order by about three months, not six.
    const old = Array.from({ length: 15 }, (_, i) =>
      record(ended[0], 700000 + i, "2026-04-20")
    )
    const { client, requested } = fakeClient([
      fullPage([open], 800000),
      envelope(old),
      fullPage([record(open, 600000, "2026-12-31")], 500000),
    ])
    const listings = await dacon.collect(client, now, { previous: null })
    expect(listings.map((l) => l.id)).toEqual(["dacon:236771"])
    expect(listRequests(requested)).toEqual([
      `${LIST}?offset=0&range=`,
      `${LIST}?offset=1&range=`,
    ])
  })

  it("goes on past a full page on which one competition ended within 180 days", async () => {
    // 2026-05-01 is 173 days before now.
    const mostlyOld = Array.from({ length: 15 }, (_, i) =>
      record(ended[0], 700000 + i, i === 7 ? "2026-05-01" : "2026-04-20")
    )
    const { client, requested } = fakeClient([envelope(mostlyOld)])
    await dacon.collect(client, now, { previous: null })
    expect(listRequests(requested)).toHaveLength(2)
  })

  it("requests no detail page when nothing is open", async () => {
    const { client, requested } = fakeClient([envelope(ended)])
    expect(await dacon.collect(client, now, { previous: null })).toEqual([])
    expect(requested).toEqual([`${LIST}?offset=0&range=`])
  })

  it("leaves the organizer empty when the detail page names none", async () => {
    const { client } = fakeClient([page0], "<p>안내</p>")
    const [listing] = await dacon.collect(client, now, { previous: null })
    expect(listing.organizer).toBeNull()
  })

  it("fails when the list runs past 30 pages", async () => {
    const pages = Array.from({ length: 40 }, (_, i) =>
      fullPage([], 100000 + i * 100)
    )
    const { client, requested } = fakeClient(pages)
    await expect(
      dacon.collect(client, now, { previous: null })
    ).rejects.toThrow(/DACON.*30 pages/)
    expect(requested).toHaveLength(30)
  })

  it("fails on a list response that does not fit, naming DACON", async () => {
    const { client } = fakeClient([{ message: "ok", status: 1 }])
    await expect(
      dacon.collect(client, now, { previous: null })
    ).rejects.toThrow(/DACON list/)
  })

  it("fails when a detail request fails, so that the last data is kept", async () => {
    const { client } = fakeClient([page0])
    client.getText = async (url) => {
      throw new Error(`Request to ${url} failed`)
    }
    await expect(
      dacon.collect(client, now, { previous: null })
    ).rejects.toThrow(/236771/)
  })
})
