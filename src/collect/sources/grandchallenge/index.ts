import type { Listing } from "../../../lib/listing.ts"
import type { Source } from "../../run.ts"
import { parseListPage, toListing } from "./parse.ts"

const LIST_URL = "https://grand-challenge.org/challenges/?status=OPEN"
/** A bound on pages: the open list was 3 pages of 40 when this was written. */
const MAX_PAGES = 10

/**
 * Open challenges on grand-challenge.org. The site's robots.txt disallows `/api/`, so only the HTML list is read,
 * and a challenge is listed only when its card states a deadline. Challenges that are opening soon state none.
 */
export const grandchallenge: Source = {
  id: "grandchallenge",
  async collect(client, now) {
    // By id, since a challenge can move onto the next page between two requests.
    const listings = new Map<string, Listing>()
    for (let page = 1; ; page += 1) {
      if (page > MAX_PAGES)
        throw new Error(`Grand Challenge lists more than ${MAX_PAGES} pages`)
      // One host, which the client serves one request at a time, so the pages go in sequence.
      const { cards, last } = parseListPage(
        await client.getText(`${LIST_URL}&page=${page}`)
      )
      for (const card of cards) {
        const listing = toListing(card, now)
        if (listing && !listings.has(listing.id))
          listings.set(listing.id, listing)
      }
      if (last) return [...listings.values()]
    }
  },
}
