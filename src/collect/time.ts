import type { Deadline } from "../lib/listing.ts"

/**
 * A deadline more than this long after now is a placeholder for "never", not a deadline. Platforms have no flag
 * for an event that stays open, so its hosts enter a far end instead, such as 2030 on Kaggle or 2099 on EvalAI,
 * while time-bound challenges end within months.
 */
export const PLACEHOLDER_AFTER_MS = 2 * 365 * 24 * 60 * 60 * 1000

/** Whether an end is after now and not so far ahead that it is a placeholder for "never". */
export function endsAhead(endMs: number, now: Date): boolean {
  return endMs > now.getTime() && endMs <= now.getTime() + PLACEHOLDER_AFTER_MS
}

/** Milliseconds since the epoch as an ISO 8601 UTC instant. */
export function isoFromMs(ms: number): string {
  return new Date(ms).toISOString()
}

/**
 * The zone to show a deadline in when the source stores only the instant. An instant at 11:59 or 12:00 UTC is
 * 23:59 or midnight Anywhere on Earth (UTC−12), the convention of AI paper deadlines, so it is shown as AoE: the
 * instant is the same either way, and the organizers' announcement then reads the same date and time.
 */
export function deadlineZone(ms: number): Deadline["zone"] {
  const at = new Date(ms)
  const clock = at.getUTCHours() * 60 + at.getUTCMinutes()
  return clock === 11 * 60 + 59 || clock === 12 * 60 ? "AoE" : "UTC"
}

const LOCAL_TIME = /^(20\d{2}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?$/

const DAY_MS = 24 * 60 * 60 * 1000

/** How far a zone's clock is ahead of UTC at an instant, in milliseconds. */
function zoneOffsetMs(ms: number, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(ms)
      .map((part) => [part.type, Number(part.value)])
  )
  const wall = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  )
  return wall - Math.floor(ms / 1000) * 1000
}

/**
 * A local date and time without a zone, such as DACON's "2026-11-02 10:00:00", read in an IANA time zone, as a UTC
 * instant; null when the text is not one. The zone's offset is the one in force at that time, daylight saving
 * included. "24:00", a common way to write the end of a day in Korea, is midnight after that day.
 */
export function isoFromLocal(text: string, timeZone: string): string | null {
  const match = LOCAL_TIME.exec(text.trim())
  if (!match) return null
  const [, date, time, seconds = "00"] = match
  const endOfDay = time === "24:00" && seconds === "00"
  const local = `${date}T${endOfDay ? "00:00" : time}:${seconds}.000Z`
  const wall = Date.parse(local)
  // An impossible time, such as February 30, either fails to parse or rolls over, so it does not read back.
  if (Number.isNaN(wall) || isoFromMs(wall) !== local) return null
  const clock = wall + (endOfDay ? DAY_MS : 0)
  // The offset at a first guess of the instant can differ near a clock change; the offset at the guess settles it.
  const guess = clock - zoneOffsetMs(clock, timeZone)
  return isoFromMs(clock - zoneOffsetMs(guess, timeZone))
}

/** A Korean local date and time without a zone, as `isoFromLocal` reads it in Korean time. */
export function isoFromKst(text: string): string | null {
  return isoFromLocal(text, "Asia/Seoul")
}
