import { z } from "zod"

import type { Listing } from "../../../lib/listing.ts"
import { cleanName, cleanText } from "../../text.ts"
import { endsAhead, isoFromKst } from "../../time.ts"

/** DACON writes every date as `YYYY-MM-DD HH:MM:SS` in Korean time; one it cannot read fails the response. */
const kstInstant = z.string().transform((text, ctx) => {
  const instant = isoFromKst(text)
  if (instant === null) {
    ctx.addIssue({
      code: "custom",
      message: `"${text}" is not a Korean date and time`,
    })
    return z.NEVER
  }
  return instant
})

// Only what ACB uses is read; DACON's other fields (`practice`, `on_going`, `private_open`) do not mean what
// their names suggest and are left alone.
const listPage = z.object({
  status: z.literal(1),
  data: z.array(
    z
      .object({
        cpt_id: z.number().int().positive(),
        name: z.string(),
        period_start: kstInstant,
        period_end: kstInstant,
        is_landing_cpt: z.number().optional(),
      })
      .transform((record) => ({
        id: record.cpt_id,
        name: record.name,
        startsAt: record.period_start,
        endsAt: record.period_end,
        landing: record.is_landing_cpt === 1,
      }))
  ),
})

export type Competition = z.infer<typeof listPage>["data"][number]

/** The competitions on one page of DACON's list, with their dates as UTC instants. */
export function parseListPage(json: unknown): Competition[] {
  const result = listPage.safeParse(json)
  if (!result.success)
    throw new Error(
      `DACON list response does not fit: ${z.prettifyError(result.error)}`
    )
  return result.data.data
}

/** Whether the competition ends after now, and not so far ahead that the end is a placeholder. */
export function isOpen(competition: Competition, now: Date): boolean {
  const end = Date.parse(competition.endsAt)
  return endsAhead(end, now)
}

/**
 * The page a visitor reads about the competition. A series landing page (`is_landing_cpt` 1) has its own
 * address in DACON's page script; no open competition has been seen with it.
 */
export function competitionUrl(competition: Competition): string {
  return competition.landing
    ? `https://dacon.io/competition/${competition.id}/overview`
    : `https://dacon.io/competitions/official/${competition.id}/overview/description`
}

/**
 * The listing of a competition, or null when its title has no text. The end is `period_end` as `end`, not as a
 * final submission, because a leaderboard can close before the competition ends. DACON's other milestones are
 * left out: its detail page gives them in fields that disagree with its prose.
 */
export function toListing(
  competition: Competition,
  organizer: string | null
): Listing | null {
  const title = cleanText(competition.name, 300)
  if (title === null) return null
  const url = competitionUrl(competition)
  return {
    id: `dacon:${competition.id}`,
    source: "dacon",
    kind: "challenge",
    title,
    organizer,
    conference: null,
    url,
    sourceUrl: url,
    opensAt: competition.startsAt,
    deadlines: [
      { kind: "end", label: null, at: competition.endsAt, zone: "KST" },
    ],
  }
}

const NOT_CONTENT = /<(script|style)\b[\s\S]*?<\/\1\s*>/gi
const LINE_BREAKING_TAG =
  /<\/?(?:p|li|ul|ol|div|br|tr|table|blockquote|h[1-6])\b[^>]*>/gi
const TAG = /<[^>]*>/g
const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
}

function decodeEntities(text: string): string {
  return text.replace(
    /&(?:#(\d+)|#x([\da-f]+)|([a-z]+));/gi,
    (all, dec, hex, name) => {
      if (name) return ENTITIES[name.toLowerCase()] ?? all
      const code = dec ? Number(dec) : parseInt(hex, 16)
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : all
    }
  )
}

/** The text of a page, one line for each block element. */
function textLines(html: string): string[] {
  return decodeEntities(
    html
      .replace(NOT_CONTENT, "")
      .replace(LINE_BREAKING_TAG, "\n")
      .replace(TAG, "")
  ).split("\n")
}

/** A line of the description block such as "- 주최 : A" or "주최/주관: A", read up to the next role. */
const ORGANIZER_LINE = /^[\s\-–•·*]*주최(?:\s*\/\s*주관)?\s*[:：]\s*(.*)$/
const NEXT_ROLE = /\s*[/,|]?\s*(?:주관|운영|후원|협력|주최)\s*[:：]/

/**
 * The organizer a competition's detail page names on its first line that starts with 주최, or null. The line
 * sits in the "[주최 / 주관 / 운영]" block of the description, in markup that differs between competitions, so
 * the page is read as lines of text. 주관 (host) and 운영 (operator, usually DACON itself) are never the
 * organizer: a value ends where the next role begins.
 */
export function parseOrganizer(html: string): string | null {
  for (const line of textLines(html)) {
    const match = ORGANIZER_LINE.exec(line.replace(/\s+/g, " ").trim())
    if (!match) continue
    const value = match[1].split(NEXT_ROLE)[0].replace(/[\s/,|]+$/, "")
    const organizer = cleanName(value, 200)
    if (organizer !== null) return organizer
  }
  return null
}
