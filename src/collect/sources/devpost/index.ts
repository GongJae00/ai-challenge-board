import { z } from "zod"

import { deadlineSchema, type Listing } from "../../../lib/listing.ts"
import type { Client } from "../../http.ts"
import type { Source } from "../../run.ts"
import {
  calendarUrl,
  parseCalendar,
  parseListPage,
  toListing,
  type ListedHackathon,
} from "./parse.ts"

/**
 * The open and upcoming hackathons that carry Devpost's Machine Learning/AI theme. The brackets, the %20, and the
 * slash are written as Devpost's own site writes them; a query string built by URLSearchParams would encode them
 * differently.
 */
const LIST_URL =
  "https://devpost.com/api/hackathons?status[]=open&status[]=upcoming&themes[]=Machine%20Learning/AI"
/** A bound on pages: 74 hackathons were open or upcoming with the theme on 9 pages of 9 when this was written. */
const MAX_PAGES = 30

/**
 * How long a saved calendar reading is trusted. A change to the time or the zone of a deadline on the same date
 * does not change the dates string on the list, so each calendar is read again after this long.
 */
export const REFRESH_AFTER_MS = 3 * 24 * 60 * 60 * 1000

/** How many calendars a run reads again only because they are old; with two runs a day, about 80 take two days. */
export const MAX_REFRESHES_PER_RUN = 20

/**
 * What the collector remembers: for each hackathon on the list, the dates string the list gave, the deadline its
 * calendar gave (null when the calendar gave none ACB can place, so that it is not requested on every run), and
 * when the calendar was read. An entry saved without that time counts as stale.
 */
const stateSchema = z.array(
  z.object({
    id: z.number().int().positive(),
    dates: z.string(),
    checkedAt: z.iso.datetime().optional(),
    deadline: deadlineSchema.nullable(),
  })
)

/**
 * The theme's online hackathons that are open to everyone, each once. The list has no cursor and shifts as
 * hackathons open.
 */
async function fetchList(client: Client): Promise<ListedHackathon[]> {
  // By id, since a hackathon can move onto the next page between two requests.
  const byId = new Map<number, ListedHackathon>()
  let seen = 0
  for (let page = 1; ; page += 1) {
    if (page > MAX_PAGES)
      throw new Error(`Devpost lists more than ${MAX_PAGES} pages`)
    const { total, hackathons } = parseListPage(
      await client.getJson(`${LIST_URL}&page=${page}`)
    )
    for (const hackathon of hackathons) byId.set(hackathon.id, hackathon)
    seen += hackathons.length
    // A page past the end answers 200 with no hackathons.
    if (hackathons.length === 0 || seen >= total) break
  }
  return [...byId.values()].filter((h) => h.ai && h.online && !h.inviteOnly)
}

/**
 * The hackathons whose saved calendar reading is past `REFRESH_AFTER_MS`, at most `limit` of them, the oldest
 * first and those never dated first of all. Age alone renews only a few calendars a run, so that readings made
 * together are not all made again together.
 */
export function staleIds(
  ids: number[],
  cached: Map<number, { checkedAt?: string }>,
  now: Date,
  limit: number
): Set<number> {
  return new Set(
    ids
      .flatMap((id) => {
        const entry = cached.get(id)
        return entry === undefined
          ? []
          : [{ id, checkedAt: entry.checkedAt ?? "" }]
      })
      .filter(
        ({ checkedAt }) =>
          checkedAt === "" ||
          now.getTime() - Date.parse(checkedAt) > REFRESH_AFTER_MS
      )
      .sort((a, b) => a.checkedAt.localeCompare(b.checkedAt))
      .slice(0, limit)
      .map(({ id }) => id)
  )
}

/**
 * Devpost's open and upcoming online AI hackathons, except the invite-only ones. The list has only a date range as
 * display text, so each hackathon's calendar file is requested for its exact deadline in the organizer's own
 * zone: when the hackathon is new, when its dates changed, and again after `REFRESH_AFTER_MS`. A hackathon whose
 * calendar gives no deadline ACB can place is not listed; if Devpost changed its calendars wholesale, the
 * runner's guard against most listings vanishing at once keeps the last data.
 */
export const devpost: Source = {
  id: "devpost",
  async collect(client, now, state) {
    const cached = new Map(
      (state.previous === null ? [] : stateSchema.parse(state.previous)).map(
        (entry) => [entry.id, entry]
      )
    )

    const hackathons = await fetchList(client)
    const stale = staleIds(
      hackathons.map((hackathon) => hackathon.id),
      cached,
      now,
      MAX_REFRESHES_PER_RUN
    )

    const listings: Listing[] = []
    const entries: z.infer<typeof stateSchema> = []
    // Every hackathon is on its own subdomain, but they are one site, so the calendars are requested in sequence.
    for (const hackathon of hackathons) {
      let entry = cached.get(hackathon.id)
      if (
        entry === undefined ||
        entry.dates !== hackathon.dates ||
        stale.has(hackathon.id)
      )
        entry = {
          id: hackathon.id,
          dates: hackathon.dates,
          checkedAt: now.toISOString(),
          deadline: parseCalendar(await client.getText(calendarUrl(hackathon))),
        }
      entries.push(entry)
      const listing = entry.deadline
        ? toListing(hackathon, entry.deadline, now)
        : null
      if (listing) listings.push(listing)
    }

    state.next = entries.sort((a, b) => a.id - b.id)
    return listings
  },
}
