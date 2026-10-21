import type { Listing } from "../../../lib/listing.ts"
import type { Source } from "../../run.ts"
import {
  inScope,
  listingUrl,
  parseOrganizer,
  parseTasks,
  toListing,
} from "./parse.ts"

const LIST_URL = "https://aifactory.space/ko/competition"

/**
 * Open competitions on AIFactory, a Korean platform. The list page is server-rendered and holds every
 * competition with its dates; the organizer is on each competition's own page, which is fetched only for the
 * competitions that are kept.
 */
export const aifactory: Source = {
  id: "aifactory",
  async collect(client, now) {
    const tasks = parseTasks(await client.getText(LIST_URL)).filter((task) =>
      inScope(task, now)
    )
    const listings: Listing[] = []
    // One host, which the client serves one request at a time, so the page requests go in sequence.
    for (const task of tasks) {
      const organizer = parseOrganizer(
        await client.getText(listingUrl(task.id))
      )
      listings.push(toListing(task, organizer, now))
    }
    return listings
  },
}
