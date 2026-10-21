import { z } from "zod"

import {
  conferences,
  type Conference,
  type Deadline,
  type Listing,
} from "../../../lib/listing.ts"
import { cleanText } from "../../text.ts"
import { isoFromMs, PLACEHOLDER_AFTER_MS } from "../../time.ts"

const HOST = "eval.ai"

const instant = z.iso.datetime()

const envelope = <T extends z.ZodType>(result: T) =>
  z.object({
    next: z.string().nullable(),
    results: z.array(result),
  })

const challengePage = envelope(
  z.object({
    id: z.number().int().positive(),
    title: z.string().refine((t) => cleanText(t, 300) !== null, "is blank"),
    start_date: instant.nullable(),
    end_date: instant,
    creator: z.object({ team_name: z.string().nullable() }).nullable(),
    list_tags: z.array(z.string()),
    published: z.boolean(),
    approved_by_admin: z.boolean(),
  })
)

const phasePage = envelope(
  z.object({
    name: z.string(),
    end_date: instant,
    is_public: z.boolean(),
  })
)

export interface Challenge {
  id: number
  title: string
  teamName: string | null
  startDate: string | null
  endDate: string
  tags: string[]
  published: boolean
  approved: boolean
}

export interface Phase {
  name: string
  endDate: string
  isPublic: boolean
}

function parse<T>(schema: z.ZodType<T>, json: unknown, what: string): T {
  const result = schema.safeParse(json)
  if (!result.success)
    throw new Error(
      `EvalAI ${what} response does not fit: ${z.prettifyError(result.error)}`
    )
  return result.data
}

/** The `next` link of a page, which the collector follows only when it is an https URL on eval.ai. */
function checkedNext(next: string | null, what: string): string | null {
  if (next === null) return null
  let url: URL | null = null
  try {
    url = new URL(next)
  } catch {
    // Reported below with the link.
  }
  if (!url || url.protocol !== "https:" || url.hostname !== HOST)
    throw new Error(
      `EvalAI ${what} response has a next link that is not https on ${HOST}: ${next}`
    )
  return next
}

export function parseChallengePage(json: unknown): {
  challenges: Challenge[]
  next: string | null
} {
  const page = parse(challengePage, json, "challenges")
  return {
    next: checkedNext(page.next, "challenges"),
    challenges: page.results.map((c) => ({
      id: c.id,
      title: c.title,
      teamName: c.creator?.team_name ?? null,
      startDate: c.start_date,
      endDate: c.end_date,
      tags: c.list_tags,
      published: c.published,
      approved: c.approved_by_admin,
    })),
  }
}

export function parsePhasePage(json: unknown): {
  phases: Phase[]
  next: string | null
} {
  const page = parse(phasePage, json, "phases")
  return {
    next: checkedNext(page.next, "phases"),
    phases: page.results.map((p) => ({
      name: p.name,
      endDate: p.end_date,
      isPublic: p.is_public,
    })),
  }
}

export function challengeUrl(id: number): string {
  return `https://${HOST}/web/challenges/challenge-page/${id}`
}

/** Whether a challenge is published, approved, still running at `now`, and not a persistent benchmark. */
export function isOpenTimeBound(challenge: Challenge, now: Date): boolean {
  const end = Date.parse(challenge.endDate)
  return (
    challenge.published &&
    challenge.approved &&
    end > now.getTime() &&
    end <= now.getTime() + PLACEHOLDER_AFTER_MS
  )
}

const CONFERENCE_TAG = new RegExp(
  `^(${conferences.join("|")})[-_]?(\\d{4})$`,
  "i"
)

/**
 * The conference a challenge is tagged with, such as `iccv-2025` or `cvpr2026`. Only a tag counts: the title and
 * description mention conferences the challenge merely follows or compares itself to.
 */
export function conferenceFromTags(
  tags: string[]
): { name: Conference; year: number } | null {
  for (const tag of tags) {
    const match = CONFERENCE_TAG.exec(tag.trim())
    if (!match) continue
    const name = conferences.find(
      (c) => c.toLowerCase() === match[1].toLowerCase()
    )
    if (name) return { name, year: Number(match[2]) }
  }
  return null
}

/**
 * The listing of one challenge that `isOpenTimeBound` accepts. EvalAI states every date as an instant in UTC
 * without the host's own zone. A phase's end can differ from the challenge's end, so the challenge's end is a
 * deadline of its own unless a phase ends at that same instant.
 */
export function toListing(
  challenge: Challenge,
  phases: Phase[],
  now: Date
): Listing {
  const endAt = isoFromMs(Date.parse(challenge.endDate))
  const deadlines: Deadline[] = phases
    .filter((p) => p.isPublic && Date.parse(p.endDate) > now.getTime())
    .map((p) => ({
      kind: "phase",
      label: cleanText(p.name, 200),
      at: isoFromMs(Date.parse(p.endDate)),
      zone: "UTC",
    }))
  if (!deadlines.some((d) => d.at === endAt))
    deadlines.push({ kind: "end", label: null, at: endAt, zone: "UTC" })
  deadlines.sort((a, b) => Date.parse(a.at) - Date.parse(b.at))

  const url = challengeUrl(challenge.id)
  return {
    id: `evalai:${challenge.id}`,
    source: "evalai",
    kind: "challenge",
    title: cleanText(challenge.title, 300)!,
    organizer: cleanText(challenge.teamName ?? undefined, 200),
    conference: conferenceFromTags(challenge.tags),
    url,
    sourceUrl: url,
    opensAt:
      challenge.startDate === null
        ? null
        : isoFromMs(Date.parse(challenge.startDate)),
    deadlines,
  }
}
