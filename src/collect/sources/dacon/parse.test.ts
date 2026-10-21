import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { listingSchema } from "../../../lib/listing.ts"
import emptyPage from "./fixtures/list-empty-page.json"
import page0 from "./fixtures/list-page0.json"
import {
  isOpen,
  parseListPage,
  parseOrganizer,
  toListing,
  type Competition,
} from "./parse.ts"

// 236771 is open until 2026-11-02 10:00 KST, which is 2026-11-02T01:00:00Z.
const now = new Date("2026-10-21T09:00:00Z")
const competitions = parseListPage(page0)

function byId(id: number): Competition {
  const found = competitions.find((c) => c.id === id)
  if (!found) throw new Error(`fixture has no competition ${id}`)
  return found
}

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")
}

describe("parseListPage", () => {
  it("reads every competition on a page, with its dates as UTC instants", () => {
    expect(competitions.map((c) => c.id)).toEqual([
      236771, 236749, 236746, 236736, 236693,
    ])
    expect(byId(236771)).toMatchObject({
      name: "항만 문제해결을 위한 AI 기술 공모전",
      startsAt: "2026-10-12T01:00:00.000Z",
      endsAt: "2026-11-02T01:00:00.000Z",
      landing: false,
    })
  })

  it("converts Korean time to UTC at midnight and at the last second of a day", () => {
    expect(byId(236746)).toMatchObject({
      startsAt: "2026-07-05T15:00:00.000Z",
      endsAt: "2026-08-28T14:59:59.000Z",
    })
  })

  it("marks a competition whose DACON page is a landing page", () => {
    expect(byId(236746).landing).toBe(true)
  })

  it("reads an empty page as no competitions", () => {
    expect(parseListPage(emptyPage)).toEqual([])
  })

  it.each([
    ["a response without data", { message: "ok", status: 1 }],
    ["an error status", { message: "error", data: [], status: 0 }],
    ["a response that is not an object", "<html></html>"],
    [
      "a competition without an id",
      {
        message: "ok",
        status: 1,
        data: [{ name: "x", period_start: "a", period_end: "b" }],
      },
    ],
    [
      "a competition id that is not a positive integer",
      {
        message: "ok",
        status: 1,
        data: [
          {
            cpt_id: 0,
            name: "x",
            period_start: "2026-10-12 10:00:00",
            period_end: "2026-11-02 10:00:00",
          },
        ],
      },
    ],
  ])("rejects %s, naming DACON", (_what, json) => {
    expect(() => parseListPage(json)).toThrow(/DACON list/)
  })

  it.each(["soon", "2026-11-02", "2026-02-30 10:00:00", "2026/11/02 10:00:00"])(
    "rejects a date it cannot read as Korean time: %s",
    (text) => {
      const record = { ...page0.data[0], period_end: text }
      expect(() =>
        parseListPage({ message: "ok", status: 1, data: [record] })
      ).toThrow(/DACON list/)
    }
  )
})

describe("isOpen", () => {
  it("keeps the competition that ends after now and drops the closed ones", () => {
    expect(competitions.filter((c) => isOpen(c, now)).map((c) => c.id)).toEqual(
      [236771]
    )
  })

  it("ignores the practice flag, which DACON sets on the open competition and on closed ones", () => {
    const raw = page0.data
    expect(raw.find((r) => r.cpt_id === 236771)?.practice).toBe(1)
    expect(raw.find((r) => r.cpt_id === 236749)?.practice).toBe(0)
    expect(isOpen(byId(236771), now)).toBe(true)
    const [unflagged] = parseListPage({
      message: "ok",
      status: 1,
      data: [{ ...raw[0], practice: 0, on_going: 0, private_open: 1 }],
    })
    expect(isOpen(unflagged, now)).toBe(true)
  })

  it("drops a competition that ends at this moment, and one whose end is a placeholder", () => {
    const open = byId(236771)
    expect(isOpen(open, new Date(open.endsAt))).toBe(false)
    expect(isOpen({ ...open, endsAt: "2099-12-31T14:59:59.000Z" }, now)).toBe(
      false
    )
  })

  it("keeps a competition that has not started", () => {
    expect(isOpen(byId(236771), new Date("2026-10-01T00:00:00Z"))).toBe(true)
  })
})

describe("toListing", () => {
  const listing = toListing(byId(236771), "해양수산부")

  it("fills the fields ACB shows and fits the schema", () => {
    expect(listing).toEqual({
      id: "dacon:236771",
      source: "dacon",
      kind: "challenge",
      title: "항만 문제해결을 위한 AI 기술 공모전",
      organizer: "해양수산부",
      conference: null,
      url: "https://dacon.io/competitions/official/236771/overview/description",
      sourceUrl:
        "https://dacon.io/competitions/official/236771/overview/description",
      opensAt: "2026-10-12T01:00:00.000Z",
      deadlines: [
        {
          kind: "end",
          label: null,
          at: "2026-11-02T01:00:00.000Z",
          zone: "KST",
        },
      ],
    })
    expect(listingSchema.safeParse(listing).success).toBe(true)
  })

  it("leaves the organizer empty when the page named none", () => {
    expect(toListing(byId(236771), null)?.organizer).toBeNull()
  })

  it("links a landing competition to its landing page", () => {
    const landing = toListing(byId(236746), null)
    expect(landing?.url).toBe("https://dacon.io/competition/236746/overview")
    expect(landing?.sourceUrl).toBe(landing?.url)
    expect(listingSchema.safeParse(landing).success).toBe(true)
  })

  it("returns null for a title with no text", () => {
    expect(toListing({ ...byId(236771), name: " \n " }, null)).toBeNull()
  })

  it("cuts a long title to the schema's limit", () => {
    const long = toListing({ ...byId(236771), name: "가".repeat(400) }, null)
    expect(long?.title).toHaveLength(300)
    expect(listingSchema.safeParse(long).success).toBe(true)
  })
})

describe("parseOrganizer", () => {
  it("reads the organizer from a heading and a list, and not the host or the operator", () => {
    expect(parseOrganizer(fixture("detail-ongoing-236771.html"))).toBe(
      "해양수산부"
    )
  })

  it("reads the organizer from bold text and paragraphs, where 주최 and 주관 share a line", () => {
    expect(parseOrganizer(fixture("detail-closed-236736.html"))).toBe(
      "인공지능융합연구센터, BK 산업융합형 차세대 인공지능 혁신인재 교육연구단, 인하대학교 앵커사업본부, 인하대학교 로봇특성화대학사업단"
    )
  })

  it("stops at the next role when one line holds several", () => {
    const html =
      "<p>주최 : 해양수산부 / 주관 : 울산항만공사 / 한국정보산업연합회 / 운영 : 데이콘</p>"
    expect(parseOrganizer(html)).toBe("해양수산부")
  })

  it("decodes entities and drops markup inside the value", () => {
    const html =
      "<ul><li>주최&nbsp;: <a href='/x'>A&amp;B</a> <b>연구소</b></li></ul>"
    expect(parseOrganizer(html)).toBe("A&B 연구소")
  })

  it("returns null for a page without a 주최 line", () => {
    const html =
      "<div><p>주관: 울산항만공사</p><p>운영 : 데이콘</p><p>상금 안내</p></div>"
    expect(parseOrganizer(html)).toBeNull()
    expect(parseOrganizer("")).toBeNull()
  })

  it("returns null when the label has no value", () => {
    expect(
      parseOrganizer("<ul><li>주최 :</li><li>운영 : 데이콘</li></ul>")
    ).toBeNull()
  })

  it("does not read 주최 from a script", () => {
    const html = "<script>var s = '\\n주최 : 가짜'</script><p>본문</p>"
    expect(parseOrganizer(html)).toBeNull()
  })

  it("cuts a long value to the schema's limit", () => {
    expect(parseOrganizer(`<p>주최: ${"가".repeat(300)}</p>`)).toHaveLength(200)
  })
})
