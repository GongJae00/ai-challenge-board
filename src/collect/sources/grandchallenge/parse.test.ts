import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { listingSchema } from "../../../lib/listing.ts"
import { parseListPage, toListing, type Card } from "./parse.ts"

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")
}

const now = new Date("2026-10-21T13:00:00Z")

const page1 = parseListPage(fixture("list-open-page1.html"))
const page2 = parseListPage(fixture("list-open-page2.html"))
const page3 = parseListPage(fixture("list-open-page3.html"))

function card(slug: string): Card {
  const found = page1.cards.find((c) => c.slug === slug)
  if (!found) throw new Error(`fixture has no card ${slug}`)
  return found
}

const NO_NEXT =
  '<li class="page-item disabled"><span class="page-link">Next</span></li>'

/** A card as the list writes it, with the submission line given as text, or no line at all. */
function cardHtml(slug: string, title: string, line: string | null): string {
  const badge =
    line === null
      ? ""
      : `<span class="badge badge-success mt-1 w-100 p-2"><i class="far fa-clock fa-fw"></i> ${line}\n</span><br>`
  return `<div class="card gc-card">
    <a class="stretched-link" href="https://${slug}.grand-challenge.org/" title="View Challenge"></a>
    <div class="card-body"><h5 class="card-title text-truncate mb-0">
        ${title}
    </h5><div>${badge}</div></div></div>`
}

/** A list page around the given cards, in the markup of the fixtures. */
function pageHtml(
  cards: string[],
  options: { next?: string; timezone?: string | null } = {}
): string {
  const { next = NO_NEXT, timezone = '"UTC"' } = options
  const marker =
    timezone === null
      ? ""
      : `<script id="currentTimezone" type="application/json">${timezone}</script>`
  return `<div class="row">${cards.join("")}</div>
<ul class="pagination mb-0">
  <li class="page-item disabled"><span class="page-link">Previous</span></li>
  <li class="page-item disabled"><span class="page-link">Page 1 of 1</span></li>
  ${next}
</ul>
${marker}`
}

describe("parseListPage", () => {
  it("reads each card's challenge address, title, and phase deadline from the first open page", () => {
    expect(page1.cards.map((c) => c.slug)).toEqual([
      "owl",
      "lightmycells2",
      "beetle",
      "trackrad2025",
      "prisma24",
      "toothfairy2",
    ])
    expect(card("owl")).toEqual({
      slug: "owl",
      url: "https://owl.grand-challenge.org/",
      title: "Observing What Models Learn",
      deadline: { phase: "Sanity Check", at: "2026-12-07T10:19:00.000Z" },
    })
    expect(card("prisma24").deadline).toEqual({
      phase: "Debug",
      at: "2026-10-29T23:00:00.000Z",
    })
  })

  it("reads the date in UTC, keeping the minute", () => {
    expect(card("trackrad2025").deadline).toEqual({
      phase: "Post-challenge",
      at: "2026-12-30T23:00:00.000Z",
    })
    expect(card("toothfairy2").deadline).toEqual({
      phase: "Post Challenge Phase: Test Your Algorithm",
      at: "2028-09-30T22:00:00.000Z",
    })
  })

  it("gives no deadline to a bare 'Accepting submissions' or to a phase without a date", () => {
    expect(card("lightmycells2").deadline).toBeNull()
    expect(card("beetle").deadline).toBeNull()
    expect(page3.cards.map((c) => c.deadline)).toEqual([null, null])
  })

  it("gives no deadline to a card with no submission line, and to an opening-soon card", () => {
    const none = parseListPage(pageHtml([cardHtml("closed1", "Closed", null)]))
    expect(none.cards.map((c) => c.deadline)).toEqual([null])
    const soon = parseListPage(fixture("list-open-soon.html"))
    expect(soon.cards.map((c) => c.slug)).toEqual(["cobra2026", "topbrain2026"])
    expect(soon.cards.map((c) => c.deadline)).toEqual([null, null])
  })

  it("decodes the HTML entities of a title", () => {
    expect(page2.cards.map((c) => c.title)).toEqual([
      "VerSe'20",
      "Lymphocyte Assessment Hackathon",
      "VerSe`19",
    ])
  })

  it("cuts a long title to the schema's limit", () => {
    const html = pageHtml([cardHtml("x1", "x".repeat(400), null)])
    const [long] = parseListPage(html).cards
    expect(long.title).toHaveLength(300)
    expect(
      listingSchema.safeParse(
        toListing(
          { ...long, deadline: { phase: "F", at: "2026-12-07T10:19:00.000Z" } },
          now
        )
      ).success
    ).toBe(true)
  })

  it("keeps a title with markup as text", () => {
    const html = pageHtml([
      cardHtml("x1", "A &lt;b&gt;bold&lt;/b&gt; move &amp; more", null),
    ])
    expect(parseListPage(html).cards[0].title).toBe("A <b>bold</b> move & more")
  })

  it("splits a phase name that holds ' until ' from the date at the end", () => {
    const html = pageHtml([
      cardHtml(
        "x1",
        "X",
        "Accepting submissions for Open until final until Jan 05 2027 at 09:30"
      ),
    ])
    expect(parseListPage(html).cards[0].deadline).toEqual({
      phase: "Open until final",
      at: "2027-01-05T09:30:00.000Z",
    })
  })

  it("detects the last page by the disabled Next link", () => {
    expect(page1.last).toBe(false)
    expect(page2.last).toBe(false)
    expect(page3.last).toBe(true)
    expect(parseListPage(fixture("list-open-soon.html")).last).toBe(true)
  })

  it("reads the cards of every fixture page without failing", () => {
    expect(page2.cards).toHaveLength(3)
    expect(page3.cards).toHaveLength(2)
  })

  it("fails on a page without the UTC marker", () => {
    const html = pageHtml([cardHtml("x1", "X", null)], { timezone: null })
    expect(() => parseListPage(html)).toThrow(/currentTimezone/)
  })

  it("fails on a page whose time zone is not UTC", () => {
    const html = pageHtml([cardHtml("x1", "X", null)], {
      timezone: '"Europe/Amsterdam"',
    })
    expect(() => parseListPage(html)).toThrow(/Europe\/Amsterdam/)
  })

  it("fails on a time zone marker that is not JSON", () => {
    const html = pageHtml([cardHtml("x1", "X", null)], { timezone: "UTC" })
    expect(() => parseListPage(html)).toThrow(/currentTimezone/)
  })

  it("fails on a date it cannot read", () => {
    for (const date of [
      "Foo 07 2026 at 10:19",
      "Feb 30 2026 at 10:19",
      "Dec 07 2026 at 25:19",
      "2026-12-07 10:19",
    ]) {
      const html = pageHtml([
        cardHtml("x1", "X", `Accepting submissions for Final until ${date}`),
      ])
      expect(() => parseListPage(html), date).toThrow(/Grand Challenge.*date/)
    }
  })

  it("fails on a page without the pagination block", () => {
    const html = `<div class="row">${cardHtml("x1", "X", null)}</div><script id="currentTimezone" type="application/json">"UTC"</script>`
    expect(() => parseListPage(html)).toThrow(/pagination/)
  })

  it("fails on a pagination block without a Next item", () => {
    const html = pageHtml([cardHtml("x1", "X", null)], { next: "" })
    expect(() => parseListPage(html)).toThrow(/Next/)
  })

  it("fails on a card without a title or without a challenge address", () => {
    expect(() =>
      parseListPage(pageHtml([cardHtml("x1", "   ", null)]))
    ).toThrow(/title/)
    const noLink = `<div class="card gc-card"><h5 class="card-title">X</h5></div>`
    expect(() => parseListPage(pageHtml([noLink]))).toThrow(/address/)
    const foreign = cardHtml("x1", "X", null).replace(
      "https://x1.grand-challenge.org/",
      "https://example.com/"
    )
    expect(() => parseListPage(pageHtml([foreign]))).toThrow(/address/)
    const script = cardHtml("x1", "X", null).replace(
      "https://x1.grand-challenge.org/",
      "javascript:alert(1)"
    )
    expect(() => parseListPage(pageHtml([script]))).toThrow(/address/)
  })

  it("fails on a response that is not a list page", () => {
    expect(() => parseListPage("<html><body>Error</body></html>")).toThrow(
      /Grand Challenge/
    )
    expect(() => parseListPage("")).toThrow(/Grand Challenge/)
  })

  it("fails on a page with no cards", () => {
    expect(() => parseListPage(pageHtml([]))).toThrow(/no challenges/)
  })
})

describe("toListing", () => {
  it("lists owl with its phase deadline in UTC", () => {
    const listing = toListing(card("owl"), now)
    expect(listing).toEqual({
      id: "grandchallenge:owl",
      source: "grandchallenge",
      kind: "challenge",
      title: "Observing What Models Learn",
      organizer: null,
      conference: null,
      url: "https://owl.grand-challenge.org/",
      sourceUrl: "https://owl.grand-challenge.org/",
      opensAt: null,
      deadlines: [
        {
          kind: "phase",
          label: "Sanity Check",
          at: "2026-12-07T10:19:00.000Z",
          zone: "UTC",
        },
      ],
    })
    expect(listingSchema.safeParse(listing).success).toBe(true)
  })

  it("lists prisma24 with its Debug phase", () => {
    const listing = toListing(card("prisma24"), now)
    expect(listing?.id).toBe("grandchallenge:prisma24")
    expect(listing?.deadlines).toEqual([
      {
        kind: "phase",
        label: "Debug",
        at: "2026-10-29T23:00:00.000Z",
        zone: "UTC",
      },
    ])
  })

  it("keeps the 23:00 and 12:00 UTC deadlines as UTC, without the Anywhere on Earth rule", () => {
    const noon: Card = {
      ...card("owl"),
      deadline: { phase: "Final", at: "2026-12-07T12:00:00.000Z" },
    }
    expect(toListing(noon, now)?.deadlines[0].zone).toBe("UTC")
  })

  it("skips the post-challenge phases, which are open leaderboards of an ended challenge", () => {
    expect(toListing(card("trackrad2025"), now)).toBeNull()
    // Its end, Sep 30 2028, is within two years, so only the phase name rules it out.
    expect(toListing(card("toothfairy2"), now)).toBeNull()
    for (const phase of [
      "post-challenge",
      "POST CHALLENGE",
      "Post challenge phase",
      "Final test (Post-Challenge)",
    ]) {
      const post: Card = {
        ...card("owl"),
        deadline: { phase, at: "2026-12-07T10:19:00.000Z" },
      }
      expect(toListing(post, now), phase).toBeNull()
    }
  })

  it("skips a card with no deadline", () => {
    expect(toListing(card("lightmycells2"), now)).toBeNull()
    expect(toListing(card("beetle"), now)).toBeNull()
  })

  it("skips a deadline that has passed, and one so far ahead that it stands for never", () => {
    const at = (iso: string): Card => ({
      ...card("owl"),
      deadline: { phase: "Final", at: iso },
    })
    expect(toListing(at("2026-10-21T12:59:00.000Z"), now)).toBeNull()
    expect(toListing(at("2026-10-21T13:01:00.000Z"), now)).not.toBeNull()
    expect(toListing(at("2029-01-01T00:00:00.000Z"), now)).toBeNull()
  })
})
