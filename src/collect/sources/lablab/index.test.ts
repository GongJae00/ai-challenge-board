import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import type { Client } from "../../http.ts"
import { lablab } from "./index.ts"

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")
}

const LIST_URL = "https://lablab.ai/ai-hackathons"

/** Serves the list excerpt, or `list`, for every request. */
function fakeClient(list = fixture("list-excerpt.html")) {
  const requested: string[] = []
  const client: Client = {
    getJson: async () => ({}),
    postJson: async () => ({}),
    getText: async (url) => {
      requested.push(url)
      return list
    },
  }
  return { client, requested }
}

const state = () => ({ previous: null })

describe("lablab", () => {
  it("lists the events still ahead, each with its end deadline", async () => {
    const { client } = fakeClient()
    const listings = await lablab.collect(
      client,
      new Date("2026-10-10T00:00:00Z"),
      state()
    )
    expect(
      listings.map((l) => [l.id, l.deadlines[0].at, l.deadlines[0].zone])
    ).toEqual([
      [
        "lablab:amd-lablab-ai-academy-challenge",
        "2026-12-01T19:00:00.000Z",
        "UTC",
      ],
      ["lablab:vultr-hackathon", "2026-11-08T22:00:00.000Z", "UTC"],
      [
        "lablab:amd-developer-hackathon-act-iii",
        "2026-10-18T10:30:00.000Z",
        "Europe/Rome",
      ],
    ])
  })

  it("requests the list page once and no detail page", async () => {
    const { client, requested } = fakeClient()
    await lablab.collect(client, new Date("2026-10-10T00:00:00Z"), state())
    expect(requested).toEqual([LIST_URL])
  })

  it("returns an empty list when every event has ended", async () => {
    const { client } = fakeClient()
    const listings = await lablab.collect(
      client,
      new Date("2026-12-02T00:00:00Z"),
      state()
    )
    expect(listings).toEqual([])
  })

  it("fails when the page holds no events, so the runner keeps the last data", async () => {
    const { client } = fakeClient("<html>Access denied</html>")
    await expect(
      lablab.collect(client, new Date("2026-10-10T00:00:00Z"), state())
    ).rejects.toThrow(/no events/)
  })

  it("fails when the request fails", async () => {
    const failing: Client = {
      ...fakeClient().client,
      getText: async () => {
        throw new Error("status 500")
      },
    }
    await expect(
      lablab.collect(failing, new Date("2026-10-10T00:00:00Z"), state())
    ).rejects.toThrow(/status 500/)
  })
})
