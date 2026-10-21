import { z } from "zod"

import {
  canonicalZone,
  deadlineSchema,
  type Listing,
} from "../../../lib/listing.ts"
import { flightText, jsonAt } from "../../flight.ts"
import { cleanText } from "../../text.ts"
import { endsAhead, isoFromMs } from "../../time.ts"

const instant = z.iso.datetime()

/**
 * lablab's list entry for a hackathon, with the keys ACB stores. The page carries about a hundred keys for each
 * event, which are ignored. `description` is also left out: it is sometimes a reference such as "$24" to a text
 * row of the page, not a string.
 */
const eventSchema = z.object({
  name: z.string(),
  slug: z.string().regex(/^[^\s/?#]+$/),
  startAt: instant,
  endAt: instant,
  /** The IANA zone the organizers chose; null on almost every event. */
  timezone: deadlineSchema.shape.zone.nullable(),
})

export type LablabEvent = z.infer<typeof eventSchema>

// The page is a server-rendered Next.js page; `src/collect/flight.ts` reads the data it ships.
const EVENTS_KEY = '"sortedEvents":'

/** Every event's end, which says whether the rest of the event matters. */
const endSchema = z.object({ endAt: instant })

/**
 * The hackathons on the list page that end after `now`, each once. The list always includes past events, so an
 * empty or missing one means the page's format has changed, and fails; so does an event ending ahead whose other
 * fields do not fit. An event that has ended, or whose end does not read, cannot be listed and is not read
 * further, so that one old entry in an odd shape does not stop the source; were every end to stop reading, the
 * runner's guard against most listings vanishing at once would keep the last data.
 */
export function parseEvents(html: string, now: Date): LablabEvent[] {
  const text = flightText(html)
  const at = text.indexOf(EVENTS_KEY)
  const found =
    at === -1 ? [] : jsonAt(text, at + EVENTS_KEY.length, "lablab event list")
  if (!Array.isArray(found) || found.length === 0)
    throw new Error("lablab list page holds no events")
  const bySlug = new Map<string, LablabEvent>()
  for (const item of found) {
    const end = endSchema.safeParse(item)
    if (!end.success || Date.parse(end.data.endAt) <= now.getTime()) continue
    const result = eventSchema.safeParse(item)
    if (!result.success)
      throw new Error(
        `lablab event does not fit: ${z.prettifyError(result.error)}`
      )
    if (!bySlug.has(result.data.slug)) bySlug.set(result.data.slug, result.data)
  }
  return [...bySlug.values()]
}

/** The event's page, which the listing links to and takes its facts from. */
export function listingUrl(slug: string): string {
  return `https://lablab.ai/ai-hackathons/${slug}`
}

/**
 * Whether the event ends after now, as ACB lists them. An end that does not come after the start is an entry
 * error, such as one event whose end is a fortnight before its start, so the event is left out.
 */
export function inScope(event: LablabEvent, now: Date): boolean {
  const start = Date.parse(event.startAt)
  const end = Date.parse(event.endAt)
  return (
    end > start && endsAhead(end, now) && cleanText(event.name, 300) !== null
  )
}

/**
 * The listing of an event that is in scope. lablab gives exact instants, so the deadline is the end instant
 * unchanged, in the zone the organizers chose when the event has one and in UTC otherwise. The organizer is
 * empty: the page has no field for it, and the sponsor appears only in the description's prose.
 */
export function toListing(event: LablabEvent): Listing {
  const title = cleanText(event.name, 300)
  if (title === null) throw new Error(`lablab event ${event.slug} has no title`)
  const url = listingUrl(event.slug)
  return {
    id: `lablab:${event.slug}`,
    source: "lablab",
    kind: "challenge",
    title,
    organizer: null,
    conference: null,
    url,
    sourceUrl: url,
    opensAt: isoFromMs(Date.parse(event.startAt)),
    deadlines: [
      {
        kind: "end",
        label: null,
        at: isoFromMs(Date.parse(event.endAt)),
        zone: canonicalZone(event.timezone ?? "UTC"),
      },
    ],
  }
}
