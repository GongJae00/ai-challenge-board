import { describe, expect, it } from "vitest"

import { listingSchema } from "../../../lib/listing.ts"
import type { Client } from "../../http.ts"
import list from "./fixtures/competitions-list.json"
import { zindi } from "./index.ts"

const now = new Date("2026-10-21T12:00:00Z")
const LIST_URL = "https://api.zindi.world/v1/competitions?page=0&per_page=600"

function clientFor(response: unknown) {
  const requested: string[] = []
  const client: Client = {
    getText: async () => "",
    postJson: async () => ({}),
    async getJson(url) {
      requested.push(url)
      return response
    },
  }
  return { client, requested }
}

describe("zindi", () => {
  it("lists the open competitions that need no code, from one request", async () => {
    const { client, requested } = clientFor({
      ...list,
      meta: { ...list.meta, total_count: list.data.length },
    })
    const listings = await zindi.collect(client, now, { previous: null })
    expect(listings.map((l) => l.id)).toEqual([
      "zindi:bias-bounty-mapping-equity-challenge",
      "zindi:google-waxal-asr-challenge-october-study-jam",
      "zindi:google-mumbai-data-challenge",
    ])
    expect(requested).toEqual([LIST_URL])
    for (const listing of listings)
      expect(listingSchema.safeParse(listing).success).toBe(true)
  })

  it("fails when Zindi has more competitions than one request returned", async () => {
    // The fixture's own meta counts 515 records and the fixture holds 7.
    const { client } = clientFor(list)
    await expect(
      zindi.collect(client, now, { previous: null })
    ).rejects.toThrow(/515 competitions/)
  })

  it("fails on a response that does not fit", async () => {
    const { client } = clientFor({ data: "none" })
    await expect(
      zindi.collect(client, now, { previous: null })
    ).rejects.toThrow(/does not fit/)
  })
})
