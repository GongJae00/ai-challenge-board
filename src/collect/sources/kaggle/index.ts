import type { Listing } from "../../../lib/listing.ts"
import type { Source } from "../../run.ts"
import { parseListPage, toListing } from "./parse.ts"

const LIST_URL =
  "https://api.kaggle.com/v1/competitions.CompetitionApiService/ListCompetitions"
/** Kaggle returns 20 competitions a page and ignores a larger page size; a shorter page is the last. */
const PAGE_SIZE = 20
/** A bound on pages: about 20 competitions are open at a time. */
const MAX_PAGES = 10

/**
 * Open Kaggle competitions, read through Kaggle's official API with a token from GongJae's account, which the
 * environment supplies as `KAGGLE_API_TOKEN` (a GitHub Actions secret in the scheduled job).
 */
export function createKaggle(token: () => string | undefined): Source {
  return {
    id: "kaggle",
    async collect(client, now) {
      const apiToken = token()?.trim()
      if (!apiToken)
        throw new Error(
          "KAGGLE_API_TOKEN is not set; Kaggle's API needs the token from GongJae's account"
        )
      // A token pasted with a line break would make fetch quote the whole header, token included, in its error.
      if (/[\s\p{Cc}]/u.test(apiToken))
        throw new Error(
          "KAGGLE_API_TOKEN holds whitespace or control characters; paste the token again"
        )
      const listings: Listing[] = []
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const { competitions } = parseListPage(
          await client.postJson(
            LIST_URL,
            {
              group: "COMPETITION_LIST_TAB_GENERAL",
              sortBy: "COMPETITION_SORT_BY_LATEST_DEADLINE",
              page,
            },
            { authorization: `Bearer ${apiToken}` }
          )
        )
        for (const competition of competitions) {
          const listing = toListing(competition, now)
          if (listing) listings.push(listing)
        }
        if (competitions.length < PAGE_SIZE) return listings
      }
      throw new Error(`Kaggle lists more than ${MAX_PAGES} pages`)
    },
  }
}

export const kaggle = createKaggle(() => process.env.KAGGLE_API_TOKEN)
