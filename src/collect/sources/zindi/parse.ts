import { z } from "zod"

import { minuteOf } from "../../../lib/datetime.ts"
import type { Deadline, Listing } from "../../../lib/listing.ts"
import { cleanText } from "../../text.ts"
import { endsAhead, isoFromMs } from "../../time.ts"

const instant = z.iso.datetime()

/** A competition in the list response. Zindi's list carries every field ACB stores. */
const competitionSchema = z.object({
  // A slug, which the page address and the listing id are built from.
  id: z.string().regex(/^[A-Za-z0-9_-]+$/),
  title: z.string().refine((t) => cleanText(t, 300) !== null, "is blank"),
  organization: z.string().nullable(),
  // True for a competition that is running and for one that has not started.
  open: z.boolean(),
  secret_code_required: z.boolean(),
  start_time: instant,
  end_time: instant,
  entries_close_at: instant.nullable(),
})

const responseSchema = z.object({
  data: z.array(competitionSchema),
  meta: z.object({ total_count: z.number().int().nonnegative() }),
})

export interface Competition {
  id: string
  title: string
  organization: string | null
  open: boolean
  secretCodeRequired: boolean
  startTime: string
  endTime: string
  entriesCloseAt: string | null
}

/**
 * The competitions of the list response. The response must hold all that its meta counts: the request asks for
 * one page of 600, so a total beyond what came back means the list has outgrown the page, and records would be
 * dropped without a sign.
 */
export function parseCompetitions(json: unknown): Competition[] {
  const result = responseSchema.safeParse(json)
  if (!result.success)
    throw new Error(
      `Zindi competitions response does not fit: ${z.prettifyError(result.error)}`
    )
  const { data, meta } = result.data
  if (meta.total_count > data.length)
    throw new Error(
      `Zindi has ${meta.total_count} competitions but the response holds ${data.length}; the request needs a larger page`
    )
  return data.map((c) => ({
    id: c.id,
    title: c.title,
    organization: c.organization,
    open: c.open,
    secretCodeRequired: c.secret_code_required,
    startTime: c.start_time,
    endTime: c.end_time,
    entriesCloseAt: c.entries_close_at,
  }))
}

/** The competition's page, which the listing links to and takes its facts from. */
export function competitionUrl(id: string): string {
  return `https://zindi.world/competitions/${id}`
}

/**
 * Whether the competition is open to anyone, as ACB lists it: open, whether or not it has started, not ended, and
 * not behind a private code. `is_access_restricted` does not exclude: its meaning is unconfirmed, and a restricted
 * competition states in its rules that it is open to all.
 */
export function isOpenToPublic(competition: Competition, now: Date): boolean {
  return (
    competition.open &&
    !competition.secretCodeRequired &&
    endsAhead(Date.parse(competition.endTime), now)
  )
}

/**
 * The listing of a competition that `isOpenToPublic` accepts. Zindi gives every time as an exact UTC instant and
 * states no Anywhere on Earth convention, so each deadline carries the zone UTC. The end of the competition is the
 * final deadline; the last day to enter comes first when it is still ahead and falls before the end.
 */
export function toListing(competition: Competition, now: Date): Listing {
  const title = cleanText(competition.title, 300)
  if (title === null)
    throw new Error(`Zindi competition ${competition.id} has no title`)
  const url = competitionUrl(competition.id)
  const end = Date.parse(competition.endTime)
  const entry = competition.entriesCloseAt
    ? Date.parse(competition.entriesCloseAt)
    : null
  const deadlines: Deadline[] = []
  if (
    entry !== null &&
    entry > now.getTime() &&
    minuteOf(entry) < minuteOf(end)
  )
    deadlines.push({
      kind: "entry",
      label: null,
      at: isoFromMs(entry),
      zone: "UTC",
    })
  deadlines.push({ kind: "end", label: null, at: isoFromMs(end), zone: "UTC" })

  return {
    id: `zindi:${competition.id}`,
    source: "zindi",
    kind: "challenge",
    title,
    organizer: cleanText(competition.organization ?? undefined, 200),
    conference: null,
    url,
    sourceUrl: url,
    opensAt: isoFromMs(Date.parse(competition.startTime)),
    deadlines,
  }
}
