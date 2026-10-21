import { describe, expect, it } from "vitest"

import { listingSchema } from "../../../lib/listing.ts"
import type { Client } from "../../http.ts"
import challengesFuture from "./fixtures/challenges-future.json"
import challengesPast from "./fixtures/challenges-past-page1.json"
import challengesPresent from "./fixtures/challenges-present.json"
import phases2680 from "./fixtures/phases-2680.json"
import phases2703 from "./fixtures/phases-2703.json"
import { evalai } from "./index.ts"

const now = new Date("2026-10-21T06:00:00Z")
const API = "https://eval.ai/api/challenges/challenge"

function clientFor(responses: Record<string, unknown>) {
  const requested: string[] = []
  const client: Client = {
    getText: async () => "",
    postJson: async () => ({}),
    async getJson(url) {
      requested.push(url)
      if (!(url in responses)) throw new Error(`Unexpected request: ${url}`)
      return responses[url]
    },
  }
  return { client, requested }
}

const lists = {
  [`${API}/present/approved/public`]: challengesPresent,
  [`${API}/future/approved/public`]: challengesFuture,
}

describe("evalai", () => {
  it("lists the open time-bound challenges and asks for phases only of those", async () => {
    const { client, requested } = clientFor({
      ...lists,
      [`${API}/2703/challenge_phase`]: phases2703,
      [`${API}/2680/challenge_phase`]: phases2680,
    })
    const listings = await evalai.collect(client, now, { previous: null })
    expect(listings.map((l) => l.id)).toEqual(["evalai:2703", "evalai:2680"])
    expect(requested).toEqual([
      `${API}/present/approved/public`,
      `${API}/future/approved/public`,
      `${API}/2703/challenge_phase`,
      `${API}/2680/challenge_phase`,
    ])
    for (const listing of listings)
      expect(listingSchema.safeParse(listing).success).toBe(true)
  })

  it("follows the next link of a list", async () => {
    const next = `${API}/present/approved/public?page=2`
    const { client, requested } = clientFor({
      ...lists,
      [`${API}/present/approved/public`]: { ...challengesPast, next },
      [next]: { ...challengesPresent, results: [] },
    })
    expect(await evalai.collect(client, now, { previous: null })).toEqual([])
    expect(requested.slice(0, 2)).toEqual([
      `${API}/present/approved/public`,
      next,
    ])
  })

  it("stops with an error that names a next link on another host", async () => {
    const next = "https://evil.example.org/api/challenges?page=2"
    const { client, requested } = clientFor({
      ...lists,
      [`${API}/present/approved/public`]: { ...challengesPresent, next },
    })
    await expect(
      evalai.collect(client, now, { previous: null })
    ).rejects.toThrow(next)
    expect(requested).toEqual([`${API}/present/approved/public`])
  })

  it("stops on a list that never ends", async () => {
    const loop = `${API}/present/approved/public?page=2`
    const { client } = clientFor({
      ...lists,
      [`${API}/present/approved/public`]: { ...challengesPast, next: loop },
      [loop]: { ...challengesPast, next: loop },
    })
    await expect(
      evalai.collect(client, now, { previous: null })
    ).rejects.toThrow(/more than/)
  })

  it("rejects a response that does not parse, saying what is wrong", async () => {
    const { client } = clientFor({
      ...lists,
      [`${API}/present/approved/public`]: { detail: "Server is busy." },
    })
    await expect(
      evalai.collect(client, now, { previous: null })
    ).rejects.toThrow(/EvalAI challenges response does not fit/)
  })

  it("rejects a phases response that does not parse", async () => {
    const { client } = clientFor({
      ...lists,
      [`${API}/2703/challenge_phase`]: { results: "none", next: null },
      [`${API}/2680/challenge_phase`]: phases2680,
    })
    await expect(
      evalai.collect(client, now, { previous: null })
    ).rejects.toThrow(/EvalAI phases response does not fit/)
  })
})
