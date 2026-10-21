import type { Listing } from "../../../lib/listing.ts"
import type { Source } from "../../run.ts"
import {
  cardCount,
  challengeUrl,
  parseCards,
  parseRounds,
  toListing,
  type Card,
} from "./parse.ts"

const LIST_URL = "https://www.aicrowd.com/challenges?status=running"
/** Cards on a full list page; a page with fewer is the last. */
const PAGE_SIZE = 18
/** A bound on pages: one page held every running challenge when this was written. */
const MAX_PAGES = 5

/**
 * Running challenges on AIcrowd. The list page is server-rendered and holds a running card's current phase end
 * in its badge. Each running challenge's own page is read for the rounds of the newer React overview, which add
 * every phase end and the opening time; AIcrowd has few running challenges at a time, so that is a few requests.
 */
export const aicrowd: Source = {
  id: "aicrowd",
  async collect(client, now) {
    // By slug, since a challenge can move onto the next page between two requests.
    const cards = new Map<string, Card>()
    for (let page = 1; ; page += 1) {
      if (page > MAX_PAGES)
        throw new Error(`AIcrowd lists more than ${MAX_PAGES} pages`)
      const html = await client.getText(
        page === 1 ? LIST_URL : `${LIST_URL}&page=${page}`
      )
      for (const card of parseCards(html, now)) cards.set(card.slug, card)
      if (cardCount(html) < PAGE_SIZE) break
    }
    const listings: Listing[] = []
    // One host, which the client serves one request at a time, so the page requests go in sequence.
    for (const card of cards.values()) {
      const rounds = parseRounds(await client.getText(challengeUrl(card.slug)))
      listings.push(toListing(card, rounds, now))
    }
    return listings
  },
}
