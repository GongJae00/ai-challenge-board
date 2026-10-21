import { z } from "zod"

import {
  conferences,
  type Conference,
  type Deadline,
  type Listing,
} from "../../../lib/listing.ts"
import { cleanText } from "../../text.ts"
import {
  deadlineZone,
  endsAhead,
  isoFromMs,
  PLACEHOLDER_AFTER_MS,
} from "../../time.ts"

const instant = z.iso.datetime()

/**
 * Competitions that started longer ago than this are not checked, unless an earlier run found them open: a
 * research challenge runs for months, not years.
 */
const LOOKBACK_MS = 365 * 24 * 60 * 60 * 1000

/**
 * How long after its last deadline a competition is still checked, so that an extension announced after the
 * deadline is caught; after that it is settled.
 */
const RECHECK_AFTER_END_MS = 30 * 24 * 60 * 60 * 1000

/**
 * A phase named "Post-evaluation" or "Post-challenge" is an open practice period after the challenge, not one of
 * its deadlines.
 */
const POST_PHASE = /^post[\s-]?/i

const listPage = z.object({
  count: z.number().int(),
  results: z.array(
    z.object({
      id: z.number().int().positive(),
      title: z.string(),
      published: z.boolean(),
      competition_type: z.string(),
      first_phase_start: instant.nullable(),
    })
  ),
})

const detail = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  published: z.boolean(),
  competition_type: z.string(),
  phases: z.array(
    z.object({
      name: z.string(),
      start: instant.nullable(),
      end: instant.nullable(),
    })
  ),
})

export interface ListedCompetition {
  id: number
  title: string
  published: boolean
  type: string
  firstPhaseStart: string | null
}

export type Detail = z.infer<typeof detail>

function parse<T>(schema: z.ZodType<T>, json: unknown, what: string): T {
  const result = schema.safeParse(json)
  if (!result.success)
    throw new Error(
      `Codabench ${what} response does not fit: ${z.prettifyError(result.error)}`
    )
  return result.data
}

export function parseListPage(json: unknown): {
  count: number
  competitions: ListedCompetition[]
} {
  const page = parse(listPage, json, "list")
  return {
    count: page.count,
    competitions: page.results.map((c) => ({
      id: c.id,
      title: c.title,
      published: c.published,
      type: c.competition_type,
      firstPhaseStart: c.first_phase_start,
    })),
  }
}

export function parseDetail(json: unknown): Detail {
  return parse(detail, json, "competition")
}

export function competitionUrl(id: number): string {
  return `https://www.codabench.org/competitions/${id}/`
}

/**
 * The competitions worth a detail request, newest first: published competitions, not benchmarks, whose title
 * names a phase-1 conference, that started within the last year or start later, and that an earlier run has not
 * settled. Competitions an earlier run found open stay in, however long ago they started.
 */
export function candidates(
  competitions: ListedCompetition[],
  now: Date,
  settled: Set<number>,
  wasOpen: Set<number>
): number[] {
  const since = now.getTime() - LOOKBACK_MS
  return competitions
    .filter(
      (c) =>
        c.published &&
        c.type === "competition" &&
        CONFERENCE_NAME.test(c.title) &&
        !settled.has(c.id) &&
        (wasOpen.has(c.id) ||
          (c.firstPhaseStart !== null &&
            Date.parse(c.firstPhaseStart) >= since))
    )
    .map((c) => c.id)
    .sort((a, b) => b - a)
}

/** The ends of the competition's phases still ahead, without post-challenge phases and placeholder ends. */
function deadlines(competition: Detail, now: Date): Deadline[] {
  return competition.phases
    .filter((p) => !POST_PHASE.test(p.name.trim()) && p.end !== null)
    .map((p) => ({ name: p.name, end: Date.parse(p.end!) }))
    .filter((p) => endsAhead(p.end, now))
    .sort((a, b) => a.end - b.end)
    .map((p) => ({
      kind: "phase",
      label: cleanText(p.name, 200),
      at: isoFromMs(p.end),
      zone: deadlineZone(p.end),
    }))
}

/**
 * A phase-1 conference named in a title. Codabench's search also matches descriptions, so the title is checked
 * again here.
 */
const CONFERENCE_NAME = new RegExp(`\\b(${conferences.join("|")})`, "i")

const CONFERENCE_IN_TITLE = new RegExp(
  `\\b(${conferences.join("|")})\\s?'?(20\\d{2})\\b`,
  "i"
)

/**
 * The conference a title names together with its year, such as "(@ CVPR 2026)" or "NeurIPS2026". Codabench has no
 * field for it, and ACB takes Codabench competitions by the conference their title names, so the title is the
 * record; a name without a year does not count.
 */
export function conferenceFromTitle(
  title: string
): { name: Conference; year: number } | null {
  const match = CONFERENCE_IN_TITLE.exec(title)
  if (!match) return null
  const name = conferences.find(
    (c) => c.toLowerCase() === match[1].toLowerCase()
  )
  return name ? { name, year: Number(match[2]) } : null
}

/** When the competition's first phase starts, in milliseconds, or null when no phase has a start. */
function earliestStart(competition: Detail): number | null {
  const starts = competition.phases
    .map((p) => p.start)
    .filter((start): start is string => start !== null)
    .map((start) => Date.parse(start))
  return starts.length > 0 ? Math.min(...starts) : null
}

/**
 * The listing of a published competition with a deadline ahead, or null. Codabench states every date as an
 * instant in UTC, shown in AoE when it falls at the end of an AoE day, as academic challenges often set it. Its
 * owner field names an account, not an organizer, so the organizer stays empty.
 */
export function toListing(competition: Detail, now: Date): Listing | null {
  if (!competition.published || competition.competition_type !== "competition")
    return null
  const ahead = deadlines(competition, now)
  const title = cleanText(competition.title, 300)
  if (ahead.length === 0 || title === null) return null
  const start = earliestStart(competition)
  const url = competitionUrl(competition.id)
  return {
    id: `codabench:${competition.id}`,
    source: "codabench",
    kind: "challenge",
    title,
    organizer: null,
    conference: conferenceFromTitle(title),
    url,
    sourceUrl: url,
    opensAt: start === null ? null : isoFromMs(start),
    deadlines: ahead,
  }
}

/**
 * Whether a competition needs no further detail requests, given its listing now. It is settled when it is not
 * listable, has started, and either has no real end, as a benchmark or an open-ended phase, or ended more than
 * 30 days ago. A competition that has not started may still get its dates, and one that ended lately may still
 * be extended, so both are checked again.
 */
export function isSettled(
  competition: Detail,
  listing: Listing | null,
  now: Date
): boolean {
  if (listing !== null) return false
  const start = earliestStart(competition)
  if (start === null || start > now.getTime()) return false
  const ends = competition.phases
    .filter((p) => !POST_PHASE.test(p.name.trim()) && p.end !== null)
    .map((p) => Date.parse(p.end!))
  const lastEnd = ends.length > 0 ? Math.max(...ends) : null
  return (
    lastEnd === null ||
    lastEnd > now.getTime() + PLACEHOLDER_AFTER_MS ||
    lastEnd < now.getTime() - RECHECK_AFTER_END_MS
  )
}
