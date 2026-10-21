import { z } from "zod"

import type { Listing } from "../../../lib/listing.ts"
import { minuteOf } from "../../../lib/datetime.ts"
import { cleanText, webUrl } from "../../text.ts"
import { endsAhead, isoFromLocal } from "../../time.ts"

/** The zone Tianchi's times are in. The list gives no zone; its site is Alibaba Cloud's, in China. */
export const ZONE = "Asia/Shanghai"

/** Tianchi writes every time as `YYYY-MM-DD HH:MM:SS` in China time; one it cannot read fails the response. */
const chinaInstant = z.string().transform((text, ctx) => {
  const instant = isoFromLocal(text, ZONE)
  if (instant === null) {
    ctx.addIssue({
      code: "custom",
      message: `"${text}" is not a China date and time`,
    })
    return z.NEVER
  }
  return instant
})

/** A field the list leaves out or leaves empty is none, and a value it fills must fit the schema. */
function optional<T extends z.ZodType>(schema: T) {
  return z
    .preprocess((value) => (value === "" ? undefined : value), schema.nullish())
    .transform((value) => value ?? null)
}

/** The `visualTab` of the learning tab, 日常学习赛, whose competitions are practice and have no real deadline. */
const LEARNING_TAB = 4

// Only what ACB uses is read; the prize, team count, tags, and a series' `trackList` are left alone.
const racePage = z.object({
  success: z.literal(true),
  data: z.object({
    list: z.array(
      z
        .object({
          raceId: z.number().int().positive(),
          name: z.string(),
          nameEn: optional(z.string()),
          referUrl: optional(z.string()),
          signupStartTime: optional(chinaInstant),
          raceStartTime: optional(chinaInstant),
          signupEndTime: optional(chinaInstant),
          raceEndTime: chinaInstant,
          visualTab: z.number().optional(),
          isSeries: z.number().optional(),
        })
        .transform((row) => ({
          id: row.raceId,
          name: row.name,
          nameEn: row.nameEn,
          referUrl: row.referUrl,
          signupStartsAt: row.signupStartTime,
          startsAt: row.raceStartTime,
          signupEndsAt: row.signupEndTime,
          endsAt: row.raceEndTime,
          learning: row.visualTab === LEARNING_TAB,
          series: row.isSeries === 1,
        }))
    ),
  }),
})

export type Race = z.infer<typeof racePage>["data"]["list"][number]

/** The rows on one page of Tianchi's competition list, with their times as UTC instants. */
export function parseRacePage(json: unknown): Race[] {
  const result = racePage.safeParse(json)
  if (!result.success)
    throw new Error(
      `Tianchi race list response does not fit: ${z.prettifyError(result.error)}`
    )
  return result.data.data.list
}

/**
 * Whether the row is a competition to list: not a learning competition, whose dates are placeholders, and not a
 * series container, which only groups the tracks one enters. It must also end after now and not so far ahead that
 * the end is a placeholder for "never".
 */
export function isListed(race: Race, now: Date): boolean {
  return (
    !race.learning && !race.series && endsAhead(Date.parse(race.endsAt), now)
  )
}

/** The competition's entrance page on Tianchi, which is the source page and the default link. */
function entranceUrl(race: Race): string {
  return `https://tianchi.aliyun.com/competition/entrance/${race.id}`
}

/**
 * The listing of a competition, or null when it has no title text. The title is the English name when the row has
 * one, since the pages are in Korean and English. The organizer has no field in the list. Times are kept as
 * written, odd ones such as 13:59:59 included. The entry deadline is left out when it has passed or falls in the
 * minute the competition ends. Stages are not read.
 */
export function toListing(race: Race, now: Date): Listing | null {
  const title =
    cleanText(race.nameEn ?? undefined, 300) ?? cleanText(race.name, 300)
  if (title === null) return null
  const entry = race.signupEndsAt
  const entryAhead =
    entry !== null &&
    Date.parse(entry) > now.getTime() &&
    minuteOf(Date.parse(entry)) < minuteOf(Date.parse(race.endsAt))
  return {
    id: `tianchi:${race.id}`,
    source: "tianchi",
    kind: "challenge",
    title,
    organizer: null,
    conference: null,
    url: webUrl(race.referUrl ?? undefined) ?? entranceUrl(race),
    sourceUrl: entranceUrl(race),
    opensAt: race.signupStartsAt ?? race.startsAt,
    deadlines: [
      ...(entryAhead
        ? [{ kind: "entry" as const, label: null, at: entry, zone: ZONE }]
        : []),
      { kind: "end" as const, label: null, at: race.endsAt, zone: ZONE },
    ],
  }
}
