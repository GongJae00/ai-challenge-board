import { describe, expect, it } from "vitest"

import type { Client } from "../../http.ts"
import page1 from "./fixtures/list-page1.json"
import page50 from "./fixtures/list-page-offset50.json"
import overviewOpen from "./fixtures/overview-open.json"
import { signate } from "./index.ts"

const now = new Date("2026-10-21T12:00:00Z")
const API = "https://api.competition.signate.jp/api/competition"
const LIST = `${API}/list?fetch_count=100&fetch_offset=`
const OPEN_KEY = "42024ceef5064aa6a7f463aac3f26fc2"

type Raw = (typeof page1.competition_list)[number]
const [preOpen, openEntry] = page1.competition_list

const list = (entries: Raw[], total = 219) => ({
  total_count: total,
  competition_list: entries,
})
/** A closed entry with the given key. */
const closed = (key: string): Raw => ({
  ...page50.competition_list[0],
  public_key: key,
})

function fakeClient(
  pages: Record<number, unknown>,
  overview: (key: string) => unknown = () => overviewOpen
) {
  const requested: string[] = []
  const client: Client = {
    postJson: async () => ({}),
    getText: async () => "",
    getJson: async (url) => {
      requested.push(url)
      if (url.startsWith(LIST)) {
        const offset = Number(url.slice(LIST.length))
        return pages[offset] ?? list([])
      }
      return overview(url.slice(`${API}/`.length, -"/overview".length))
    },
  }
  return { client, requested }
}

describe("signate", () => {
  it("lists the open entry with its deadline from the overview, and no other", async () => {
    const { client, requested } = fakeClient({ 0: page1, 100: page50 })
    const listings = await signate.collect(client, now, { previous: null })
    expect(listings.map((l) => [l.id, l.organizer])).toEqual([
      [`signate:${OPEN_KEY}`, "防衛装備庁"],
    ])
    expect(listings[0].deadlines).toEqual([
      {
        kind: "submission",
        label: null,
        at: "2026-12-18T14:59:00.000Z",
        zone: "JST",
      },
    ])
    expect(requested).toEqual([
      `${LIST}0`,
      `${LIST}100`,
      `${LIST}200`,
      `${API}/${OPEN_KEY}/overview`,
    ])
  })

  it("pages by 100 until the offset reaches the total, and asks for no overview of an entry the list rules out", async () => {
    const { client, requested } = fakeClient({
      0: list([preOpen, closed("a1")], 250),
      100: list([closed("a2")], 250),
      200: list([closed("a3")], 250),
    })
    expect(await signate.collect(client, now, { previous: null })).toEqual([])
    expect(requested).toEqual([`${LIST}0`, `${LIST}100`, `${LIST}200`])
  })

  it("stops after one request when the total fits on the first page", async () => {
    const { client, requested } = fakeClient({ 0: list([openEntry], 40) })
    await signate.collect(client, now, { previous: null })
    expect(requested).toEqual([`${LIST}0`, `${API}/${OPEN_KEY}/overview`])
  })

  it("requests one overview for an entry listed on two pages", async () => {
    const { client, requested } = fakeClient({
      0: list([openEntry], 150),
      100: list([openEntry], 150),
    })
    const listings = await signate.collect(client, now, { previous: null })
    expect(listings).toHaveLength(1)
    expect(requested.filter((url) => url.endsWith("/overview"))).toHaveLength(1)
  })

  it("drops an open entry whose overview has no deadline or one that has passed", async () => {
    const other = { ...openEntry, public_key: "b".repeat(32) }
    const { client } = fakeClient({ 0: list([openEntry, other], 2) }, (key) =>
      key === OPEN_KEY
        ? { ...overviewOpen, deadline_at: null }
        : { ...overviewOpen, deadline_at: "2026-09-01T23:59:00.000000+09:00" }
    )
    expect(await signate.collect(client, now, { previous: null })).toEqual([])
  })

  it("stops at an empty page before the total", async () => {
    const { client, requested } = fakeClient({ 0: list([openEntry], 500) })
    await signate.collect(client, now, { previous: null })
    expect(requested.filter((url) => url.startsWith(LIST))).toEqual([
      `${LIST}0`,
      `${LIST}100`,
    ])
  })

  it("fails when the list runs past 10 pages", async () => {
    const pages = Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => [
        i * 100,
        list([closed(`k${i}`)], 5000),
      ])
    )
    const { client, requested } = fakeClient(pages)
    await expect(
      signate.collect(client, now, { previous: null })
    ).rejects.toThrow(/SIGNATE.*10 pages/)
    expect(requested).toHaveLength(10)
  })

  it("fails on a list response that does not fit, naming SIGNATE", async () => {
    const { client } = fakeClient({ 0: { competition_list: [] } })
    await expect(
      signate.collect(client, now, { previous: null })
    ).rejects.toThrow(/SIGNATE list/)
  })

  it("fails on a malformed deadline, so that the last data is kept", async () => {
    const { client } = fakeClient({ 0: page1 }, () => ({
      ...overviewOpen,
      deadline_at: "2026-12-18 23:59",
    }))
    await expect(
      signate.collect(client, now, { previous: null })
    ).rejects.toThrow(/SIGNATE overview/)
  })

  it("fails when an overview request fails, so that the last data is kept", async () => {
    const { client } = fakeClient({ 0: page1 }, (key) => {
      throw new Error(`Request for ${key} failed`)
    })
    await expect(
      signate.collect(client, now, { previous: null })
    ).rejects.toThrow(OPEN_KEY)
  })
})
