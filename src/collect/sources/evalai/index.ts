import type { Listing } from "../../../lib/listing.ts"
import type { Client } from "../../http.ts"
import type { Source } from "../../run.ts"
import {
  isOpenTimeBound,
  parseChallengePage,
  parsePhasePage,
  toListing,
  type Challenge,
  type Phase,
} from "./parse.ts"

const API = "https://eval.ai/api/challenges/challenge"

/** The challenges that have started and the ones that have not, approved and public. Past ones are not listed. */
const LISTS = [
  `${API}/present/approved/public`,
  `${API}/future/approved/public`,
]

/** Pages per list. EvalAI serves 150 challenges a page and has fewer than 20 open ones, so this is never reached. */
const MAX_PAGES = 10

async function collectPages<T>(
  client: Client,
  first: string,
  readPage: (json: unknown) => { items: T[]; next: string | null }
): Promise<T[]> {
  const items: T[] = []
  let url: string | null = first
  for (let page = 1; url !== null; page += 1) {
    if (page > MAX_PAGES)
      throw new Error(`EvalAI list ${first} has more than ${MAX_PAGES} pages`)
    const result = readPage(await client.getJson(url))
    items.push(...result.items)
    url = result.next
  }
  return items
}

async function fetchChallenges(client: Client): Promise<Challenge[]> {
  const byId = new Map<number, Challenge>()
  for (const list of LISTS)
    for (const challenge of await collectPages(client, list, (json) => {
      const { challenges, next } = parseChallengePage(json)
      return { items: challenges, next }
    }))
      byId.set(challenge.id, challenge)
  return [...byId.values()]
}

function fetchPhases(client: Client, id: number): Promise<Phase[]> {
  return collectPages(client, `${API}/${id}/challenge_phase`, (json) => {
    const { phases, next } = parsePhasePage(json)
    return { items: phases, next }
  })
}

/** Time-bound challenges on EvalAI that have not ended, with the end of each public phase. */
export const evalai: Source = {
  id: "evalai",
  async collect(client, now) {
    const open = (await fetchChallenges(client)).filter((c) =>
      isOpenTimeBound(c, now)
    )
    const listings: Listing[] = []
    // One host, which the client serves one request at a time, so the phase requests go in sequence.
    for (const challenge of open)
      listings.push(
        toListing(challenge, await fetchPhases(client, challenge.id), now)
      )
    return listings
  },
}
