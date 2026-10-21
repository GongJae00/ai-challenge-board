import { describe, expect, it } from "vitest"

import { listingSchema } from "../../../lib/listing.ts"
import page1 from "./fixtures/list-page1.json"
import page50 from "./fixtures/list-page-offset50.json"
import overviewOpen from "./fixtures/overview-open.json"
import overviewPractice from "./fixtures/overview-practice.json"
import overviewPreOpen from "./fixtures/overview-pre-open.json"
import {
  isListed,
  isOpen,
  parseListPage,
  parseOverview,
  toListing,
  type Entry,
} from "./parse.ts"

// The open competition ends at 23:59 JST on 2026-12-18, which is 14:59 UTC.
const now = new Date("2026-10-21T12:00:00Z")
const OPEN_END = "2026-12-18T14:59:00.000Z"
const { total, entries } = parseListPage(page1)

function byTitle(start: string): Entry {
  const found = entries.find((e) => e.title.startsWith(start))
  if (!found) throw new Error(`fixture has no entry starting ${start}`)
  return found
}
const open = byTitle("第５回")

describe("parseListPage", () => {
  it("reads every entry with its key, title, organizer, and status, and the total", () => {
    expect(total).toBe(219)
    expect(entries.map((e) => e.status)).toEqual([
      "pre_open",
      "open",
      "ongoing",
      "ongoing",
      "closed",
      "closed",
    ])
    expect(open).toEqual({
      publicKey: "42024ceef5064aa6a7f463aac3f26fc2",
      title: "第５回 空戦AIチャレンジ",
      organizer: "防衛装備庁",
      status: "open",
    })
  })

  it("reads the second page the same way", () => {
    const second = parseListPage(page50)
    expect(second.total).toBe(219)
    expect(second.entries.map((e) => e.status)).toEqual(["closed", "closed"])
  })

  it("fails on a response without a list, naming SIGNATE", () => {
    expect(() => parseListPage({ total_count: 3 })).toThrow(/SIGNATE list/)
  })

  it("fails on an entry without a public key", () => {
    const broken = {
      total_count: 1,
      competition_list: [{ title: "x", owner_name: "y", status: "open" }],
    }
    expect(() => parseListPage(broken)).toThrow(/SIGNATE list/)
  })

  it("fails on a public key that is not safe to put in a link", () => {
    const [entry] = page1.competition_list
    const broken = {
      total_count: 1,
      competition_list: [{ ...entry, public_key: "a/../b?c" }],
    }
    expect(() => parseListPage(broken)).toThrow(/SIGNATE list/)
  })
})

describe("isListed", () => {
  it("keeps only an open entry, so that no overview is read for the others", () => {
    expect(entries.filter(isListed).map((e) => e.publicKey)).toEqual([
      open.publicKey,
    ])
  })
})

describe("parseOverview", () => {
  it("reads the deadline of an open entry as a UTC instant, converted from JST", () => {
    expect(parseOverview(overviewOpen)).toEqual({ endsAt: OPEN_END })
  })

  it("reads no deadline for a practice entry", () => {
    expect(parseOverview(overviewPractice)).toEqual({ endsAt: null })
  })

  it("reads the pre-open start as it is; the caller never asks for it", () => {
    expect(parseOverview(overviewPreOpen).endsAt).toBe(
      "2026-11-16T04:00:00.000Z"
    )
  })

  it("fails on a deadline without an offset, since it would be read in the machine's zone", () => {
    expect(() =>
      parseOverview({ ...overviewOpen, deadline_at: "2026-12-18T23:59:00" })
    ).toThrow(/SIGNATE overview/)
  })

  it("fails on a deadline in a zone other than JST, which the listing would label wrongly", () => {
    for (const deadline_at of [
      "2026-12-18T14:59:00.000000Z",
      "2026-12-18T09:59:00.000000-05:00",
    ])
      expect(() => parseOverview({ ...overviewOpen, deadline_at })).toThrow(
        /SIGNATE overview[\s\S]*\+09:00/
      )
  })

  it("fails on a deadline that is not a date, or a day the month does not have", () => {
    for (const deadline_at of [
      "soon",
      "",
      "2026-02-30T23:59:00.000000+09:00",
      "2026-13-01T23:59:00.000000+09:00",
      "2026-12-18T25:00:00.000000+09:00",
    ])
      expect(() => parseOverview({ ...overviewOpen, deadline_at })).toThrow(
        /SIGNATE overview/
      )
  })

  it("fails on a response without a deadline field", () => {
    expect(() => parseOverview({ title: "x" })).toThrow(/SIGNATE overview/)
  })
})

describe("isOpen", () => {
  it("keeps a deadline ahead", () => {
    expect(isOpen(OPEN_END, now)).toBe(true)
  })

  it("drops no deadline, one that has passed or is this moment, and a placeholder far ahead", () => {
    expect(isOpen(null, now)).toBe(false)
    expect(isOpen("2026-10-01T00:00:00.000Z", now)).toBe(false)
    expect(isOpen(OPEN_END, new Date(OPEN_END))).toBe(false)
    expect(isOpen("2099-12-31T14:59:00.000Z", now)).toBe(false)
  })
})

describe("toListing", () => {
  const listing = toListing(open, OPEN_END)
  const url =
    "https://user.competition.signate.jp/ja/competition/detail/?competition=42024ceef5064aa6a7f463aac3f26fc2"

  it("fills the fields ACB shows and fits the schema", () => {
    expect(listing).toEqual({
      id: "signate:42024ceef5064aa6a7f463aac3f26fc2",
      source: "signate",
      kind: "challenge",
      title: "第５回 空戦AIチャレンジ",
      organizer: "防衛装備庁",
      conference: null,
      url,
      sourceUrl: url,
      opensAt: null,
      deadlines: [
        { kind: "submission", label: null, at: OPEN_END, zone: "JST" },
      ],
    })
    expect(listingSchema.safeParse(listing).success).toBe(true)
  })

  it("leaves the organizer empty when the list gives none", () => {
    expect(toListing({ ...open, organizer: "  " }, OPEN_END)?.organizer).toBe(
      null
    )
    expect(toListing({ ...open, organizer: "" }, OPEN_END)?.organizer).toBe(
      null
    )
  })

  it("returns null for a title with no text", () => {
    expect(toListing({ ...open, title: " \n " }, OPEN_END)).toBeNull()
  })

  it("cuts a long title to the schema's limit", () => {
    const long = toListing({ ...open, title: "あ".repeat(400) }, OPEN_END)
    expect(long?.title).toHaveLength(300)
    expect(listingSchema.safeParse(long).success).toBe(true)
  })
})
