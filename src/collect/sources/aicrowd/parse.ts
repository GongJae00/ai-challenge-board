import { parse, type HTMLElement } from "node-html-parser"
import { z } from "zod"

import { minuteOf } from "../../../lib/datetime.ts"
import type { Deadline, Listing } from "../../../lib/listing.ts"
import { cleanText } from "../../text.ts"
import { endsAhead, isoFromMs } from "../../time.ts"

const SITE = "https://www.aicrowd.com"

/** What a running challenge's card on the list gives. */
export interface Card {
  /** The challenge's address segment, such as `arc-white-box-estimation-challenge-2026`. */
  slug: string
  title: string
  /** The organizers' names joined with a comma, or null when the card names none. */
  organizer: string | null
  /** The name of the phase now running, from the badge text before its colon, or null when the badge has none. */
  phase: string | null
  /** The end of that phase, as a UTC instant. */
  endsAt: string
}

export function challengeUrl(slug: string): string {
  return `${SITE}/challenges/${slug}`
}

/** The badge's tooltip on a running card: the end of the current phase, always in UTC. */
const TOOLTIP = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) UTC$/
const CHALLENGE_LINK = /^\/challenges\/([\w.~%-]+)$/

/** The instant a tooltip states, or null when it is not a real date and time in the format. */
function instantOfTooltip(text: string): number | null {
  const match = TOOLTIP.exec(text)
  if (!match) return null
  const iso = `${match[1]}T${match[2]}.000Z`
  const ms = Date.parse(iso)
  // An impossible date, such as February 30, either fails to parse or rolls over, so it does not read back.
  return Number.isNaN(ms) || isoFromMs(ms) !== iso ? null : ms
}

function organizerOf(card: HTMLElement): string | null {
  const names: string[] = []
  for (const span of card.querySelectorAll(
    '.card-footer a[href^="/organizers/"] span[title]'
  )) {
    const name = cleanText(span.getAttribute("title"), 200)
    if (name !== null && !names.includes(name)) names.push(name)
  }
  return cleanText(names.join(", "), 200)
}

/**
 * The running challenges on a list page that end ahead, with the end of the phase now running. Only a running
 * card has a tooltip on its badge, `YYYY-MM-DD HH:MM:SS UTC`; a completed or starting-soon card has an empty
 * one, and a card whose tooltip is in another form is left out as well. The relative text beside the tooltip
 * ("11 hours left") is never read. A page with no cards at all, or a running card without a title or a link,
 * means the markup has changed, and fails.
 */
export function parseCards(html: string, now: Date): Card[] {
  const cards = parse(html).querySelectorAll(".card-challenge")
  if (cards.length === 0)
    throw new Error("AIcrowd challenge list holds no challenge cards")

  const running: Card[] = []
  for (const card of cards) {
    const badge = card.querySelector("a.card-img-overlay span.badge")
    const tooltip = badge?.getAttribute("title")?.trim()
    if (!badge || !tooltip) continue
    const endMs = instantOfTooltip(tooltip)
    if (endMs === null || !endsAhead(endMs, now)) continue

    const anchor = card.querySelector("h5.card-title a")
    const title = cleanText(anchor?.text, 300)
    if (title === null) throw new Error("AIcrowd running card has no title")
    const slug = CHALLENGE_LINK.exec(anchor?.getAttribute("href") ?? "")?.[1]
    if (slug === undefined)
      throw new Error(`AIcrowd card "${title}" has no challenge link`)

    const badgeText = cleanText(badge.text, 300) ?? ""
    const colon = badgeText.indexOf(":")
    running.push({
      slug,
      title,
      organizer: organizerOf(card),
      phase: colon === -1 ? null : cleanText(badgeText.slice(0, colon), 100),
      endsAt: isoFromMs(endMs),
    })
  }
  return running
}

const instant = z.iso.datetime()

// Only what ACB uses is read; the rounds also carry an id, a state, and an `active` flag.
const roundsSchema = z.array(
  z.object({
    name: z.string(),
    startDttm: instant,
    endDttm: instant,
  })
)

export type Round = z.infer<typeof roundsSchema>[number]

function roundsIn(props: unknown): unknown[] | null {
  const rounds = (
    props as { props?: { data?: { challenge?: { rounds?: unknown } } } }
  )?.props?.data?.challenge?.rounds
  return Array.isArray(rounds) ? rounds : null
}

/**
 * The rounds of a challenge with their dates, from the React overview on its page, or null for a classic page,
 * which carries no dates. The page holds two React props blobs, and only the overview's rounds have dates; the
 * banner's rounds, with names only, are passed over. Props that are not JSON, or rounds whose dates
 * are not instants, mean the markup has changed, and fail.
 */
export function parseRounds(html: string): Round[] | null {
  for (const element of parse(html).querySelectorAll("[data-react-props]")) {
    let props: unknown
    try {
      props = JSON.parse(element.getAttribute("data-react-props") ?? "")
    } catch {
      throw new Error("AIcrowd challenge page props are not JSON")
    }
    const rounds = roundsIn(props)
    const dated = rounds?.some(
      (round) =>
        typeof round === "object" && round !== null && "endDttm" in round
    )
    if (!rounds || !dated) continue
    const result = roundsSchema.safeParse(rounds)
    if (!result.success)
      throw new Error(
        `AIcrowd challenge page rounds do not fit: ${z.prettifyError(result.error)}`
      )
    return result.data
  }
  return null
}

/**
 * The listing of a running challenge. The deadlines are the ends of the rounds still ahead when its page has
 * rounds, and otherwise the end of the card's phase, which a classic page has no dates to add to. Every one is a
 * `phase` deadline, labelled with the phase's name, in UTC, and a phase end that falls in the same minute as
 * another is listed once. A challenge opens when its earliest round starts, and has no opening time when its
 * page lists no rounds.
 */
export function toListing(
  card: Card,
  rounds: Round[] | null,
  now: Date
): Listing {
  const ahead = (rounds ?? []).filter((round) =>
    endsAhead(Date.parse(round.endDttm), now)
  )
  const phases =
    ahead.length > 0
      ? ahead.map((round) => ({
          name: round.name,
          endMs: Date.parse(round.endDttm),
        }))
      : [{ name: card.phase, endMs: Date.parse(card.endsAt) }]

  const deadlines: Deadline[] = []
  for (const phase of phases.sort((a, b) => a.endMs - b.endMs))
    if (
      !deadlines.some(
        (d) => minuteOf(Date.parse(d.at)) === minuteOf(phase.endMs)
      )
    )
      deadlines.push({
        kind: "phase",
        label: cleanText(phase.name ?? undefined, 100),
        at: isoFromMs(phase.endMs),
        zone: "UTC",
      })

  const url = challengeUrl(card.slug)
  return {
    id: `aicrowd:${card.slug}`,
    source: "aicrowd",
    kind: "challenge",
    title: card.title,
    organizer: card.organizer,
    conference: null,
    url,
    sourceUrl: url,
    opensAt:
      rounds && rounds.length > 0
        ? isoFromMs(Math.min(...rounds.map((r) => Date.parse(r.startDttm))))
        : null,
    deadlines,
  }
}
