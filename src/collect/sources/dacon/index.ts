import type { Listing } from "../../../lib/listing.ts"
import type { Source } from "../../run.ts"
import { ENDED_LONG_AGO_MS } from "../../time.ts"
import {
  competitionUrl,
  isOpen,
  parseListPage,
  parseOrganizer,
  toListing,
  type Competition,
} from "./parse.ts"

const LIST_URL = "https://app.dacon.io/api/v1/competition/list"
/** DACON lists 15 competitions a page, and a shorter page is the last. */
const PAGE_SIZE = 15
/** A bound on pages: the whole catalogue, 324 competitions since 2018, was 22 pages when this was written. */
const MAX_PAGES = 30

/**
 * Open DACON competitions. The list comes from the JSON endpoint behind dacon.io's own competitions page. The
 * organizer is only on each competition's page, so that is read for the open ones.
 */
export const dacon: Source = {
  id: "dacon",
  async collect(client, now) {
    // By id, since a competition can move onto the next page between two requests.
    const open = new Map<number, Competition>()
    for (let offset = 0; ; offset += 1) {
      if (offset >= MAX_PAGES)
        throw new Error(`DACON lists more than ${MAX_PAGES} pages`)
      const page = parseListPage(
        await client.getJson(`${LIST_URL}?offset=${offset}&range=`)
      )
      for (const competition of page)
        if (isOpen(competition, now)) open.set(competition.id, competition)
      const allLongEnded = page.every(
        (competition) =>
          Date.parse(competition.endsAt) < now.getTime() - ENDED_LONG_AGO_MS
      )
      if (page.length < PAGE_SIZE || allLongEnded) break
    }

    const listings: Listing[] = []
    for (const competition of open.values()) {
      // A series landing page lives at an address no open competition has shown yet, so it is not requested.
      const organizer = competition.landing
        ? null
        : parseOrganizer(await client.getText(competitionUrl(competition)))
      const listing = toListing(competition, organizer)
      if (listing) listings.push(listing)
    }
    return listings
  },
}
