import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import type { Client } from "../../http.ts"
import { drivendata } from "./index.ts"

const LIST = "https://www.drivendata.org/competitions/"
const now = new Date("2026-10-21T12:00:00Z")
const page = readFileSync(
  new URL("./fixtures/list-excerpt.html", import.meta.url),
  "utf8"
)

function fakeClient(html: string) {
  const requested: string[] = []
  const client: Client = {
    postJson: async () => ({}),
    getJson: async () => ({}),
    getText: async (url) => {
      requested.push(url)
      return html
    },
  }
  return { client, requested }
}

describe("drivendata", () => {
  it("lists the open prize competition from the one request for the list page", async () => {
    const { client, requested } = fakeClient(page)
    const listings = await drivendata.collect(client, now, { previous: null })
    expect(listings.map((l) => [l.id, l.organizer, l.deadlines[0].at])).toEqual(
      [["drivendata:306", "DOE", "2026-12-03T23:59:00.000Z"]]
    )
    expect(listings[0].sourceUrl).toBe(LIST)
    expect(requested).toEqual([LIST])
  })

  it("lists nothing once the prize competition has ended", async () => {
    const { client, requested } = fakeClient(page)
    const listings = await drivendata.collect(
      client,
      new Date("2026-12-04T00:00:00Z"),
      { previous: null }
    )
    expect(listings).toEqual([])
    expect(requested).toEqual([LIST])
  })

  it("lists nothing when the page has no prize section but the others", async () => {
    const { client } = fakeClient(
      page.replace(/<section id="prize">[\s\S]*?<\/section>/, "")
    )
    expect(await drivendata.collect(client, now, { previous: null })).toEqual(
      []
    )
  })

  it("fails on a page that is not the competitions page, so that the last data is kept", async () => {
    const { client } = fakeClient("<html><body>Just a moment...</body></html>")
    await expect(
      drivendata.collect(client, now, { previous: null })
    ).rejects.toThrow(/DrivenData.*prize/)
  })

  it("fails on a date it cannot read, quoting it", async () => {
    const { client } = fakeClient(
      page.replace("11:59 p.m. UTC", "11:59 p.m. EST")
    )
    await expect(
      drivendata.collect(client, now, { previous: null })
    ).rejects.toThrow('"Dec. 3, 2026, 11:59 p.m. EST"')
  })

  it("fails when the request fails", async () => {
    const { client } = fakeClient(page)
    client.getText = async (url) => {
      throw new Error(`Request to ${url} failed`)
    }
    await expect(
      drivendata.collect(client, now, { previous: null })
    ).rejects.toThrow(/competitions/)
  })
})
