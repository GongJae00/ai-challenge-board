import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import type { Client } from "../../http.ts"
import { grandchallenge } from "./index.ts"

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")
}

const now = new Date("2026-10-21T13:00:00Z")
const OPEN = "https://grand-challenge.org/challenges/?status=OPEN"
const pages = [1, 2, 3].map((n) => fixture(`list-open-page${n}.html`))

/** Serves the given pages by the `page` parameter, and the fallback for any page past them. */
function fakeClient(served: string[], fallback = "") {
  const requested: string[] = []
  const client: Client = {
    getJson: async () => ({}),
    postJson: async () => ({}),
    getText: async (url) => {
      requested.push(url)
      const page = Number(new URL(url).searchParams.get("page") ?? 1)
      return served[page - 1] ?? fallback
    },
  }
  return { client, requested }
}

const state = () => ({ previous: null })

describe("grandchallenge", () => {
  it("lists the open challenges with a phase deadline ahead, from every page", async () => {
    const { client } = fakeClient(pages)
    const listings = await grandchallenge.collect(client, now, state())
    expect(listings.map((l) => l.id)).toEqual([
      "grandchallenge:owl",
      "grandchallenge:prisma24",
    ])
  })

  it("requests the open pages in order up to the last, and nothing else", async () => {
    const { client, requested } = fakeClient(pages)
    await grandchallenge.collect(client, now, state())
    expect(requested).toEqual([
      `${OPEN}&page=1`,
      `${OPEN}&page=2`,
      `${OPEN}&page=3`,
    ])
  })

  it("stops after one page when it is the last", async () => {
    const { client, requested } = fakeClient([pages[2]])
    const listings = await grandchallenge.collect(client, now, state())
    expect(listings).toEqual([])
    expect(requested).toEqual([`${OPEN}&page=1`])
  })

  it("lists a challenge once when it moves onto the next page between requests", async () => {
    const { client } = fakeClient([pages[0], pages[0], pages[2]])
    const listings = await grandchallenge.collect(client, now, state())
    expect(listings.map((l) => l.id)).toEqual([
      "grandchallenge:owl",
      "grandchallenge:prisma24",
    ])
  })

  it("lists nothing when the deadlines have passed", async () => {
    const { client } = fakeClient(pages)
    const later = new Date("2027-01-01T00:00:00Z")
    expect(await grandchallenge.collect(client, later, state())).toEqual([])
  })

  it("fails when the pages run past 10 without a last one", async () => {
    // Page 2 has a live Next link, so served for every page it never ends.
    const { client, requested } = fakeClient([], pages[1])
    await expect(grandchallenge.collect(client, now, state())).rejects.toThrow(
      /Grand Challenge.*10 pages/
    )
    expect(requested).toHaveLength(10)
  })

  it("fails on a page without the UTC marker, so that the last data is kept", async () => {
    const bad = pages[2].replace(/<script id="currentTimezone".*<\/script>/, "")
    const { client } = fakeClient([pages[0], bad])
    await expect(grandchallenge.collect(client, now, state())).rejects.toThrow(
      /currentTimezone/
    )
  })

  it("fails on a response that is not a list page", async () => {
    const { client } = fakeClient(["<html><body>Blocked</body></html>"])
    await expect(grandchallenge.collect(client, now, state())).rejects.toThrow(
      /Grand Challenge/
    )
  })

  it("fails when a request fails", async () => {
    const { client } = fakeClient(pages)
    client.getText = async (url) => {
      throw new Error(`Request to ${url} failed`)
    }
    await expect(grandchallenge.collect(client, now, state())).rejects.toThrow(
      /Request to/
    )
  })
})
