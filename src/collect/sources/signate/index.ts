import type { Listing } from "../../../lib/listing.ts"
import type { Source } from "../../run.ts"
import {
  isListed,
  isOpen,
  parseListPage,
  parseOverview,
  toListing,
  type Entry,
} from "./parse.ts"

const API = "https://api.competition.signate.jp/api/competition"
const PAGE_SIZE = 100
/** A bound on pages: the whole catalogue, 219 entries since 2018, was 3 pages when this was written. */
const MAX_PAGES = 10

/**
 * Open SIGNATE competitions. The list and the overview come from the JSON API behind SIGNATE's own site. The
 * list has no dates, so the end is read from the overview of each open entry.
 */
export const signate: Source = {
  id: "signate",
  async collect(client, now) {
    // By key, since an entry can move onto the next page between two requests.
    const candidates = new Map<string, Entry>()
    for (let page = 0, offset = 0; ; page += 1, offset += PAGE_SIZE) {
      if (page >= MAX_PAGES)
        throw new Error(`SIGNATE lists more than ${MAX_PAGES} pages`)
      const { total, entries } = parseListPage(
        await client.getJson(
          `${API}/list?fetch_count=${PAGE_SIZE}&fetch_offset=${offset}`
        )
      )
      for (const entry of entries)
        if (isListed(entry)) candidates.set(entry.publicKey, entry)
      if (entries.length === 0 || offset + PAGE_SIZE >= total) break
    }

    const listings: Listing[] = []
    for (const entry of candidates.values()) {
      const { endsAt } = parseOverview(
        await client.getJson(`${API}/${entry.publicKey}/overview`)
      )
      if (!isOpen(endsAt, now)) continue
      const listing = toListing(entry, endsAt)
      if (listing) listings.push(listing)
    }
    return listings
  },
}
