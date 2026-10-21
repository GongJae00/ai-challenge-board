import type { Listing } from "../../../lib/listing.ts"
import type { Source } from "../../run.ts"
import { challengeUrl, parseCards, parseRounds, toListing } from "./parse.ts"

const LIST_URL = "https://www.aicrowd.com/challenges?status=running"

/**
 * Running challenges on AIcrowd. The list page is server-rendered and holds a running card's current phase end
 * in its badge. Each running challenge's own page is read for the rounds of the newer React overview, which add
 * every phase end and the opening time; AIcrowd has few running challenges at a time, so that is a few requests.
 */
export const aicrowd: Source = {
  id: "aicrowd",
  async collect(client, now) {
    const cards = parseCards(await client.getText(LIST_URL), now)
    const listings: Listing[] = []
    // One host, which the client serves one request at a time, so the page requests go in sequence.
    for (const card of cards) {
      const rounds = parseRounds(await client.getText(challengeUrl(card.slug)))
      listings.push(toListing(card, rounds, now))
    }
    return listings
  },
}
