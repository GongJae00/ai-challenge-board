import type { Source } from "../../run.ts"
import { isOpenToPublic, parseCompetitions, toListing } from "./parse.ts"

/** One request for every competition Zindi has, about 500 in 2026; `parseCompetitions` fails if they outgrow it. */
const LIST_URL = "https://api.zindi.world/v1/competitions?page=0&per_page=600"

/**
 * Open competitions and hackathons on Zindi, an African data science platform. Its list endpoint, the backend of
 * its own site, carries every field ACB stores, so no competition page is fetched.
 */
export const zindi: Source = {
  id: "zindi",
  async collect(client, now) {
    const competitions = parseCompetitions(await client.getJson(LIST_URL))
    return competitions
      .filter((competition) => isOpenToPublic(competition, now))
      .map((competition) => toListing(competition, now))
  },
}
