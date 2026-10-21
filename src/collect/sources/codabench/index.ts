import { z } from "zod"

import { conferences, type Listing } from "../../../lib/listing.ts"
import type { Client } from "../../http.ts"
import type { Source } from "../../run.ts"
import {
  candidates,
  isSettled,
  parseDetail,
  parseListPage,
  toListing,
  type ListedCompetition,
} from "./parse.ts"

const API = "https://www.codabench.org/api/competitions"
const PAGE_SIZE = 100
/** A bound on pages per search: a conference's name matches a few dozen titles. */
const MAX_PAGES = 5

/**
 * Competitions not seen before that one run checks, newest first. Each needs its own request, and the client
 * spaces requests seconds apart, so a large backlog is worked through over a few runs.
 */
export const NEW_PER_RUN = 60

/**
 * What the collector remembers: competitions settled for good (finished, benchmarks, or without an end), which
 * it never requests again, and the ones it found open, which it checks again on every run.
 */
const stateSchema = z.object({
  settled: z.array(z.number().int()),
  open: z.array(z.number().int()),
})

/**
 * The competitions whose titles name a phase-1 conference, found through Codabench's title search. Anyone can
 * open a competition on Codabench, and most of its 1,500 entries are coursework and tests, so ACB takes the ones
 * that name a conference rather than all of them.
 */
async function fetchList(client: Client): Promise<ListedCompetition[]> {
  const byId = new Map<number, ListedCompetition>()
  for (const conference of conferences) {
    let seen = 0
    // Pages are built here rather than taken from `next`, which points at another host.
    for (let page = 1; ; page += 1) {
      if (page > MAX_PAGES)
        throw new Error(
          `Codabench search for ${conference} has more than ${MAX_PAGES} pages`
        )
      const query = new URLSearchParams({
        search: conference,
        page_size: String(PAGE_SIZE),
        page: String(page),
      })
      const { count, competitions } = parseListPage(
        await client.getJson(`${API}/public/?${query}`)
      )
      for (const competition of competitions)
        byId.set(competition.id, competition)
      seen += competitions.length
      if (competitions.length === 0 || seen >= count) break
    }
  }
  return [...byId.values()]
}

/** Codabench competitions that name a phase-1 conference and have a deadline ahead. */
export const codabench: Source = {
  id: "codabench",
  async collect(client, now, state) {
    const previous =
      state.previous === null
        ? { settled: [], open: [] }
        : stateSchema.parse(state.previous)
    const settled = new Set(previous.settled)
    const wasOpen = new Set(previous.open)

    const ids = candidates(await fetchList(client), now, settled, wasOpen)
    const due = [
      ...ids.filter((id) => wasOpen.has(id)),
      ...ids.filter((id) => !wasOpen.has(id)).slice(0, NEW_PER_RUN),
    ]

    const listings: Listing[] = []
    const open: number[] = []
    // One host, which the client serves one request at a time, so the detail requests go in sequence.
    for (const id of due) {
      const competition = parseDetail(await client.getJson(`${API}/${id}/`))
      const listing = toListing(competition, now)
      if (isSettled(competition, listing, now)) {
        settled.add(id)
        continue
      }
      open.push(id)
      if (listing) listings.push(listing)
    }

    state.next = {
      settled: [...settled].sort((a, b) => a - b),
      open: open.sort((a, b) => a - b),
    }
    return listings
  },
}
