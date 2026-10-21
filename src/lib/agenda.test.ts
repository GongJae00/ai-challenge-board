import { describe, expect, it } from "vitest"

import {
  addMonths,
  byDate,
  daysLeft,
  monthWeeks,
  nextDeadline,
  upcoming,
  upcomingDeadlines,
} from "./agenda.ts"
import type { Deadline, Listing } from "./listing.ts"

function deadline(at: string, kind: Deadline["kind"] = "phase"): Deadline {
  return { kind, label: null, at, zone: "UTC" }
}

function listing(title: string, ...deadlines: Deadline[]): Listing {
  return {
    id: `evalai:${title}`,
    source: "evalai",
    kind: "challenge",
    title,
    organizer: null,
    conference: null,
    url: "https://example.org/",
    sourceUrl: "https://example.org/",
    opensAt: null,
    deadlines,
  }
}

const now = new Date("2026-10-21T06:00:00Z")

describe("nextDeadline", () => {
  it("picks the earliest deadline still ahead, whatever the stored order", () => {
    const l = listing(
      "a",
      deadline("2027-03-01T00:00:00Z"),
      deadline("2026-10-01T00:00:00Z"),
      deadline("2026-12-15T00:00:00Z")
    )
    expect(nextDeadline(l, now)?.at).toBe("2026-12-15T00:00:00Z")
  })

  it("is null when every deadline has passed", () => {
    expect(
      nextDeadline(listing("a", deadline("2026-10-01T00:00:00Z")), now)
    ).toBeNull()
  })
})

describe("upcoming", () => {
  it("drops passed listings and orders the rest by deadline, then title", () => {
    const items = upcoming(
      [
        listing("late", deadline("2026-12-01T00:00:00Z")),
        listing("passed", deadline("2026-10-01T00:00:00Z")),
        listing("b", deadline("2026-11-01T00:00:00Z")),
        listing("a", deadline("2026-11-01T00:00:00Z")),
      ],
      now
    )
    expect(items.map((i) => i.listing.title)).toEqual(["a", "b", "late"])
  })
})

describe("upcomingDeadlines", () => {
  it("lists every deadline ahead, so a challenge appears once per phase", () => {
    const items = upcomingDeadlines(
      [
        listing(
          "a",
          deadline("2026-10-01T00:00:00Z"),
          deadline("2026-12-01T00:00:00Z"),
          deadline("2026-11-01T00:00:00Z")
        ),
        listing("b", deadline("2026-11-15T00:00:00Z")),
      ],
      now
    )
    expect(items.map((i) => [i.listing.title, i.deadline.at])).toEqual([
      ["a", "2026-11-01T00:00:00Z"],
      ["b", "2026-11-15T00:00:00Z"],
      ["a", "2026-12-01T00:00:00Z"],
    ])
  })
})

describe("byDate", () => {
  it("files deadlines under their date in the viewer's time zone", () => {
    // 2026-11-30 20:00 UTC is already 1 December in Seoul.
    const items = upcoming(
      [
        listing("a", deadline("2026-11-30T20:00:00Z")),
        listing("b", deadline("2026-12-01T02:00:00Z")),
      ],
      now
    )
    expect([...byDate(items, "UTC").keys()]).toEqual([
      "2026-11-30",
      "2026-12-01",
    ])
    expect(
      [...byDate(items, "Asia/Seoul")].map(([date, list]) => [
        date,
        list.length,
      ])
    ).toEqual([["2026-12-01", 2]])
  })
})

describe("daysLeft", () => {
  it("counts calendar days in the viewer's time zone", () => {
    expect(daysLeft("2026-10-21T23:00:00Z", now, "UTC")).toBe(0)
    // 23:00 UTC is 08:00 the next day in Seoul.
    expect(daysLeft("2026-10-21T23:00:00Z", now, "Asia/Seoul")).toBe(1)
    expect(daysLeft("2026-11-21T11:59:00Z", now, "UTC")).toBe(31)
  })
})

describe("addMonths", () => {
  it("moves across year ends", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01")
    expect(addMonths("2027-01", -1)).toBe("2026-12")
  })
})

describe("monthWeeks", () => {
  it("lays a month out in Sunday-first weeks", () => {
    // November 2026 starts on a Sunday and has 30 days.
    const weeks = monthWeeks("2026-11")
    expect(weeks).toHaveLength(5)
    expect(weeks[0][0]).toBe("2026-11-01")
    expect(weeks[4]).toEqual([
      "2026-11-29",
      "2026-11-30",
      null,
      null,
      null,
      null,
      null,
    ])
  })

  it("pads the first week with the days of the month before", () => {
    // October 2026 starts on a Thursday.
    expect(monthWeeks("2026-10")[0]).toEqual([
      null,
      null,
      null,
      null,
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
    ])
  })
})
