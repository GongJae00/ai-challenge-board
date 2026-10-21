import type { Conference, Listing } from "../../../lib/listing.ts"
import type { Client } from "../../http.ts"
import type { Source } from "../../run.ts"
import { parseGroups, parseInvitations, toListings } from "./parse.ts"

const API = "https://api2.openreview.net"

/** The OpenReview group under which each conference keeps its workshop venues for a year. */
const WORKSHOP_PARENTS: Record<Conference, (year: number) => string> = {
  NeurIPS: (year) => `NeurIPS.cc/${year}/Workshop`,
  ICML: (year) => `ICML.cc/${year}/Workshop`,
  ICLR: (year) => `ICLR.cc/${year}/Workshop`,
  AAAI: (year) => `AAAI.org/${year}/Workshop`,
  CVPR: (year) => `thecvf.com/CVPR/${year}/Workshop`,
  ICCV: (year) => `thecvf.com/ICCV/${year}/Workshop`,
  ECCV: (year) => `thecvf.com/ECCV/${year}/Workshop`,
}

/** Submission ids per invitations request, which keeps the URL to a few kilobytes. */
const IDS_PER_REQUEST = 50

async function collectConference(
  client: Client,
  conference: Conference,
  year: number,
  now: Date
): Promise<Listing[]> {
  const parent = WORKSHOP_PARENTS[conference](year)
  const groups = parseGroups(
    await client.getJson(
      `${API}/groups?${new URLSearchParams({ parent, limit: "1000" })}`
    )
  )
  const ids = groups.flatMap((g) => (g.submissionId ? [g.submissionId] : []))
  const invitations = []
  for (let i = 0; i < ids.length; i += IDS_PER_REQUEST) {
    const chunk = ids.slice(i, i + IDS_PER_REQUEST)
    // expired=true also returns closed calls; without it the API rejects the request if any call has closed.
    const query = new URLSearchParams({
      ids: chunk.join(","),
      expired: "true",
      limit: "1000",
    })
    invitations.push(
      ...parseInvitations(await client.getJson(`${API}/invitations?${query}`))
    )
  }
  return toListings({ groups, invitations, conference, year, now })
}

/** Workshop paper calls of the major conferences, this year's and next year's. */
export const openreview: Source = {
  id: "openreview",
  async collect(client, now) {
    const year = now.getUTCFullYear()
    const listings: Listing[] = []
    // One host, which the client serves one request at a time, so the conferences go in sequence.
    for (const conference of Object.keys(WORKSHOP_PARENTS) as Conference[])
      for (const y of [year, year + 1])
        listings.push(...(await collectConference(client, conference, y, now)))
    return listings
  },
}
