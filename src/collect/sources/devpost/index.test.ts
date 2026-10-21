import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import type { Client } from "../../http.ts"
import type { SourceState } from "../../run.ts"
import lastPage from "./fixtures/list-open-ml-last-page.json"
import page1 from "./fixtures/list-open-ml-page1.json"
import upcomingPage1 from "./fixtures/list-upcoming-ml-page1.json"
import { devpost, REFRESH_AFTER_MS } from "./index.ts"

const now = new Date("2026-10-21T14:00:00Z")
const LIST =
  "https://devpost.com/api/hackathons?status[]=open&status[]=upcoming&themes[]=Machine%20Learning/AI&page="

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")
}
const amazonIcs = fixture("calendar-open-amazon.ics")
const kiroweenIcs = fixture("calendar-upcoming-kiroween.ics")

type Raw =
  | (typeof page1.hackathons)[number]
  | (typeof lastPage.hackathons)[number]
  | (typeof upcomingPage1.hackathons)[number]

// Three fixture pages hold ten hackathons, one of them invite-only: the open ones, the rest of them, and the
// upcoming ones. A page's meta says how many there are in all.
const fixturePages = [
  page1.hackathons,
  lastPage.hackathons,
  upcomingPage1.hackathons,
]
const TOTAL = fixturePages.flat().length
const INVITE_ONLY_ID = 31626
const AMAZON_ID = 30992
const GITLAB_ID = 31503
const KIROWEEN_ID = 31667

const envelope = (hackathons: Raw[], total = TOTAL) => ({
  hackathons,
  meta: { total_count: total, per_page: 9, fuzzy: false },
})

/**
 * The calendar the fake host serves. Only Amazon's and Kiroween's calendars were fetched, so the others borrow
 * Amazon's, which has the time zone and the shape of an online hackathon, with its deadline moved to another day.
 */
function calendarFor(host: string, deadline = "20261105"): string {
  if (host === "amazonappdev2026.devpost.com") return amazonIcs
  if (host === "kiroween.devpost.com") return kiroweenIcs
  return amazonIcs.replaceAll("20261023", deadline)
}

interface Fake {
  pages?: Raw[][]
  total?: number
  /** Overrides what a host serves: its calendar text, or an error to fail with. */
  calendars?: Record<string, string | Error>
}

function fakeClient({
  pages = fixturePages,
  total = TOTAL,
  calendars = {},
}: Fake = {}) {
  const requested: string[] = []
  const client: Client = {
    postJson: async () => ({}),
    getJson: async (url) => {
      requested.push(url)
      const page = Number(/page=(\d+)$/.exec(url)?.[1])
      return envelope((pages[page - 1] as Raw[] | undefined) ?? [], total)
    },
    getText: async (url) => {
      requested.push(url)
      const host = new URL(url).hostname
      const served = calendars[host] ?? calendarFor(host)
      if (served instanceof Error) throw served
      return served
    },
  }
  return { client, requested }
}

/** What the source saved for a hackathon. */
const savedEntry = (state: SourceState, id: number) =>
  (state.next as { id: number; checkedAt: string; deadline: unknown }[]).find(
    (entry) => entry.id === id
  )

const listRequests = (requested: string[]) =>
  requested.filter((url) => url.startsWith(LIST))
const calendarRequests = (requested: string[]) =>
  requested.filter((url) => url.endsWith("/calendar"))

describe("devpost", () => {
  it("lists the hackathons of every page with their deadlines, without the invite-only one", async () => {
    const { client } = fakeClient()
    const listings = await devpost.collect(client, now, { previous: null })
    expect(listings.map((l) => l.id).sort()).toEqual(
      [
        "devpost:29135",
        "devpost:30731",
        "devpost:30790",
        "devpost:30992",
        "devpost:31503",
        "devpost:31667",
        "devpost:31735",
        "devpost:31737",
        "devpost:31821",
      ].sort()
    )
    const amazon = listings.find((l) => l.id === `devpost:${AMAZON_ID}`)
    expect(amazon?.deadlines).toEqual([
      {
        kind: "submission",
        label: null,
        at: "2026-10-23T19:00:00.000Z",
        zone: "America/Los_Angeles",
      },
    ])
    expect(amazon?.organizer).toBe("Amazon")
  })

  it("asks for the open and upcoming hackathons with the AI theme, page by page, with the brackets and the slash as written", async () => {
    const { client, requested } = fakeClient()
    await devpost.collect(client, now, { previous: null })
    expect(listRequests(requested)).toEqual([
      `${LIST}1`,
      `${LIST}2`,
      `${LIST}3`,
    ])
  })

  it("stops once the pages have held the total, without asking for another", async () => {
    const { client, requested } = fakeClient()
    await devpost.collect(client, now, { previous: null })
    expect(listRequests(requested)).not.toContain(`${LIST}4`)
  })

  it("stops at an empty page when the total is never reached", async () => {
    const { client, requested } = fakeClient({ total: 100 })
    const listings = await devpost.collect(client, now, { previous: null })
    expect(listRequests(requested)).toEqual([
      `${LIST}1`,
      `${LIST}2`,
      `${LIST}3`,
      `${LIST}4`,
    ])
    expect(listings).toHaveLength(9)
  })

  it("lists a hackathon once when it shifts onto the next page between two requests", async () => {
    const { client, requested } = fakeClient({
      pages: [page1.hackathons, page1.hackathons, lastPage.hackathons],
      total: 100,
    })
    const listings = await devpost.collect(client, now, { previous: null })
    expect(
      listings.map((l) => l.id).filter((id) => id === "devpost:30992")
    ).toHaveLength(1)
    expect(calendarRequests(requested)).toHaveLength(listings.length)
  })

  it("throws at 30 pages", async () => {
    const { client, requested } = fakeClient({
      pages: Array.from({ length: 40 }, () => page1.hackathons),
      total: 1_000_000,
    })
    await expect(
      devpost.collect(client, now, { previous: null })
    ).rejects.toThrow(/more than 30 pages/)
    expect(listRequests(requested)).toHaveLength(30)
  })

  it("requests the calendar on each hackathon's own host, and none for the invite-only one", async () => {
    const { client, requested } = fakeClient()
    await devpost.collect(client, now, { previous: null })
    const calendars = calendarRequests(requested)
    expect(calendars).toHaveLength(9)
    expect(calendars).toContain("https://amazonappdev2026.devpost.com/calendar")
    expect(calendars).toContain("https://kiroween.devpost.com/calendar")
    expect(
      calendars.some((url) => url.includes("hackathon-agentico-2026b"))
    ).toBe(false)
  })

  it("remembers each hackathon's dates and deadline, the ones with a deadline behind them too", async () => {
    const { client } = fakeClient({
      calendars: {
        "gitlab-transcend.devpost.com": calendarFor("x", "20261020"),
      },
    })
    const state: SourceState = { previous: null }
    const listings = await devpost.collect(client, now, state)
    expect(listings.some((l) => l.id === `devpost:${GITLAB_ID}`)).toBe(false)
    const saved = state.next as {
      id: number
      dates: string
      checkedAt: string
      deadline: unknown
    }[]
    expect(saved).toHaveLength(9)
    expect(saved.map((e) => e.id)).toEqual(
      [...saved.map((e) => e.id)].sort((a, b) => a - b)
    )
    expect(saved.find((e) => e.id === AMAZON_ID)).toEqual({
      id: AMAZON_ID,
      dates: "Aug 31 - Oct 23, 2026",
      checkedAt: "2026-10-21T14:00:00.000Z",
      deadline: {
        kind: "submission",
        label: null,
        at: "2026-10-23T19:00:00.000Z",
        zone: "America/Los_Angeles",
      },
    })
    expect(saved.some((e) => e.id === GITLAB_ID)).toBe(true)
    expect(saved.some((e) => e.id === INVITE_ONLY_ID)).toBe(false)
  })

  it("requests no calendar for a hackathon whose dates are unchanged, and lists it from the saved deadline", async () => {
    const first = fakeClient()
    const state: SourceState = { previous: null }
    const firstListings = await devpost.collect(first.client, now, state)

    const second = fakeClient()
    const again = await devpost.collect(second.client, now, {
      previous: state.next,
    })
    expect(calendarRequests(second.requested)).toEqual([])
    expect(listRequests(second.requested)).toHaveLength(3)
    expect(again).toEqual(firstListings)
  })

  it("requests the calendar again only for a hackathon whose dates changed", async () => {
    const first = fakeClient()
    const state: SourceState = { previous: null }
    await devpost.collect(first.client, now, state)

    const changed = structuredClone(fixturePages)
    changed[0][0].submission_period_dates = "Aug 31 - Oct 30, 2026"
    const second = fakeClient({
      pages: changed,
      calendars: {
        "amazonappdev2026.devpost.com": amazonIcs.replaceAll(
          "20261023",
          "20261030"
        ),
      },
    })
    const listings = await devpost.collect(second.client, now, {
      previous: state.next,
    })
    expect(calendarRequests(second.requested)).toEqual([
      "https://amazonappdev2026.devpost.com/calendar",
    ])
    const amazon = listings.find((l) => l.id === `devpost:${AMAZON_ID}`)
    expect(amazon?.deadlines[0].at).toBe("2026-10-30T19:00:00.000Z")
  })

  it("keeps the time zone of a saved deadline for the opening date", async () => {
    const first = fakeClient()
    const state: SourceState = { previous: null }
    await devpost.collect(first.client, now, state)
    const second = fakeClient()
    const listings = await devpost.collect(second.client, now, {
      previous: state.next,
    })
    // Aug 31 at 00:00 in Los Angeles, from the saved zone, without the calendar.
    expect(listings.find((l) => l.id === "devpost:30992")?.opensAt).toBe(
      "2026-08-31T07:00:00.000Z"
    )
  })

  it("drops a hackathon that is no longer listed from what it remembers", async () => {
    const first = fakeClient()
    const state: SourceState = { previous: null }
    await devpost.collect(first.client, now, state)

    const second = fakeClient({ pages: [page1.hackathons], total: 3 })
    const next: SourceState = { previous: state.next }
    const listings = await devpost.collect(second.client, now, next)
    expect(listings).toHaveLength(3)
    expect((next.next as { id: number }[]).map((e) => e.id).sort()).toEqual([
      30790, 30992, 31503,
    ])
  })

  it("does not list a hackathon from its saved deadline once the deadline has passed", async () => {
    const first = fakeClient()
    const state: SourceState = { previous: null }
    await devpost.collect(first.client, now, state)
    const second = fakeClient()
    const later = new Date("2026-10-23T19:00:00Z")
    const listings = await devpost.collect(second.client, later, {
      previous: state.next,
    })
    expect(listings.some((l) => l.id === `devpost:${AMAZON_ID}`)).toBe(false)
    expect(calendarRequests(second.requested)).toEqual([])
  })

  it("rejects a saved state that does not fit", async () => {
    const { client } = fakeClient()
    await expect(
      devpost.collect(client, now, { previous: { id: 1 } })
    ).rejects.toThrow()
    await expect(
      devpost.collect(client, now, {
        previous: [{ id: 1, dates: "x", deadline: { kind: "submission" } }],
      })
    ).rejects.toThrow()
  })

  it("fails when a calendar request fails", async () => {
    const { client } = fakeClient({
      calendars: {
        "kiroween.devpost.com": new Error("Status 500 from kiroween"),
      },
    })
    await expect(
      devpost.collect(client, now, { previous: null })
    ).rejects.toThrow(/Status 500/)
  })

  it("leaves out a hackathon whose calendar has no event and lists the others", async () => {
    const { client } = fakeClient({
      calendars: {
        "kiroween.devpost.com": "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n",
      },
    })
    const state: SourceState = { previous: null }
    const listings = await devpost.collect(client, now, state)
    expect(listings).toHaveLength(8)
    expect(listings.some((l) => l.id === `devpost:${KIROWEEN_ID}`)).toBe(false)
    expect(savedEntry(state, KIROWEEN_ID)?.deadline).toBeNull()
  })

  it("leaves out a hackathon whose calendar's time zone is not an IANA zone", async () => {
    const { client } = fakeClient({
      calendars: {
        "kiroween.devpost.com": kiroweenIcs.replaceAll(
          "America/Los_Angeles",
          "Not/AZone"
        ),
      },
    })
    const listings = await devpost.collect(client, now, { previous: null })
    expect(listings).toHaveLength(8)
    expect(listings.some((l) => l.id === `devpost:${KIROWEEN_ID}`)).toBe(false)
  })

  it("leaves out a hackathon whose calendar gives an all-day time", async () => {
    const { client } = fakeClient({
      calendars: {
        "kiroween.devpost.com": kiroweenIcs.replace(
          "DTSTART;TZID=America/Los_Angeles:20261204T140000",
          "DTSTART;VALUE=DATE:20261204"
        ),
      },
    })
    const listings = await devpost.collect(client, now, { previous: null })
    expect(listings.some((l) => l.id === `devpost:${KIROWEEN_ID}`)).toBe(false)
  })

  it("lists a hackathon whose calendar gives a UTC time, in zone UTC", async () => {
    const { client } = fakeClient({
      calendars: {
        "kiroween.devpost.com": kiroweenIcs.replace(
          "DTSTART;TZID=America/Los_Angeles:20261204T140000",
          "DTSTART:20261204T220000Z"
        ),
      },
    })
    const listings = await devpost.collect(client, now, { previous: null })
    expect(
      listings.find((l) => l.id === `devpost:${KIROWEEN_ID}`)?.deadlines
    ).toEqual([
      {
        kind: "submission",
        label: null,
        at: "2026-12-04T22:00:00.000Z",
        zone: "UTC",
      },
    ])
  })

  it("remembers a calendar that gave no deadline, and does not request it again", async () => {
    const empty = "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n"
    const first = fakeClient({ calendars: { "kiroween.devpost.com": empty } })
    const state: SourceState = { previous: null }
    await devpost.collect(first.client, now, state)

    const second = fakeClient({ calendars: { "kiroween.devpost.com": empty } })
    const next: SourceState = { previous: state.next }
    const listings = await devpost.collect(second.client, now, next)
    expect(calendarRequests(second.requested)).toEqual([])
    expect(listings.some((l) => l.id === `devpost:${KIROWEEN_ID}`)).toBe(false)
    expect(savedEntry(next, KIROWEEN_ID)?.deadline).toBeNull()
  })

  it("reads the calendars again once the saved reading is older than the refresh age", async () => {
    const first = fakeClient()
    const state: SourceState = { previous: null }
    await devpost.collect(first.client, now, state)

    // The deadline moves while the list's dates string stays the same.
    const second = fakeClient({
      calendars: {
        "amazonappdev2026.devpost.com": amazonIcs.replace(
          "20261023T120000",
          "20261030T180000"
        ),
      },
    })
    const later = new Date(now.getTime() + REFRESH_AFTER_MS + 1000)
    const next: SourceState = { previous: state.next }
    const listings = await devpost.collect(second.client, later, next)
    expect(calendarRequests(second.requested)).toHaveLength(9)
    expect(
      listings.find((l) => l.id === `devpost:${AMAZON_ID}`)?.deadlines[0].at
    ).toBe("2026-10-31T01:00:00.000Z")
    expect(savedEntry(next, AMAZON_ID)?.checkedAt).toBe(later.toISOString())
  })

  it("does not read the calendars again before the refresh age", async () => {
    const first = fakeClient()
    const state: SourceState = { previous: null }
    await devpost.collect(first.client, now, state)
    const second = fakeClient()
    const almost = new Date(now.getTime() + REFRESH_AFTER_MS)
    await devpost.collect(second.client, almost, { previous: state.next })
    expect(calendarRequests(second.requested)).toEqual([])
  })

  it("reads the calendar of a saved entry that has no reading time", async () => {
    const first = fakeClient()
    const state: SourceState = { previous: null }
    await devpost.collect(first.client, now, state)
    const stale = (state.next as { id: number }[]).map((entry) => ({
      id: entry.id,
      dates: (entry as unknown as { dates: string }).dates,
      deadline: (entry as unknown as { deadline: unknown }).deadline,
    }))

    const second = fakeClient()
    await devpost.collect(second.client, now, { previous: stale })
    expect(calendarRequests(second.requested)).toHaveLength(9)
  })

  it("fails when a list page does not fit", async () => {
    const client: Client = {
      postJson: async () => ({}),
      getText: async () => "",
      getJson: async () => ({ items: [] }),
    }
    await expect(
      devpost.collect(client, now, { previous: null })
    ).rejects.toThrow(/Devpost list/)
  })
})

describe("staleIds", () => {
  it("picks the oldest entries past the refresh age, at most the limit, entries without a check first", async () => {
    const { staleIds } = await import("./index.ts")
    const at = (days: number) =>
      new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
    const entry = (id: number, checkedAt?: string) => ({
      id,
      dates: "Oct 01 - 31, 2026",
      checkedAt,
      deadline: null,
    })
    const cached = new Map(
      [
        entry(1, at(1)),
        entry(2, at(5)),
        entry(3, at(9)),
        entry(4),
        entry(5, at(4)),
      ].map((e) => [e.id, e])
    )
    expect(staleIds([1, 2, 3, 4, 5, 6], cached, now, 3)).toEqual(
      new Set([4, 3, 2])
    )
  })
})
