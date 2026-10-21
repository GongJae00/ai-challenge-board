import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import type { Client } from "../../http.ts"
import { aifactory } from "./index.ts"

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")
}

const LIST_URL = "https://aifactory.space/ko/competition"
const structured = fixture("detail-9306-structured.html")
const freeText = fixture("detail-9237-freetext-organizers.html")

/** Serves the list excerpt, 9306's page for 9306, and the free-text page for every other competition. */
function fakeClient(list = fixture("list-excerpt.html")) {
  const requested: string[] = []
  const client: Client = {
    getJson: async () => ({}),
    postJson: async () => ({}),
    getText: async (url) => {
      requested.push(url)
      if (url === LIST_URL) return list
      return url.endsWith("/9306") ? structured : freeText
    },
  }
  return { client, requested }
}

const state = () => ({ previous: null })

describe("aifactory", () => {
  it("lists the competitions still ahead, with the organizer from each one's page", async () => {
    const { client } = fakeClient()
    const listings = await aifactory.collect(
      client,
      new Date("2026-09-01T00:00:00Z"),
      state()
    )
    expect(listings.map((l) => [l.id, l.organizer])).toEqual([
      ["aifactory:9306", "국립공원공단"],
      ["aifactory:9307", null],
      ["aifactory:9304", null],
      ["aifactory:9305", null],
    ])
  })

  it("requests the list once, then one page for each kept competition only", async () => {
    const { client, requested } = fakeClient()
    await aifactory.collect(client, new Date("2026-09-01T00:00:00Z"), state())
    expect(requested).toEqual([
      LIST_URL,
      "https://aifactory.space/ko/competitions/9306",
      "https://aifactory.space/ko/competitions/9307",
      "https://aifactory.space/ko/competitions/9304",
      "https://aifactory.space/ko/competitions/9305",
    ])
  })

  it("returns an empty list, with no page requests, when nothing is open", async () => {
    const { client, requested } = fakeClient()
    const listings = await aifactory.collect(
      client,
      new Date("2026-10-21T00:00:00Z"),
      state()
    )
    expect(listings).toEqual([])
    expect(requested).toEqual([LIST_URL])
  })

  it("fails when the list holds no competitions, so the runner keeps the last data", async () => {
    const { client } = fakeClient("<html>Access denied</html>")
    await expect(
      aifactory.collect(client, new Date("2026-09-01T00:00:00Z"), state())
    ).rejects.toThrow(/no competitions/)
  })

  it("fails when a page request fails", async () => {
    const { client } = fakeClient()
    const failing: Client = {
      ...client,
      getText: async (url) => {
        if (url.endsWith("/9307")) throw new Error("status 500")
        return client.getText(url)
      },
    }
    await expect(
      aifactory.collect(failing, new Date("2026-09-01T00:00:00Z"), state())
    ).rejects.toThrow(/status 500/)
  })
})
