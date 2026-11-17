import { describe, expect, it } from "vitest"

import type { AgendaItem } from "./agenda.ts"
import type { Listing } from "./listing.ts"
import { formatSort, nextSort, parseSort, sortItems } from "./sort.ts"

function item(
  title: string,
  at: string,
  extra: Partial<Listing> = {}
): AgendaItem {
  const deadline = { kind: "submission" as const, label: null, at, zone: "UTC" }
  return {
    listing: {
      id: `evalai:${title}`,
      source: "evalai",
      kind: "challenge",
      title,
      organizer: null,
      conference: null,
      url: "https://example.org/",
      sourceUrl: "https://example.org/",
      opensAt: null,
      deadlines: [deadline],
      ...extra,
    },
    deadline,
  }
}

const zone = "Asia/Seoul"
const titles = (items: AgendaItem[]) => items.map((i) => i.listing.title)

describe("parseSort and formatSort", () => {
  it("reads a column, with a leading minus for descending", () => {
    expect(parseSort("title")).toEqual({ column: "title", descending: false })
    expect(parseSort("-title")).toEqual({ column: "title", descending: true })
  })

  it("falls back to the nearest deadline for anything else", () => {
    const fallback = { column: "deadline", descending: false }
    expect(parseSort("")).toEqual(fallback)
    expect(parseSort("-bogus")).toEqual(fallback)
  })

  it("writes back what it reads", () => {
    expect(formatSort(parseSort("-host"))).toBe("-host")
    expect(formatSort(parseSort("kind"))).toBe("kind")
  })
})

describe("nextSort", () => {
  it("starts a new column ascending", () => {
    expect(nextSort({ column: "deadline", descending: true }, "title")).toEqual(
      { column: "title", descending: false }
    )
  })

  it("flips the direction of the column already sorted", () => {
    expect(nextSort({ column: "title", descending: false }, "title")).toEqual({
      column: "title",
      descending: true,
    })
    expect(nextSort({ column: "title", descending: true }, "title")).toEqual({
      column: "title",
      descending: false,
    })
  })
})

describe("sortItems", () => {
  const a = item("a", "2026-12-01T00:00:00Z", {
    opensAt: "2026-11-01T00:00:00Z",
  })
  const b = item("b", "2026-11-20T00:00:00Z", {
    opensAt: "2026-10-01T00:00:00Z",
  })
  const c = item("c", "2026-11-25T00:00:00Z")

  it("orders by deadline both ways", () => {
    expect(
      titles(
        sortItems(
          [a, b, c],
          { column: "deadline", descending: false },
          "en",
          zone
        )
      )
    ).toEqual(["b", "c", "a"])
    expect(
      titles(
        sortItems(
          [a, b, c],
          { column: "deadline", descending: true },
          "en",
          zone
        )
      )
    ).toEqual(["a", "c", "b"])
  })

  it("keeps listings with no start date last in either direction", () => {
    expect(
      titles(
        sortItems([c, a, b], { column: "start", descending: false }, "en", zone)
      )
    ).toEqual(["b", "a", "c"])
    expect(
      titles(
        sortItems([c, a, b], { column: "start", descending: true }, "en", zone)
      )
    ).toEqual(["a", "b", "c"])
  })

  it("treats starts on the same displayed day as equal, so the nearest deadline comes first", () => {
    // Both start on 2026-10-16 in Seoul, one at 01:00 and one at 23:00, but the earlier start has the later deadline.
    const morning = item("morning", "2026-12-20T00:00:00Z", {
      opensAt: "2026-10-15T16:00:00Z",
    })
    const night = item("night", "2026-11-10T00:00:00Z", {
      opensAt: "2026-10-16T14:00:00Z",
    })
    const start = { column: "start", descending: false } as const
    expect(titles(sortItems([morning, night], start, "en", zone))).toEqual([
      "night",
      "morning",
    ])
    expect(
      titles(
        sortItems([morning, night], { ...start, descending: true }, "en", zone)
      )
    ).toEqual(["night", "morning"])
  })

  it("orders types as the type chips do, in either language", () => {
    const cfp = item("a", "2026-12-01T00:00:00Z", { kind: "cfp" })
    const challenge = item("b", "2026-12-02T00:00:00Z")
    const kind = { column: "kind", descending: false } as const
    for (const locale of ["ko", "en"] as const)
      expect(titles(sortItems([cfp, challenge], kind, locale, zone))).toEqual([
        "b",
        "a",
      ])
  })

  it("orders the numbers in titles by value", () => {
    const items = ["Track 10", "Track 2"].map((title) =>
      item(title, "2026-12-01T00:00:00Z")
    )
    expect(
      titles(
        sortItems(items, { column: "title", descending: false }, "en", zone)
      )
    ).toEqual(["Track 2", "Track 10"])
  })

  it("orders titles by the locale's collation", () => {
    const items = [
      item("나", "2026-12-01T00:00:00Z"),
      item("가", "2026-12-01T00:00:00Z"),
    ]
    expect(
      titles(
        sortItems(items, { column: "title", descending: false }, "ko", zone)
      )
    ).toEqual(["가", "나"])
  })

  it("sorts hosts by organizer, else conference, else platform, with no host last", () => {
    const org = item("org", "2026-12-01T00:00:00Z", { organizer: "Zeta" })
    const conf = item("conf", "2026-12-01T00:00:00Z", {
      conference: { name: "ICML", year: 2027 },
    })
    const platform = item("platform", "2026-12-01T00:00:00Z")
    const bare = item("bare", "2026-12-01T00:00:00Z", { source: "openreview" })
    const all = [bare, org, conf, platform]
    const asc = { column: "host", descending: false } as const
    expect(titles(sortItems(all, asc, "en", zone))).toEqual([
      "platform",
      "conf",
      "org",
      "bare",
    ])
    expect(
      titles(sortItems(all, { ...asc, descending: true }, "en", zone))
    ).toEqual(["org", "conf", "platform", "bare"])
  })

  it("breaks ties by nearest deadline, whichever way the column goes", () => {
    const early = item("same", "2026-11-20T00:00:00Z", { organizer: "X" })
    const late = item("same", "2026-12-20T00:00:00Z", { organizer: "X" })
    expect(
      sortItems(
        [late, early],
        { column: "title", descending: true },
        "en",
        zone
      )
    ).toEqual([early, late])
  })

  it("does not change the list it is given", () => {
    const items = [a, b]
    sortItems(items, { column: "deadline", descending: false }, "en", zone)
    expect(items).toEqual([a, b])
  })
})
