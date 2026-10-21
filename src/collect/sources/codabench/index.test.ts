import { describe, expect, it } from "vitest"

import type { Client } from "../../http.ts"
import type { SourceState } from "../../run.ts"
import finished from "./fixtures/detail-12971-finished-single-phase.json"
import multiPhase from "./fixtures/detail-18062-multi-phase-upcoming.json"
import upcoming from "./fixtures/detail-18221-upcoming-single-phase.json"
import listExcerpt from "./fixtures/list-public-excerpt.json"
import { codabench } from "./index.ts"

const now = new Date("2026-10-21T06:00:00Z")

// The list fixture is one short page; its count says the whole listing fits on it. Its titles name no
// conference, so the test gives them one, as the search would have matched.
const list = {
  ...listExcerpt,
  count: listExcerpt.results.length,
  results: listExcerpt.results.map((r) => ({
    ...r,
    title: `${r.title} (@ CVPR 2026)`,
  })),
}

/** Detail responses by competition id, borrowed from the fixtures with the id changed. */
const details: Record<number, unknown> = {
  18411: { ...multiPhase, id: 18411 },
  18381: { ...finished, id: 18381 },
  18221: upcoming,
}

function fakeClient() {
  const requested: string[] = []
  const client: Client = {
    getText: async () => "",
    postJson: async () => ({}),
    getJson: async (url) => {
      requested.push(url)
      if (url.includes("/public/")) return list
      const id = Number(/competitions\/(\d+)\/$/.exec(url)?.[1])
      return details[id]
    },
  }
  return { client, requested }
}

describe("codabench", () => {
  it("lists the open competitions and remembers which are settled and which are open", async () => {
    const { client } = fakeClient()
    const state: SourceState = { previous: null }
    const listings = await codabench.collect(client, now, state)
    expect(listings.map((l) => l.id)).toEqual([
      "codabench:18411",
      "codabench:18221",
    ])
    expect(state.next).toEqual({ settled: [18381], open: [18221, 18411] })
  })

  it("searches Codabench once for each phase-1 conference", async () => {
    const { client, requested } = fakeClient()
    await codabench.collect(client, now, { previous: null })
    const searches = requested.filter((url) => url.includes("/public/"))
    expect(searches).toHaveLength(7)
    expect(searches[0]).toContain("search=CVPR")
  })

  it("never requests a settled competition again", async () => {
    const { client, requested } = fakeClient()
    await codabench.collect(client, now, {
      previous: { settled: [18381], open: [] },
    })
    expect(requested.some((url) => url.endsWith("/18381/"))).toBe(false)
  })

  it("rechecks the open competitions before new ones", async () => {
    const { client, requested } = fakeClient()
    await codabench.collect(client, now, {
      previous: { settled: [], open: [18221] },
    })
    const detailRequests = requested.filter((url) => !url.includes("/public/"))
    expect(detailRequests[0]).toMatch(/\/18221\/$/)
  })

  it("rejects a saved state that does not fit", async () => {
    const { client } = fakeClient()
    await expect(
      codabench.collect(client, now, { previous: { settled: "x" } })
    ).rejects.toThrow()
  })
})
