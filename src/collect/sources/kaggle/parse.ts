import { z } from "zod"

import { minuteOf } from "../../../lib/datetime.ts"
import type { Deadline, Listing } from "../../../lib/listing.ts"
import { cleanText, webUrl } from "../../text.ts"
import { endsAhead, isoFromMs } from "../../time.ts"

const instant = z.iso.datetime()

/** Kaggle's tutorial competitions, open all the time with no prize; not a time-bound challenge. */
const GETTING_STARTED = "Getting Started"

// Kaggle leaves a field out when it is empty, so every field but the id and the title is optional.
const listPage = z.object({
  competitions: z.array(
    z.object({
      id: z.number().int().positive(),
      title: z.string(),
      url: z.string().optional(),
      organizationName: z.string().optional(),
      hostName: z.string().optional(),
      category: z.string().optional(),
      enabledDate: instant.optional(),
      newEntrantDeadline: instant.optional(),
      mergerDeadline: instant.optional(),
      deadline: instant.optional(),
    })
  ),
})

export type Competition = z.infer<typeof listPage>["competitions"][number]

export function parseListPage(json: unknown): { competitions: Competition[] } {
  const result = listPage.safeParse(json)
  if (!result.success)
    throw new Error(
      `Kaggle list response does not fit: ${z.prettifyError(result.error)}`
    )
  return result.data
}

/**
 * The listing of a time-bound competition whose final deadline is ahead, or null. Kaggle gives every date as an
 * instant in UTC, and a competition's page usually states its deadlines at 23:59 UTC. The entry and team merger
 * deadlines come first when they are still ahead and fall before the final deadline; a merger deadline at the
 * same moment as the entry deadline is left out as a repeat.
 */
export function toListing(competition: Competition, now: Date): Listing | null {
  if (competition.category === GETTING_STARTED || !competition.deadline)
    return null
  const final = Date.parse(competition.deadline)
  if (!endsAhead(final, now)) return null
  const title = cleanText(competition.title, 300)
  const url = webUrl(competition.url)
  if (title === null || url === null) return null

  const entry = competition.newEntrantDeadline
    ? Date.parse(competition.newEntrantDeadline)
    : null
  const merger = competition.mergerDeadline
    ? Date.parse(competition.mergerDeadline)
    : null
  const before = (at: number | null): at is number =>
    at !== null && at > now.getTime() && minuteOf(at) < minuteOf(final)
  const deadlines: Deadline[] = []
  if (before(entry))
    deadlines.push({
      kind: "entry",
      label: null,
      at: isoFromMs(entry),
      zone: "UTC",
    })
  if (
    before(merger) &&
    (entry === null || minuteOf(merger) !== minuteOf(entry))
  )
    deadlines.push({
      kind: "merger",
      label: null,
      at: isoFromMs(merger),
      zone: "UTC",
    })
  deadlines.sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
  deadlines.push({
    kind: "submission",
    label: null,
    at: isoFromMs(final),
    zone: "UTC",
  })

  return {
    id: `kaggle:${competition.id}`,
    source: "kaggle",
    kind: "challenge",
    title,
    organizer: cleanText(
      competition.organizationName ?? competition.hostName,
      200
    ),
    conference: null,
    url,
    sourceUrl: url,
    opensAt: competition.enabledDate
      ? isoFromMs(Date.parse(competition.enabledDate))
      : null,
    deadlines,
  }
}
