import { describe, expect, it } from "vitest"

import type { Listing, SourceFile } from "../lib/listing.ts"
import { BlockedError, type Client } from "./http.ts"
import { runSource, type Source } from "./run.ts"

const client: Client = {
  getText: async () => "",
  getJson: async () => ({}),
}

function listing(n: number, deadline: string): Listing {
  return {
    id: `openreview:W/${n}`,
    source: "openreview",
    kind: "cfp",
    title: `Workshop ${n}`,
    organizer: null,
    conference: { name: "NeurIPS", year: 2026 },
    url: `https://w${n}.example.org/`,
    sourceUrl: `https://openreview.net/group?id=W%2F${n}`,
    opensAt: null,
    deadlines: [{ kind: "submission", label: null, at: deadline, zone: "UTC" }],
  }
}

function source(collect: Source["collect"]): Source {
  return { id: "openreview", collect }
}

const now = new Date("2026-10-21T12:00:00.000Z")
const later = "2026-12-01T00:00:00.000Z"
const earlier = "2026-10-01T00:00:00.000Z"

function previousFile(listings: Listing[], retrievedAt: string): SourceFile {
  return { source: "openreview", retrievedAt, listings }
}

describe("runSource", () => {
  it("writes the collected listings sorted by id with the retrieval time", async () => {
    const result = await runSource({
      source: source(async () => [listing(2, later), listing(1, later)]),
      client,
      now,
      previous: null,
    })
    expect(result.outcome).toBe("updated")
    expect(result.file?.retrievedAt).toBe(now.toISOString())
    expect(result.file?.listings.map((l) => l.id)).toEqual([
      "openreview:W/1",
      "openreview:W/2",
    ])
  })

  it("fetches a source at most once in each half of the UTC day", async () => {
    let fetched = 0
    const counting = source(async () => {
      fetched += 1
      return []
    })
    const afternoon = new Date("2026-10-21T23:00:00.000Z")
    const result = await runSource({
      source: counting,
      client,
      now: afternoon,
      previous: previousFile([], "2026-10-21T12:00:00.000Z"),
    })
    expect(result.outcome).toBe("skipped")
    expect(fetched).toBe(0)
  })

  it("fetches in the afternoon after a morning run that started late", async () => {
    const result = await runSource({
      source: source(async () => [listing(1, later)]),
      client,
      now: new Date("2026-10-21T12:17:00.000Z"),
      previous: previousFile([], "2026-10-21T01:30:00.000Z"),
    })
    expect(result.outcome).toBe("updated")
  })

  it("counts a failed attempt toward the limit", async () => {
    const previous = {
      ...previousFile([], "2026-10-20T12:17:00.000Z"),
      attemptedAt: "2026-10-21T12:17:00.000Z",
    }
    const result = await runSource({
      source: source(async () => []),
      client,
      now: new Date("2026-10-21T20:00:00.000Z"),
      previous,
    })
    expect(result.outcome).toBe("skipped")
  })

  it("keeps the last good data when listings that should still be open disappear", async () => {
    const open = [1, 2, 3, 4, 5, 6].map((n) => listing(n, later))
    const result = await runSource({
      source: source(async () => [listing(1, later)]),
      client,
      now,
      previous: previousFile(open, "2026-10-20T00:00:00.000Z"),
    })
    expect(result.outcome).toBe("kept")
    expect(result.reason).toMatch(/6 .* 1/)
    // The previous listings stay, and the attempt is recorded.
    expect(result.file?.listings).toEqual(open)
    expect(result.file?.attemptedAt).toBe(now.toISOString())
  })

  it("accepts fewer listings when the missing ones have closed", async () => {
    const closed = [1, 2, 3, 4, 5, 6].map((n) => listing(n, earlier))
    const result = await runSource({
      source: source(async () => [listing(7, later)]),
      client,
      now,
      previous: previousFile(closed, "2026-10-20T00:00:00.000Z"),
    })
    expect(result.outcome).toBe("updated")
  })

  it("keeps the last good data when the source blocks the collector", async () => {
    const result = await runSource({
      source: source(async () => {
        throw new BlockedError("https://a.example/", "status 403")
      }),
      client,
      now,
      previous: null,
    })
    expect(result.outcome).toBe("kept")
    expect(result.reason).toMatch(/403/)
  })

  it("rejects a listing that does not fit the schema", async () => {
    const result = await runSource({
      source: source(async () => [
        { ...listing(1, later), url: "javascript:x" },
      ]),
      client,
      now,
      previous: null,
    })
    expect(result.outcome).toBe("kept")
    expect(result.reason).toMatch(/url/)
  })
})
