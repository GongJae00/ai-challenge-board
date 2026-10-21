import type { Deadline } from "./listing.ts"

/** Anywhere on Earth is UTC−12, which the IANA database names Etc/GMT+12. */
const SOURCE_ZONES: Record<Deadline["zone"], string> = {
  UTC: "UTC",
  AoE: "Etc/GMT+12",
  KST: "Asia/Seoul",
}

const clock = { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } as const

/**
 * The zone every date and time on the pages is shown in. GongJae chose Korean time for all readers on
 * 2026-10-21; a reader's own region can replace it once readers can set one.
 */
export const DISPLAY_TIME_ZONE = "Asia/Seoul"

/** The calendar date of an instant in a time zone, as `YYYY-MM-DD`. */
export function zonedDate(at: Date, timeZone: string): string {
  // The Swedish locale writes dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("sv-SE", { timeZone }).format(at)
}

/** A `YYYY-MM` month as the locale names it, such as "2026년 11월" or "November 2026". */
export function formatMonth(month: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`))
}

/**
 * A date with its weekday, such as "11월 16일 (월)" or "Mon, Nov 16", and with the year when it is not the year
 * of `now`, such as "2027년 1월 8일 (금)".
 */
export function formatDate(
  at: Date,
  locale: string,
  timeZone: string,
  now: Date
): string {
  const year = (date: Date) => zonedDate(date, timeZone).slice(0, 4)
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    ...(year(at) === year(now) ? {} : { year: "numeric" }),
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(at)
}

/** The time of day on a 24-hour clock, such as "20:59". */
export function formatTime(at: Date, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, { timeZone, ...clock }).format(at)
}

/**
 * The deadline in the zone the source states it in, with its date, such as "AoE 11월 15일 23:59", so that it reads
 * as the organizers announce it; a deadline at midnight AoE is ambiguous without the date. Null when the source
 * states no zone of its own (`UTC`) or states the zone the page shows times in.
 */
export function formatSourceTime(
  deadline: Deadline,
  locale: string,
  timeZone: string
): string | null {
  if (deadline.zone === "UTC" || SOURCE_ZONES[deadline.zone] === timeZone)
    return null
  const text = new Intl.DateTimeFormat(locale, {
    timeZone: SOURCE_ZONES[deadline.zone],
    month: "short",
    day: "numeric",
    ...clock,
  }).format(new Date(deadline.at))
  return `${deadline.zone} ${text}`
}

/** Days until a date as the locale says it, such as "내일", "31일 후", or "in 31 days". */
export function formatDaysLeft(days: number, locale: string): string {
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
    days,
    "day"
  )
}

/** The short weekday names, Sunday first, such as "일 월 화" or "Sun Mon Tue". */
export function weekdayNames(locale: string): string[] {
  const format = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    timeZone: "UTC",
  })
  // 2026-11-01 is a Sunday.
  return Array.from({ length: 7 }, (_, i) =>
    format.format(new Date(Date.UTC(2026, 10, 1 + i)))
  )
}
