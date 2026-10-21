import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { listingSchema } from "../../../lib/listing.ts"
import {
  isOpen,
  parseCompetitionsPage,
  readEndDate,
  toListing,
} from "./parse.ts"

// The only open prize card, GEMS (306), ends at 11:59 p.m. UTC on 2026-12-03.
const now = new Date("2026-10-21T12:00:00Z")

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")
}
const page = fixture("list-excerpt.html")
const PRIZE_SECTION = /<section id="prize">[\s\S]*?<\/section>/
const prizeSection = PRIZE_SECTION.exec(page)?.[0] ?? ""
const GEMS_TITLE = "The Geologic Enhanced Mapping System (GEMS) Prize Challenge"
const GEMS_END = "Dec. 3, 2026, 11:59 p.m. UTC"

/** The fixture page with its prize section replaced by the given markup. */
function withPrize(section: string): string {
  return page.replace(PRIZE_SECTION, () => section)
}
/** The fixture page with one change made inside its prize card. */
function editedPrize(from: string | RegExp, to: string): string {
  const edited = prizeSection.replace(from, () => to)
  expect(edited).not.toBe(prizeSection)
  return withPrize(edited)
}
/** The prize card with another id, title, and end date, without the section tags around it. */
function otherCard(id: number, title: string, endTitle: string): string {
  return prizeSection
    .replace(/<section id="prize">\n?|<\/section>/g, "")
    .replaceAll(
      "/competitions/306/competition-doe-gems/",
      `/competitions/${id}/x/`
    )
    .replaceAll(GEMS_TITLE, title)
    .replace(GEMS_END, endTitle)
}
/** The prize section with the given cards after its own. */
function prizeWith(first: string, ...more: string[]): string {
  return first.replace("</section>", () => `${more.join("")}</section>`)
}

describe("parseCompetitionsPage", () => {
  it("reads the open prize card with its title, link, host, start, and exact end", () => {
    expect(parseCompetitionsPage(page)).toEqual([
      {
        id: 306,
        name: GEMS_TITLE,
        organizer: "DOE",
        url: "https://www.drivendata.org/competitions/306/competition-doe-gems/",
        startsAt: "2026-09-10T00:00:00.000Z",
        endsAt: "2026-12-03T23:59:00.000Z",
      },
    ])
  })

  it("reads only the prize section: not the benchmark, the practice competition with an exact end in 2028, or the completed ones", () => {
    expect(page).toContain("April 3, 2028, 11:59 p.m. UTC")
    expect(page).toContain("/benchmarks/310/")
    expect(page).toContain("/competitions/group/childrens-asr-competition/")
    expect(parseCompetitionsPage(page).map((c) => c.id)).toEqual([306])
  })

  it("reads each card of the prize section, in page order", () => {
    const section = prizeWith(
      prizeSection,
      otherCard(400, "Second", "Jan. 5, 2027, 9 a.m. UTC")
    )
    expect(
      parseCompetitionsPage(withPrize(section)).map((c) => [
        c.id,
        c.name,
        c.endsAt,
      ])
    ).toEqual([
      [306, GEMS_TITLE, "2026-12-03T23:59:00.000Z"],
      [400, "Second", "2027-01-05T09:00:00.000Z"],
    ])
  })

  it("decodes entities in the title and cleans its whitespace, leaving markup as text", () => {
    const html = editedPrize(
      `>${GEMS_TITLE}</a>`,
      ">Tom &amp; Jerry&#x27;s &lt;b&gt;Prize&lt;/b&gt;\n   Challenge</a>"
    )
    expect(parseCompetitionsPage(html)[0].name).toBe(
      "Tom & Jerry's <b>Prize</b> Challenge"
    )
  })

  it("skips a prize card whose end date has no exact title", () => {
    const untitled = prizeSection.replace(` title="${GEMS_END}"`, "")
    expect(untitled).not.toBe(prizeSection)
    const section = prizeWith(
      untitled,
      otherCard(400, "Second", "Jan. 5, 2027, 9 a.m. UTC")
    )
    expect(parseCompetitionsPage(withPrize(section)).map((c) => c.id)).toEqual([
      400,
    ])
  })

  it("skips a prize card without any end date", () => {
    const html = editedPrize(
      /<span class="end-date"[^>]*>.*<\/span><\/span>/,
      ""
    )
    expect(parseCompetitionsPage(html)).toEqual([])
  })

  it("leaves the start empty when the card has no start date", () => {
    const html = editedPrize(' data-start_date="20260910"', "")
    expect(parseCompetitionsPage(html)[0].startsAt).toBeNull()
  })

  it("leaves the organizer empty when the logo is missing or does not say who hosts", () => {
    const pages = [
      editedPrize('alt="Hosted by DOE"', ""),
      editedPrize('alt="Hosted by DOE"', 'alt="Logo"'),
      editedPrize('alt="Hosted by DOE"', 'alt="Hosted by  "'),
    ]
    for (const html of pages)
      expect(parseCompetitionsPage(html)[0].organizer).toBeNull()
  })

  it("reads an empty prize section as no competitions", () => {
    expect(
      parseCompetitionsPage(withPrize('<section id="prize">\n</section>'))
    ).toEqual([])
  })

  it("reads a page without the prize section, but with the others, as no competitions", () => {
    expect(parseCompetitionsPage(withPrize(""))).toEqual([])
  })

  it.each([
    [
      "a page of another kind",
      "<html><body><h1>Maintenance</h1></body></html>",
    ],
    ["an empty response", ""],
    [
      "a page whose sections have other names",
      '<section id="results"></section>',
    ],
  ])("rejects %s, saying the competitions page is not there", (_what, html) => {
    expect(() => parseCompetitionsPage(html)).toThrow(
      /DrivenData.*competitions page.*prize/
    )
  })

  it.each([
    [
      "a start date that is not a date",
      ' data-start_date="20260910"',
      ' data-start_date="Sept. 10"',
      '"Sept. 10"',
    ],
    [
      "a start date that does not exist",
      ' data-start_date="20260910"',
      ' data-start_date="20260931"',
      '"20260931"',
    ],
    [
      "an end date it cannot read",
      GEMS_END,
      "Dec. 3, 2026, 11:59 p.m. PST",
      '"Dec. 3, 2026, 11:59 p.m. PST"',
    ],
    [
      "a link that is not a competition",
      "/competitions/306/competition-doe-gems/",
      "/competitions/group/gems/",
      '"/competitions/group/gems/"',
    ],
  ])("rejects %s, quoting it", (_what, from, to, quoted) => {
    const edited = prizeSection.replaceAll(from, to)
    expect(edited).not.toBe(prizeSection)
    expect(() => parseCompetitionsPage(withPrize(edited))).toThrow(/DrivenData/)
    expect(() => parseCompetitionsPage(withPrize(edited))).toThrow(quoted)
  })

  it("rejects a card without a title link", () => {
    const html = editedPrize(
      /<h3 class="text-xl lh-sm panel-competition-title">[\s\S]*?<\/h3>/,
      ""
    )
    expect(() => parseCompetitionsPage(html)).toThrow(/DrivenData.*title/)
  })

  it("rejects a card with a title link that has no text", () => {
    const html = editedPrize(`>${GEMS_TITLE}</a>`, ">  </a>")
    expect(() => parseCompetitionsPage(html)).toThrow(/DrivenData.*title/)
  })

  it("rejects a card with more than one end date, a shape not seen yet", () => {
    const html = editedPrize(
      "</strong> <span",
      '</strong> <span class="end-date" title="Dec. 4, 2026, 11:59 p.m. UTC">x</span><span'
    )
    expect(() => parseCompetitionsPage(html)).toThrow(/DrivenData.*end date/)
  })
})

describe("readEndDate", () => {
  it.each([
    [GEMS_END, "2026-12-03T23:59:00.000Z"],
    ["Jan. 5, 2027, 9 a.m. UTC", "2027-01-05T09:00:00.000Z"],
    ["Jan. 5, 2027, 9:05 a.m. UTC", "2027-01-05T09:05:00.000Z"],
    ["Feb. 28, 2027, 12:30 a.m. UTC", "2027-02-28T00:30:00.000Z"],
    ["Feb. 28, 2027, 12:30 p.m. UTC", "2027-02-28T12:30:00.000Z"],
    ["March 1, 2027, 1 p.m. UTC", "2027-03-01T13:00:00.000Z"],
    ["April 3, 2028, 11:59 p.m. UTC", "2028-04-03T23:59:00.000Z"],
    ["May 31, 2027, 10 a.m. UTC", "2027-05-31T10:00:00.000Z"],
    ["June 30, 2027, 10 a.m. UTC", "2027-06-30T10:00:00.000Z"],
    ["July 4, 2027, 10 a.m. UTC", "2027-07-04T10:00:00.000Z"],
    ["Aug. 15, 2027, 10 a.m. UTC", "2027-08-15T10:00:00.000Z"],
    ["Sept. 1, 2027, 10 a.m. UTC", "2027-09-01T10:00:00.000Z"],
    ["Oct. 31, 2027, 10 a.m. UTC", "2027-10-31T10:00:00.000Z"],
    ["Nov. 30, 2027, 10 a.m. UTC", "2027-11-30T10:00:00.000Z"],
    ["Dec. 31, 2027, 10 a.m. UTC", "2027-12-31T10:00:00.000Z"],
  ])("reads %s", (text, iso) => {
    expect(readEndDate(text)).toBe(iso)
  })

  it("reads noon as 12:00 and midnight as 00:00 of the day named", () => {
    expect(readEndDate("March 1, 2027, noon UTC")).toBe(
      "2027-03-01T12:00:00.000Z"
    )
    expect(readEndDate("March 1, 2027, midnight UTC")).toBe(
      "2027-03-01T00:00:00.000Z"
    )
  })

  it("reads a leap day, and the extra spaces a page may carry", () => {
    expect(readEndDate(" Feb. 29, 2028,  9 a.m.\u00a0UTC\n")).toBe(
      "2028-02-29T09:00:00.000Z"
    )
  })

  it.each([
    "",
    "6 weeks left",
    "sep 2026",
    "Dec. 3, 2026",
    "Dec 3, 2026, 11:59 p.m. UTC",
    "December 3, 2026, 11:59 p.m. UTC",
    "Sep. 3, 2026, 11:59 p.m. UTC",
    "Dec. 3, 2026, 11:59 p.m.",
    "Dec. 3, 2026, 11:59 p.m. PST",
    "Dec. 3, 2026, 11:59 p.m. UTC+1",
    "Dec. 3, 2026, 11:59 PM UTC",
    "Dec. 3, 2026, 13 p.m. UTC",
    "Dec. 3, 2026, 0 a.m. UTC",
    "Dec. 3, 2026, 11:60 p.m. UTC",
    "Dec. 3, 2026, 23:59 UTC",
    "Dec. 0, 2026, 9 a.m. UTC",
    "Dec. 32, 2026, 9 a.m. UTC",
    "Feb. 30, 2027, 9 a.m. UTC",
    "Feb. 29, 2027, 9 a.m. UTC",
  ])("does not read %j", (text) => {
    expect(readEndDate(text)).toBeNull()
  })
})

describe("isOpen", () => {
  const [gems] = parseCompetitionsPage(page)

  it("keeps the competition that ends after now", () => {
    expect(isOpen(gems, now)).toBe(true)
  })

  it("drops a competition that has ended, one that ends at this moment, and one whose end is a placeholder", () => {
    expect(isOpen(gems, new Date("2026-12-04T00:00:00Z"))).toBe(false)
    expect(isOpen(gems, new Date(gems.endsAt))).toBe(false)
    expect(isOpen({ ...gems, endsAt: "2099-12-31T23:59:00.000Z" }, now)).toBe(
      false
    )
  })

  it("keeps a competition that has not started", () => {
    expect(isOpen(gems, new Date("2026-09-01T00:00:00Z"))).toBe(true)
  })
})

describe("toListing", () => {
  const [gems] = parseCompetitionsPage(page)
  const listing = toListing(gems)

  it("fills the fields ACB shows and fits the schema", () => {
    expect(listing).toEqual({
      id: "drivendata:306",
      source: "drivendata",
      kind: "challenge",
      title: GEMS_TITLE,
      organizer: "DOE",
      conference: null,
      url: "https://www.drivendata.org/competitions/306/competition-doe-gems/",
      sourceUrl: "https://www.drivendata.org/competitions/",
      opensAt: "2026-09-10T00:00:00.000Z",
      deadlines: [
        {
          kind: "end",
          label: null,
          at: "2026-12-03T23:59:00.000Z",
          zone: "UTC",
        },
      ],
    })
    expect(listingSchema.safeParse(listing).success).toBe(true)
  })

  it("leaves the start and the organizer empty when the card gives none", () => {
    const bare = toListing({ ...gems, startsAt: null, organizer: null })
    expect(bare).toMatchObject({ opensAt: null, organizer: null })
    expect(listingSchema.safeParse(bare).success).toBe(true)
  })

  it("agrees with the detail page's end date, title, and host", () => {
    const detail = fixture("detail-306-excerpt.html")
    expect(detail).toContain(`title="${GEMS_END}"`)
    expect(detail).toContain(`content="${gems.name}"`)
    expect(detail).toContain(`alt="Hosted by ${gems.organizer}"`)
  })
})
