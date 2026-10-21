import type { Listing } from "../../../lib/listing.ts"
import type { Source } from "../../run.ts"
import { isListed, parseRacePage, toListing, type Race } from "./parse.ts"

const LIST_URL = "https://tianchi.aliyun.com/v3/proxy/competition/api/race/page"
/** The endpoint returned ten rows for `pageSize=10`; a page of that size is full, and a shorter one is not necessarily the last. */
const PAGE_SIZE = 10
/** A bound on pages: the whole catalogue, 600 rows, was 60 pages when this was written. */
const MAX_PAGES = 80
/**
 * The list is newest first only roughly, with series rows in odd places, so a page on which every row ended
 * longer ago than this has no open competition after it.
 */
const STOP_AFTER_MS = 180 * 24 * 60 * 60 * 1000

/**
 * Open Tianchi competitions. The list comes from the JSON endpoint behind tianchi.aliyun.com's own competition
 * page. Its `hasNextPage` is always false, so the pages run until one is empty or old. The detail endpoint, with
 * the stages and their deadlines, is not requested.
 */
export const tianchi: Source = {
  id: "tianchi",
  async collect(client, now) {
    // By id, since a competition can move onto the next page between two requests.
    const open = new Map<number, Race>()
    for (let pageNum = 1; ; pageNum += 1) {
      if (pageNum > MAX_PAGES)
        throw new Error(`Tianchi lists more than ${MAX_PAGES} pages`)
      const page = parseRacePage(
        await client.getJson(
          `${LIST_URL}?visualTab=&raceName=&isActive=&pageNum=${pageNum}&pageSize=${PAGE_SIZE}`
        )
      )
      if (page.length === 0) break
      for (const race of page) if (isListed(race, now)) open.set(race.id, race)
      const allLongEnded = page.every(
        (race) => Date.parse(race.endsAt) < now.getTime() - STOP_AFTER_MS
      )
      if (page.length === PAGE_SIZE && allLongEnded) break
    }

    const listings: Listing[] = []
    for (const race of open.values()) {
      const listing = toListing(race, now)
      if (listing) listings.push(listing)
    }
    return listings
  },
}
