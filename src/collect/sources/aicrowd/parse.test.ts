import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { listingSchema } from "../../../lib/listing.ts"
import {
  parseCards,
  parseRounds,
  toListing,
  type Card,
  type Round,
} from "./parse.ts"

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")
}

const listHtml = fixture("list-page1.html")
const startingSoonHtml = fixture("list-starting-soon.html")
const reactHtml = fixture("challenge-react-running.html")
const classicCompletedHtml = fixture("challenge-classic-completed.html")
const classicStartingSoonHtml = fixture("challenge-classic-starting-soon.html")

// The running card's phase ends at 2026-10-21 23:59:00 UTC.
const now = new Date("2026-10-21T12:30:00Z")
const ARC =
  "https://www.aicrowd.com/challenges/arc-white-box-estimation-challenge-2026"

/** A challenge page whose React overview props carry `rounds`, escaped as the site escapes them. */
function reactPage(rounds: unknown): string {
  const props = JSON.stringify({
    props: { data: { challenge: { slug: "x", rounds } } },
  })
  const attribute = props.replace(/&/g, "&amp;").replace(/"/g, "&quot;")
  return `<body><div data-react-props="${attribute}"></div></body>`
}

function round(name: string, start: string, end: string): Round {
  return { name, startDttm: start, endDttm: end }
}

/** The list with the Global Chess card running until 2026-11-30, as a classic challenge's card would show. */
const chessRunning = listHtml
  .replace('title=""', 'title="2026-11-30 23:59:00 UTC"')
  .replace("Round 2: Completed", "Round 2: 40 days left")

describe("parseCards", () => {
  it("reads the running card's title, link, organizer, phase, and the end of the phase", () => {
    expect(parseCards(listHtml, now)).toEqual([
      {
        slug: "arc-white-box-estimation-challenge-2026",
        title: "ARC White-Box Estimation Challenge 2026",
        organizer: "Alignment Research Center",
        phase: "Phase 2",
        endsAt: "2026-10-21T23:59:00.000Z",
      },
    ])
  })

  it("skips the completed cards, whose tooltip is empty, even one tagged #neurips", () => {
    const slugs = parseCards(listHtml, now).map((card) => card.slug)
    expect(slugs).toEqual(["arc-white-box-estimation-challenge-2026"])
  })

  it("returns no cards when none is running", () => {
    expect(parseCards(startingSoonHtml, now)).toEqual([])
  })

  it("skips a running card whose phase has ended", () => {
    const later = new Date("2026-10-22T00:00:00Z")
    expect(parseCards(listHtml, later)).toEqual([])
  })

  it("skips a card whose phase ends beyond the placeholder limit", () => {
    const far = listHtml.replace(
      "2026-10-21 23:59:00 UTC",
      "2099-12-31 23:59:00 UTC"
    )
    expect(parseCards(far, now)).toEqual([])
  })

  it("joins several organizers with a comma", () => {
    const cards = parseCards(chessRunning, now)
    expect(
      cards.map((card) => [card.slug, card.phase, card.organizer])
    ).toEqual([
      [
        "arc-white-box-estimation-challenge-2026",
        "Phase 2",
        "Alignment Research Center",
      ],
      ["global-chess-challenge-2025", "Round 2", "AIcrowd, AGI House"],
    ])
  })

  it("trims an organizer name that ends in a space", () => {
    const running = listHtml
      .replace(
        /title=""(>\s+Phase 1: Completed)/,
        'title="2026-12-01 00:00:00 UTC"$1'
      )
      .replace("Phase 1: Completed", "Phase 1: 40 days left")
    const card = parseCards(running, now).find((c) => c.slug.startsWith("orak"))
    expect(card?.organizer).toBe("Krafton AI")
  })

  it("leaves the organizer empty for a card with none", () => {
    const none = listHtml.replace(
      /<a href="\/organizers\/alignment-research-center">[\s\S]*?<\/a>/,
      ""
    )
    expect(parseCards(none, now)[0].organizer).toBeNull()
  })

  it("leaves the phase empty when the badge has no phase name", () => {
    const unnamed = listHtml.replace(
      "Phase 2: 11 hours left",
      ": 11 hours left"
    )
    expect(parseCards(unnamed, now)[0].phase).toBeNull()
  })

  it("fails on a page with no challenge cards, naming AIcrowd", () => {
    expect(() =>
      parseCards("<html><body><p>Nothing</p></body></html>", now)
    ).toThrow(/AIcrowd.*no challenge cards/)
    expect(() => parseCards("", now)).toThrow(/AIcrowd/)
  })

  it.each([
    ["a date without a zone", "2026-10-21 23:59:00"],
    ["words", "ends tomorrow"],
    ["an impossible date", "2026-02-30 23:59:00 UTC"],
  ])("skips a card whose tooltip is %s", (_, tooltip) => {
    const broken = listHtml.replace("2026-10-21 23:59:00 UTC", tooltip)
    expect(parseCards(broken, now)).toEqual([])
  })

  it("fails on a running card without a title or a challenge link", () => {
    const noTitle = listHtml.replace(
      /<h5 class="card-title">[\s\S]*?<\/h5>/,
      '<h5 class="card-title"></h5>'
    )
    expect(() => parseCards(noTitle, now)).toThrow(/AIcrowd.*title/)
    const badLink = listHtml.replaceAll(
      "/challenges/arc-white-box-estimation-challenge-2026",
      "javascript:alert(1)"
    )
    expect(() => parseCards(badLink, now)).toThrow(/AIcrowd.*link/)
  })
})

describe("parseRounds", () => {
  it("reads the rounds with their dates from the overview props", () => {
    expect(parseRounds(reactHtml)).toEqual([
      {
        name: "Warm-Up Round",
        startDttm: "2026-05-28T00:00:00Z",
        endDttm: "2026-06-17T23:59:00Z",
      },
      {
        name: "Phase 1",
        startDttm: "2026-06-18T00:00:00Z",
        endDttm: "2026-08-10T23:59:00Z",
      },
      {
        name: "Phase 2",
        startDttm: "2026-08-22T00:00:00Z",
        endDttm: "2026-10-21T23:59:00Z",
      },
    ])
  })

  it.each([
    ["a completed classic page", classicCompletedHtml],
    ["a starting-soon classic page", classicStartingSoonHtml],
    ["a page without markup", ""],
  ])("returns null for %s, which has no dates", (_, html) => {
    expect(parseRounds(html)).toBeNull()
  })

  it("returns null when the only props are the banner's rounds, which have no dates", () => {
    const banner = reactHtml
      .split("\n")
      .filter((line) => !line.includes("overview"))
    expect(parseRounds(banner.join("\n"))).toBeNull()
  })

  it("fails on props that are not JSON", () => {
    const broken = '<div data-react-props="{&quot;props&quot;: oops"></div>'
    expect(() => parseRounds(broken)).toThrow(/AIcrowd.*props/)
  })

  it("fails on rounds whose dates are not instants", () => {
    const page = reactPage([round("Phase 1", "soon", "2026-11-01T23:59:00Z")])
    expect(() => parseRounds(page)).toThrow(/AIcrowd.*rounds/)
  })
})

describe("toListing", () => {
  const [card] = parseCards(listHtml, now)
  const rounds = parseRounds(reactHtml) as Round[]

  it("builds the listing from the card alone when the page has no dates", () => {
    const listing = toListing(card, null, now)
    expect(listing).toEqual({
      id: "aicrowd:arc-white-box-estimation-challenge-2026",
      source: "aicrowd",
      kind: "challenge",
      title: "ARC White-Box Estimation Challenge 2026",
      organizer: "Alignment Research Center",
      conference: null,
      url: ARC,
      sourceUrl: ARC,
      opensAt: null,
      deadlines: [
        {
          kind: "phase",
          label: "Phase 2",
          at: "2026-10-21T23:59:00.000Z",
          zone: "UTC",
        },
      ],
    })
    expect(listingSchema.parse(listing)).toEqual(listing)
  })

  it("replaces the card's deadline with the rounds still ahead and opens at the earliest start", () => {
    const early = new Date("2026-08-01T00:00:00Z")
    const listing = toListing(card, rounds, early)
    expect(listing.opensAt).toBe("2026-05-28T00:00:00.000Z")
    expect(listing.deadlines).toEqual([
      {
        kind: "phase",
        label: "Phase 1",
        at: "2026-08-10T23:59:00.000Z",
        zone: "UTC",
      },
      {
        kind: "phase",
        label: "Phase 2",
        at: "2026-10-21T23:59:00.000Z",
        zone: "UTC",
      },
    ])
    expect(listingSchema.parse(listing)).toEqual(listing)
  })

  it("lists a phase end once when two rounds end in the same minute", () => {
    const repeated = [
      round("Phase 1", "2026-09-01T00:00:00Z", "2026-11-01T23:59:00Z"),
      round("Phase 1b", "2026-09-01T00:00:00Z", "2026-11-01T23:59:30Z"),
    ]
    expect(toListing(card, repeated, now).deadlines).toHaveLength(1)
  })

  it("keeps the card's deadline when no round ends ahead, and still opens at the earliest start", () => {
    const over = [
      round("Phase 1", "2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z"),
    ]
    const listing = toListing(card, over, now)
    expect(listing.opensAt).toBe("2026-01-01T00:00:00.000Z")
    expect(listing.deadlines.map((d) => [d.label, d.at])).toEqual([
      ["Phase 2", "2026-10-21T23:59:00.000Z"],
    ])
  })

  it("leaves a deadline's label empty when the card has no phase name", () => {
    const unnamed: Card = { ...card, phase: null }
    expect(toListing(unnamed, null, now).deadlines[0].label).toBeNull()
  })
})
