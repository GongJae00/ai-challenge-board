import { z } from "zod"

import type { Listing } from "../../../lib/listing.ts"
import { cleanName, cleanText } from "../../text.ts"
import { endsAhead, isoFromLocal } from "../../time.ts"

const JST_OFFSET = "+09:00"
const ISO_WITH_OFFSET =
  /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/

/**
 * SIGNATE writes a time as ISO 8601 with microseconds and the offset `+09:00`, such as
 * `2026-12-18T23:59:00.000000+09:00`. Without an offset the time would be read in the machine's zone, and the
 * listing says JST, so a time without that offset, or one that is not a real date, fails the response.
 */
const jstInstant = z.string().transform((text, ctx) => {
  const fail = (message: string) => {
    ctx.addIssue({ code: "custom", message })
    return z.NEVER
  }
  const match = ISO_WITH_OFFSET.exec(text)
  if (!match) return fail(`"${text}" is not an ISO 8601 time with an offset`)
  const [, date, time, offset] = match
  if (offset !== JST_OFFSET)
    return fail(`"${text}" is not in Japan Standard Time (${JST_OFFSET})`)
  // The wall clock read in Japan time, which also rejects an impossible date such as February 30.
  return (
    isoFromLocal(`${date} ${time}`, "Asia/Tokyo") ??
    fail(`"${text}" is not a real date and time`)
  )
})

// Only what ACB uses is read; the reward, the entry count, and the other labels are left alone.
const listPage = z.object({
  total_count: z.number().int().nonnegative(),
  competition_list: z.array(
    z
      .object({
        public_key: z.string().regex(/^[\w-]+$/),
        title: z.string(),
        owner_name: z.string().nullable(),
        status: z.string(),
      })
      .transform((record) => ({
        publicKey: record.public_key,
        title: record.title,
        organizer: record.owner_name,
        status: record.status,
      }))
  ),
})

const overview = z.object({ deadline_at: jstInstant.nullable() })

export type Entry = z.infer<typeof listPage>["competition_list"][number]

/** One page of SIGNATE's list: its entries, and the total number of entries across all pages. */
export function parseListPage(json: unknown): {
  total: number
  entries: Entry[]
} {
  const result = listPage.safeParse(json)
  if (!result.success)
    throw new Error(
      `SIGNATE list response does not fit: ${z.prettifyError(result.error)}`
    )
  return {
    total: result.data.total_count,
    entries: result.data.competition_list,
  }
}

/**
 * Whether the list alone does not rule the entry out. Only an `open` entry has an end: a `pre_open` entry's
 * `deadline_at` is its start, and `ongoing` entries (practice problems and reruns) have none.
 */
export function isListed(entry: Entry): boolean {
  return entry.status === "open"
}

/** An entry's overview: its submission end as a UTC instant, or null when it has none. */
export function parseOverview(json: unknown): { endsAt: string | null } {
  const result = overview.safeParse(json)
  if (!result.success)
    throw new Error(
      `SIGNATE overview response does not fit: ${z.prettifyError(result.error)}`
    )
  return { endsAt: result.data.deadline_at }
}

/** Whether the end is after now, and not so far ahead that it is a placeholder. */
export function isOpen(endsAt: string | null, now: Date): endsAt is string {
  return endsAt !== null && endsAhead(Date.parse(endsAt), now)
}

/** The page a visitor reads about the competition, which is also the page the facts come from. */
function competitionUrl(publicKey: string): string {
  return `https://user.competition.signate.jp/ja/competition/detail/?competition=${publicKey}`
}

/**
 * The listing of an open entry, or null when its title has no text. The list and the overview give no clean
 * start for an open entry, so `opensAt` stays empty.
 */
export function toListing(entry: Entry, endsAt: string): Listing | null {
  const title = cleanText(entry.title, 300)
  if (title === null) return null
  const url = competitionUrl(entry.publicKey)
  return {
    id: `signate:${entry.publicKey}`,
    source: "signate",
    kind: "challenge",
    title,
    organizer: cleanName(entry.organizer ?? undefined, 200),
    conference: null,
    url,
    sourceUrl: url,
    opensAt: null,
    deadlines: [{ kind: "submission", label: null, at: endsAt, zone: "JST" }],
  }
}
