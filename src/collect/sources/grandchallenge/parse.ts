import { parse, type HTMLElement } from "node-html-parser"

import type { Listing } from "../../../lib/listing.ts"
import { cleanText, webUrl } from "../../text.ts"
import { endsAhead, isoFromLocal, monthOf } from "../../time.ts"

/** The phase deadline a card states: the phase's name and the instant it stops accepting submissions. */
export interface PhaseDeadline {
  phase: string
  at: string
}

/** One challenge of the list page. */
export interface Card {
  /** The challenge's subdomain, which names it on the platform. */
  slug: string
  /** The challenge's own site. */
  url: string
  title: string
  /** Null for a card that gives no date, such as a bare "Accepting submissions". */
  deadline: PhaseDeadline | null
}

export interface ListPage {
  cards: Card[]
  /** Whether the page's Next link is disabled. */
  last: boolean
}

// The card's line is `Phase.submission_status_string`; its date is strftime "%b %d %Y at %H:%M". A phase name
// may hold " until ", so the date is anchored at the end.
const SUBMISSION_LINE = /^Accepting submissions for (.+) until (.+)$/
const DATE = /^([A-Za-z]{3}) (\d{2}) (\d{4}) at (\d{2}:\d{2})$/
const CLOCK_AT_END = /\d{2}:\d{2}$/
const HOST = /^([a-z0-9-]+)\.grand-challenge\.org$/

/**
 * A post-challenge phase is the open leaderboard that a challenge keeps after it has ended, such as
 * "Post-challenge" or "Post Challenge Phase: Test Your Algorithm". ACB lists no persistent leaderboard, so a card
 * whose open phase is one is not listed.
 */
const POST_CHALLENGE = /post[\s-]*challenge/i

function pageError(message: string): Error {
  return new Error(`Grand Challenge ${message}`)
}

/**
 * Every page embeds the time zone its times are shown in. The collector sends no cookie, so the site answers in
 * UTC; another zone would move every date, so the page is not read.
 */
function checkTimeZone(root: HTMLElement): void {
  const marker = root.querySelector("script#currentTimezone")
  let zone: unknown
  try {
    zone = marker ? JSON.parse(marker.text) : undefined
  } catch {
    zone = undefined
  }
  if (zone === undefined)
    throw pageError("page has no readable currentTimezone marker")
  if (zone !== "UTC")
    throw pageError(`page shows times in ${JSON.stringify(zone)}, not UTC`)
}

/** Whether the Next link is disabled; the pagination block must name one. */
function isLastPage(root: HTMLElement): boolean {
  const items = root.querySelectorAll("ul.pagination li.page-item")
  if (items.length === 0) throw pageError("page has no pagination block")
  const next = items.find((item) => cleanText(item.text, 20) === "Next")
  if (!next) throw pageError("pagination block has no Next item")
  return next.querySelector("a") === null
}

/** The date of a card's line as a UTC instant; fails when the text is not a date it can read. */
function readDate(text: string, slug: string): string {
  const match = DATE.exec(text)
  const month = match ? (monthOf(match[1]) ?? 0) : 0
  const iso =
    match && month > 0
      ? isoFromLocal(
          `${match[3]}-${String(month).padStart(2, "0")}-${match[2]} ${match[4]}`,
          "UTC"
        )
      : null
  if (iso === null)
    throw pageError(`card ${slug} has a date that does not read: "${text}"`)
  return iso
}

/**
 * The deadline a card states, or null for a card that states none: a bare "Accepting submissions" (the site shows
 * no date when several phases are open), a phase without a date, a card that is not accepting submissions, or
 * one that only announces an opening. A line that gives a time at its end but not in the known form fails, since
 * the site's format would have changed.
 */
function readDeadline(card: HTMLElement, slug: string): PhaseDeadline | null {
  for (const badge of card.querySelectorAll(".badge")) {
    const line = cleanText(badge.text, 500)
    if (line === null || !line.startsWith("Accepting submissions")) continue
    const match = SUBMISSION_LINE.exec(line)
    if (!match) return null
    const [, phase, date] = match
    if (!CLOCK_AT_END.test(date)) return null
    return { phase: phase.trim(), at: readDate(date, slug) }
  }
  return null
}

/**
 * A card's challenge, or null for a challenge hosted elsewhere, whose card links to its own site: ACB lists the
 * challenges grand-challenge.org runs. A card without a web link means the markup has changed, and fails.
 */
function readCard(card: HTMLElement): Card | null {
  const href = card.querySelector("a.stretched-link")?.getAttribute("href")
  const address = webUrl(href)
  if (address === null)
    throw pageError(`card has no challenge address: ${href}`)
  const host = new URL(address)
  const slug =
    host.protocol === "https:" ? HOST.exec(host.hostname)?.[1] : undefined
  if (!slug || slug === "www") return null
  const title = cleanText(card.querySelector("h5.card-title")?.text, 300)
  if (title === null) throw pageError(`card ${slug} has no title`)
  return {
    slug,
    url: `https://${slug}.grand-challenge.org/`,
    title,
    deadline: readDeadline(card, slug),
  }
}

/**
 * The challenges of one list page and whether it is the last. The open list always holds challenges, since
 * finished challenges keep open leaderboards, so a page with no cards, or with only cards that link elsewhere,
 * means the markup has changed. Fails then, and when the time zone is not UTC, the pagination is missing, or a
 * card does not fit, rather than returning a part of the list.
 */
export function parseListPage(html: string): ListPage {
  const root = parse(html)
  checkTimeZone(root)
  const found = root.querySelectorAll(".gc-card")
  if (found.length === 0) throw pageError("page holds no challenges")
  const cards = found.flatMap((card) => readCard(card) ?? [])
  if (cards.length === 0)
    throw pageError("page holds no challenge hosted on grand-challenge.org")
  return { cards, last: isLastPage(root) }
}

/**
 * The listing of a card with a phase deadline still ahead, or null. The card shows the one phase that is open,
 * so its close is the deadline of that phase, labelled with the phase's name, as an instant in UTC. A
 * post-challenge phase is no deadline of a contest and is skipped.
 */
export function toListing(card: Card, now: Date): Listing | null {
  const { deadline } = card
  if (deadline === null || POST_CHALLENGE.test(deadline.phase)) return null
  if (!endsAhead(Date.parse(deadline.at), now)) return null
  return {
    id: `grandchallenge:${card.slug}`,
    source: "grandchallenge",
    kind: "challenge",
    title: card.title,
    organizer: null,
    conference: null,
    url: card.url,
    sourceUrl: card.url,
    opensAt: null,
    deadlines: [
      {
        kind: "phase",
        label: cleanText(deadline.phase, 200),
        at: deadline.at,
        zone: "UTC",
      },
    ],
  }
}
