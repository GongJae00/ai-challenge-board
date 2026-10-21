import { parse, type HTMLElement } from "node-html-parser"
import { z } from "zod"

import type { Listing } from "../../../lib/listing.ts"
import { cleanText } from "../../text.ts"
import { endsAhead, isoFromLocal } from "../../time.ts"

const SITE = "https://www.drivendata.org"
export const LIST_URL = `${SITE}/competitions/`

const MONTHS: Record<string, number> = {
  "Jan.": 1,
  "Feb.": 2,
  March: 3,
  April: 4,
  May: 5,
  June: 6,
  July: 7,
  "Aug.": 8,
  "Sept.": 9,
  "Oct.": 10,
  "Nov.": 11,
  "Dec.": 12,
}
/**
 * Django's date format in the `title` of a card's end date, such as "Dec. 3, 2026, 11:59 p.m. UTC": a month in
 * AP style, a 12-hour time with "a.m." or "p.m." and no minutes on the hour, or "noon" or "midnight".
 */
const END_DATE = new RegExp(
  `^(${Object.keys(MONTHS)
    .map((month) => month.replace(".", "\\."))
    .join("|")}) (\\d{1,2}), (20\\d{2}), ` +
    "(?:(noon|midnight)|(1[0-2]|[1-9])(?::([0-5]\\d))? ([ap])\\.m\\.) UTC$"
)

const two = (n: number | string) => String(n).padStart(2, "0")

/**
 * The instant of an end date as DrivenData writes it, or null when the text is not one. The zone must be the
 * word UTC. Django's "midnight" is 00:00 at the start of the day named, not 24:00 at its end.
 */
export function readEndDate(text: string): string | null {
  const match = END_DATE.exec(text.replace(/\s+/g, " ").trim())
  if (!match) return null
  const [, month, day, year, named, hour12, minutes = "00", meridiem] = match
  let hour = 0
  if (named === "noon") hour = 12
  else if (named === undefined)
    hour = (Number(hour12) % 12) + (meridiem === "p" ? 12 : 0)
  const date = `${year}-${two(MONTHS[month])}-${two(day)}`
  return isoFromLocal(`${date} ${two(hour)}:${named ? "00" : minutes}`, "UTC")
}

/** A card's `data-start_date`, `YYYYMMDD` with no time or zone, as the start of that day in UTC. */
function readStartDate(text: string): string | null {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(text)
  return match
    ? isoFromLocal(`${match[1]}-${match[2]}-${match[3]} 00:00`, "UTC")
    : null
}

const CARD_PATH = /^\/competitions\/(\d{1,9})\/[^/?#]+\/$/

const card = z.object({
  href: z.string("the card has no title link").transform((href, ctx) => {
    const match = CARD_PATH.exec(href)
    if (match === null) {
      ctx.addIssue({
        code: "custom",
        message: `"${href}" is not a link to /competitions/<id>/<name>/`,
      })
      return z.NEVER
    }
    return { id: Number(match[1]), url: `${SITE}${href}` }
  }),
  title: z.string("the card has no title link").transform((text, ctx) => {
    const title = cleanText(text, 300)
    if (title === null) {
      ctx.addIssue({ code: "custom", message: "the title link has no text" })
      return z.NEVER
    }
    return title
  }),
  host: z
    .string()
    .optional()
    .transform((alt) => {
      const match = /^Hosted by (.+)$/.exec(alt?.trim() ?? "")
      return match ? cleanText(match[1], 200) : null
    }),
  start: z
    .string()
    .optional()
    .transform((text, ctx) => {
      if (text === undefined) return null
      const instant = readStartDate(text)
      if (instant === null) {
        ctx.addIssue({
          code: "custom",
          message: `"${text}" is not a start date as YYYYMMDD`,
        })
        return z.NEVER
      }
      return instant
    }),
  end: z.string().transform((text, ctx) => {
    const instant = readEndDate(text)
    if (instant === null) {
      ctx.addIssue({
        code: "custom",
        message: `"${text}" is not an end date such as "Dec. 3, 2026, 11:59 p.m. UTC"`,
      })
      return z.NEVER
    }
    return instant
  }),
})

export type Competition = {
  id: number
  name: string
  organizer: string | null
  url: string
  /** The start of the day the card gives, in UTC; the source states no time or zone. */
  startsAt: string | null
  endsAt: string
}

function problem(what: string): Error {
  return new Error(`DrivenData competitions page does not fit: ${what}`)
}

/** What a card says, as the text of the page, or null when its end date has no exact `title`. */
function readCard(
  element: HTMLElement
): Record<string, string | undefined> | null {
  const ends = element.querySelectorAll("span.end-date")
  if (ends.length > 1)
    throw problem(
      "a prize card has more than one end date, which this collector has not seen"
    )
  const end = ends[0]?.getAttribute("title")
  if (!end) return null
  const link = element.querySelector("h3.panel-competition-title a")
  return {
    href: link?.getAttribute("href"),
    title: link?.text,
    host: element.querySelector(".panel-logo img")?.getAttribute("alt"),
    start: element.getAttribute("data-start_date"),
    end,
  }
}

/**
 * The prize competitions on DrivenData's competitions page that have an exact end date. Only the cards in
 * `section#prize` count: the benchmark card carries the prize card's class, and the practice section has exact
 * ends too. A page with the other sections but no prize section has no prize competition open; a page with none
 * of them is not the competitions page, and fails.
 */
export function parseCompetitionsPage(html: string): Competition[] {
  const root = parse(html)
  const prize = root.querySelector("section#prize")
  if (prize === null) {
    if (!root.querySelector('#benchmark, #practice, [id^="completed"]'))
      throw new Error(
        "DrivenData competitions page has no section#prize, nor a benchmark, practice, or completed section, so it is not the competitions page"
      )
    return []
  }
  const raw = prize
    .querySelectorAll(".panel-container")
    .map(readCard)
    .filter((fields) => fields !== null)
  const result = z.array(card).safeParse(raw)
  if (!result.success) throw problem(z.prettifyError(result.error))
  return result.data.map((fields) => ({
    id: fields.href.id,
    name: fields.title,
    organizer: fields.host,
    url: fields.href.url,
    startsAt: fields.start,
    endsAt: fields.end,
  }))
}

/** Whether the competition ends after now, and not so far ahead that the end is a placeholder. */
export function isOpen(competition: Competition, now: Date): boolean {
  return endsAhead(Date.parse(competition.endsAt), now)
}

/** The listing of a competition. The end is in UTC because the page writes it in UTC. */
export function toListing(competition: Competition): Listing {
  return {
    id: `drivendata:${competition.id}`,
    source: "drivendata",
    kind: "challenge",
    title: competition.name,
    organizer: competition.organizer,
    conference: null,
    url: competition.url,
    sourceUrl: LIST_URL,
    opensAt: competition.startsAt,
    deadlines: [
      { kind: "end", label: null, at: competition.endsAt, zone: "UTC" },
    ],
  }
}
