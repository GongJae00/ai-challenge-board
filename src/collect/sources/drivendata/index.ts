import type { Source } from "../../run.ts"
import { isOpen, LIST_URL, parseCompetitionsPage, toListing } from "./parse.ts"

/**
 * Open DrivenData prize competitions, read from the server-rendered competitions page. One request gives every
 * card with its host, link, and exact end, so no competition's own page is fetched.
 */
export const drivendata: Source = {
  id: "drivendata",
  async collect(client, now) {
    return parseCompetitionsPage(await client.getText(LIST_URL))
      .filter((competition) => isOpen(competition, now))
      .map(toListing)
  },
}
