import { z } from "zod"

import {
  canonicalZone,
  isTimeZone,
  type Deadline,
  type Listing,
} from "../../../lib/listing.ts"
import { cleanName, cleanText } from "../../text.ts"
import { endsAhead, isoFromLocal, monthOf } from "../../time.ts"

/**
 * A hackathon's own page, `https://<slug>.devpost.com/`. The collector requests a calendar on this host, so a
 * link to any other host is rejected rather than followed.
 */
const hackathonUrl = z.url({
  protocol: /^https$/,
  hostname: /^[a-z0-9-]+\.devpost\.com$/,
})

/** Devpost's theme for AI hackathons, the only AI theme among its 29. */
export const AI_THEME = "Machine Learning/AI"

const listPage = z.object({
  hackathons: z.array(
    z.object({
      id: z.number().int().positive(),
      title: z.string().trim().min(1),
      url: hackathonUrl,
      organization_name: z.string().nullish(),
      submission_period_dates: z.string(),
      invite_only: z.boolean(),
      themes: z.array(z.object({ name: z.string() })),
    })
  ),
  meta: z.object({ total_count: z.number().int().nonnegative() }),
})

export interface ListedHackathon {
  id: number
  title: string
  url: string
  organizer: string | null
  /** Devpost's display string for the submission period, such as "Aug 31 - Oct 23, 2026"; no time, no zone. */
  dates: string
  inviteOnly: boolean
  /**
   * Whether Devpost tags it with the AI theme. The list request already asks for that theme; checking each item
   * keeps non-AI hackathons out should Devpost stop honouring the undocumented filter.
   */
  ai: boolean
}

export function parseListPage(json: unknown): {
  total: number
  hackathons: ListedHackathon[]
} {
  const result = listPage.safeParse(json)
  if (!result.success)
    throw new Error(
      `Devpost list response does not fit: ${z.prettifyError(result.error)}`
    )
  return {
    total: result.data.meta.total_count,
    hackathons: result.data.hackathons.map((h) => ({
      id: h.id,
      title: h.title,
      url: h.url,
      organizer: cleanName(h.organization_name ?? undefined, 200),
      dates: h.submission_period_dates,
      inviteOnly: h.invite_only,
      ai: h.themes.some((theme) => theme.name === AI_THEME),
    })),
  }
}

/** The calendar file of a hackathon, served on its own host. */
export function calendarUrl(hackathon: ListedHackathon): string {
  return new URL("/calendar", hackathon.url).href
}

/** A calendar property of the event: its parameters, such as the TZID, and its value. */
interface Property {
  params: Map<string, string>
  value: string
}

/**
 * The properties of the first event, with the lines unfolded (a folded line continues on the next line after a
 * space) and without those of the reminder inside it. The time zone rules before the event carry bare DTSTART
 * lines of their own and are left out the same way. Null when the file holds no event.
 */
function firstEvent(text: string): Map<string, Property> | null {
  const lines = text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/)
  const open: string[] = []
  const properties = new Map<string, Property>()
  let inEvent = false
  for (const line of lines) {
    const begin = /^BEGIN:(.+)$/i.exec(line)
    if (begin) {
      open.push(begin[1].toUpperCase())
      if (open.at(-1) === "VEVENT") inEvent = true
      continue
    }
    if (/^END:/i.test(line)) {
      if (open.pop() === "VEVENT") return properties
      continue
    }
    if (!inEvent || open.at(-1) !== "VEVENT") continue
    const colon = line.indexOf(":")
    if (colon === -1) continue
    const [name, ...params] = line.slice(0, colon).split(";")
    properties.set(name.toUpperCase(), {
      params: new Map(
        params.map((param) => {
          const [key, ...rest] = param.split("=")
          return [key.toUpperCase(), rest.join("=")]
        })
      ),
      value: line.slice(colon + 1),
    })
  }
  return null
}

/** A date and time written as `YYYYMMDDTHHMMSS`, with a trailing `Z` when it is in UTC. */
const CALENDAR_TIME = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/

/**
 * A time property of the event, such as DTSTART, as a UTC instant and the zone it is written in: the IANA name in
 * its TZID (which may be quoted), or "UTC" for a time written with a trailing `Z`. Null when ACB cannot place the
 * time: the property is missing, a whole day (`VALUE=DATE`), floating (neither a TZID nor a `Z`), in a TZID that
 * is not an IANA zone, or not a time.
 */
function eventTime(
  event: Map<string, Property>,
  name: string
): { at: string; zone: string } | null {
  const property = event.get(name)
  const match = CALENDAR_TIME.exec(property?.value ?? "")
  if (!property || !match) return null
  const [, year, month, day, hour, minute, second, utc] = match
  const zone = utc
    ? "UTC"
    : property.params.get("TZID")?.replace(/^"(.*)"$/, "$1")
  if (!zone || !isTimeZone(zone)) return null
  const at = isoFromLocal(
    `${year}-${month}-${day} ${hour}:${minute}:${second}`,
    zone
  )
  return at === null ? null : { at, zone: canonicalZone(zone) }
}

/**
 * The deadline in a hackathon's calendar file, or null when the file gives none that ACB can place. An online
 * hackathon's calendar holds one event, "<title> submission deadline", which starts at the deadline, so its start
 * is the submission deadline. Any other event, such as an on-site hackathon, runs from a start to an end, and its
 * end is the deadline. The zone is the TZID, an IANA name, which is the organizer's own and not Devpost's Eastern
 * time, or "UTC" for a time written with a `Z`. Null when the file holds no event, or when the time is a whole
 * day, floating, in a zone that is not an IANA zone, or not a time.
 */
export function parseCalendar(text: string): Deadline | null {
  const event = firstEvent(text)
  if (event === null) return null
  const online = /submission deadline$/i.test(
    (event.get("SUMMARY")?.value ?? "").trim()
  )
  const time = eventTime(event, online ? "DTSTART" : "DTEND")
  return time && { kind: online ? "submission" : "end", label: null, ...time }
}

/** "Aug 31 - Oct 23, 2026", "Oct 05 - 27, 2026", "Nov 01, 2026", or "Jul 16, 2026 - Jan 15, 2027". */
const SUBMISSION_PERIOD =
  /^([A-Z][a-z]{2}) (\d{1,2})(?:, (\d{4}))?(?: - (?:([A-Z][a-z]{2}) )?(\d{1,2}), (\d{4}))?$/

/**
 * When the submission period starts, from Devpost's display string, as midnight of its first day in the zone of
 * the hackathon's calendar; null when the string is not one of the known forms, names an impossible date, or
 * starts after it ends. The year is the one written beside the first day, else the one at the end.
 */
export function opensAtFrom(dates: string, zone: string): string | null {
  const match = SUBMISSION_PERIOD.exec(dates.trim())
  if (!match || !isTimeZone(zone)) return null
  const [, startMonth, startDay, startYear, endMonth, endDay, endYear] = match
  const year = Number(startYear ?? endYear)
  const month = monthOf(startMonth)
  if (!year || month === null) return null
  if (endYear !== undefined) {
    const lastMonth = endMonth === undefined ? month : monthOf(endMonth)
    if (lastMonth === null) return null
    const start = year * 10_000 + month * 100 + Number(startDay)
    const end = Number(endYear) * 10_000 + lastMonth * 100 + Number(endDay)
    if (start > end) return null
  }
  return isoFromLocal(
    `${year}-${String(month).padStart(2, "0")}-${startDay.padStart(2, "0")} 00:00:00`,
    zone
  )
}

/**
 * The listing of a hackathon with its deadline from the calendar, or null when the deadline is not ahead, or so
 * far ahead that it is a placeholder. Devpost has no conference or kind field, so every hackathon is a challenge
 * without a conference; the page and the list are the hackathon's own.
 */
export function toListing(
  hackathon: ListedHackathon,
  deadline: Deadline,
  now: Date
): Listing | null {
  const title = cleanText(hackathon.title, 300)
  if (title === null || !endsAhead(Date.parse(deadline.at), now)) return null
  return {
    id: `devpost:${hackathon.id}`,
    source: "devpost",
    kind: "challenge",
    title,
    organizer: hackathon.organizer,
    conference: null,
    url: hackathon.url,
    sourceUrl: hackathon.url,
    opensAt: opensAtFrom(hackathon.dates, deadline.zone),
    deadlines: [deadline],
  }
}
