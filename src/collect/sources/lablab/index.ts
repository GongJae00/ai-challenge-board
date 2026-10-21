import type { Source } from "../../run.ts"
import { inScope, parseEvents, toListing } from "./parse.ts"

const LIST_URL = "https://lablab.ai/ai-hackathons"

/**
 * AI hackathons on lablab.ai. The list page is server-rendered and holds every event, past ones too, with its
 * dates, so one request serves the whole source and no event page is fetched.
 */
export const lablab: Source = {
  id: "lablab",
  async collect(client, now) {
    const events = parseEvents(await client.getText(LIST_URL))
    return events.filter((event) => inScope(event, now)).map(toListing)
  },
}
