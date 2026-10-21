import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import type { Client } from "../../http.ts"
import { aicrowd } from "./index.ts"

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")
}

const LIST = "https://www.aicrowd.com/challenges?status=running"
const ARC =
  "https://www.aicrowd.com/challenges/arc-white-box-estimation-challenge-2026"
const CHESS = "https://www.aicrowd.com/challenges/global-chess-challenge-2025"
const list = fixture("list-page1.html")
const react = fixture("challenge-react-running.html")
const classic = fixture("challenge-classic-completed.html")

const now = new Date("2026-10-21T12:30:00Z")
const state = () => ({ previous: null })

/** The list with the Global Chess card running until 2026-11-30, as a classic challenge's card would show. */
const withClassicRunning = list
  .replace('title=""', 'title="2026-11-30 23:59:00 UTC"')
  .replace("Round 2: Completed", "Round 2: 40 days left")

function fakeClient(pages: Record<string, string>, listHtml = list) {
  const requested: string[] = []
  const client: Client = {
    getJson: async () => ({}),
    postJson: async () => ({}),
    getText: async (url) => {
      requested.push(url)
      if (url === LIST) return listHtml
      const page = pages[url]
      if (page === undefined) throw new Error(`Request to ${url} failed`)
      return page
    },
  }
  return { client, requested }
}

describe("aicrowd", () => {
  it("lists the running challenge with the dates from its page, requesting the running list and then that page", async () => {
    const { client, requested } = fakeClient({ [ARC]: react })
    const listings = await aicrowd.collect(client, now, state())
    expect(requested).toEqual([LIST, ARC])
    expect(listings).toHaveLength(1)
    expect(listings[0]).toMatchObject({
      id: "aicrowd:arc-white-box-estimation-challenge-2026",
      organizer: "Alignment Research Center",
      opensAt: "2026-05-28T00:00:00.000Z",
      deadlines: [
        {
          kind: "phase",
          label: "Phase 2",
          at: "2026-10-21T23:59:00.000Z",
          zone: "UTC",
        },
      ],
    })
  })

  it("lists every round still ahead", async () => {
    const { client } = fakeClient({ [ARC]: react })
    const early = new Date("2026-08-01T00:00:00Z")
    const [listing] = await aicrowd.collect(client, early, state())
    expect(listing.deadlines.map((d) => d.label)).toEqual([
      "Phase 1",
      "Phase 2",
    ])
  })

  it("keeps the card's deadline for a classic page and leaves opensAt empty", async () => {
    const { client, requested } = fakeClient(
      { [ARC]: react, [CHESS]: classic },
      withClassicRunning
    )
    const listings = await aicrowd.collect(client, now, state())
    expect(requested).toEqual([LIST, ARC, CHESS])
    const chess = listings.find(
      (l) => l.id === "aicrowd:global-chess-challenge-2025"
    )
    expect(chess).toMatchObject({
      organizer: "AIcrowd, AGI House",
      opensAt: null,
      deadlines: [
        {
          kind: "phase",
          label: "Round 2",
          at: "2026-11-30T23:59:00.000Z",
          zone: "UTC",
        },
      ],
    })
  })

  it("requests no challenge page when nothing is running", async () => {
    const { client, requested } = fakeClient(
      {},
      fixture("list-starting-soon.html")
    )
    expect(await aicrowd.collect(client, now, state())).toEqual([])
    expect(requested).toEqual([LIST])
  })

  it("fails on a list with no cards, so that the last data is kept", async () => {
    const { client } = fakeClient({}, "<html></html>")
    await expect(aicrowd.collect(client, now, state())).rejects.toThrow(
      /AIcrowd/
    )
  })

  it("reads the next list page after a full one", async () => {
    const full = `<div id="challenges-div">${'<div class="card card-challenge"></div>'.repeat(18)}</div>`
    const requested: string[] = []
    const client: Client = {
      getJson: async () => ({}),
      postJson: async () => ({}),
      getText: async (url) => {
        requested.push(url)
        if (url === LIST) return full
        if (url === `${LIST}&page=2`) return list
        if (url === ARC) return react
        throw new Error(`Request to ${url} failed`)
      },
    }
    const listings = await aicrowd.collect(client, now, state())
    expect(requested.slice(0, 2)).toEqual([LIST, `${LIST}&page=2`])
    expect(listings.map((l) => l.id)).toEqual([
      "aicrowd:arc-white-box-estimation-challenge-2026",
    ])
  })

  it("fails when a challenge page request fails", async () => {
    const { client } = fakeClient({})
    await expect(aicrowd.collect(client, now, state())).rejects.toThrow(
      /arc-white-box/
    )
  })
})
