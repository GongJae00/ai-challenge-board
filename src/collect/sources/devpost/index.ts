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
 * What the collector remembers: for each hackathon on the list, the dates string the list gave and the deadline
 * its calendar gave, so that the calendar is requested again only when the dates change.
 */
const stateSchema = z.array(
  z.object({
    id: z.number().int().positive(),
    dates: z.string(),
    deadline: deadlineSchema,
  })
)

/** The theme's hackathons that are open to everyone, each once. The list has no cursor and shifts as hackathons open. */
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
  return [...byId.values()].filter((h) => h.ai && !h.inviteOnly)
}

/**
 * Devpost's open and upcoming AI hackathons, except the invite-only ones. The list has only a date range as
 * display text, so each hackathon's calendar file is requested for its exact deadline in the organizer's own
 * zone, once for a hackathon that is new or whose dates changed.
 */
export const devpost: Source = {
  id: "devpost",
  async collect(client, now, state) {
    const cached = new Map(
      (state.previous === null ? [] : stateSchema.parse(state.previous)).map(
        (entry) => [entry.id, entry]
      )
    )

    const listings: Listing[] = []
    const entries: z.infer<typeof stateSchema> = []
    // Every hackathon is on its own subdomain, but they are one site, so the calendars are requested in sequence.
    for (const hackathon of await fetchList(client)) {
      let entry = cached.get(hackathon.id)
      if (entry === undefined || entry.dates !== hackathon.dates)
        entry = {
          id: hackathon.id,
          dates: hackathon.dates,
          deadline: parseCalendar(
            await client.getText(calendarUrl(hackathon)),
            `${hackathon.title} (${hackathon.id})`
          ),
        }
      entries.push(entry)
      const listing = toListing(hackathon, entry.deadline, now)
      if (listing) listings.push(listing)
    }

    state.next = entries.sort((a, b) => a.id - b.id)
    return listings
  },
}
