import { zonedDate } from "./datetime.ts"
import type { Deadline, Listing } from "./listing.ts"

/** A listing together with one of its deadlines. */
export interface AgendaItem {
  listing: Listing
  deadline: Deadline
}

/** The earliest deadline still ahead of `now`, or null when all have passed. */
export function nextDeadline(listing: Listing, now: Date): Deadline | null {
  let next: Deadline | null = null
  for (const deadline of listing.deadlines) {
    const at = Date.parse(deadline.at)
    if (at <= now.getTime()) continue
    if (next === null || at < Date.parse(next.at)) next = deadline
  }
  return next
}

function byDeadline(a: AgendaItem, b: AgendaItem): number {
  return (
    Date.parse(a.deadline.at) - Date.parse(b.deadline.at) ||
    a.listing.title.localeCompare(b.listing.title)
  )
}

/** Each listing with a deadline ahead, with that next deadline, nearest first; ties go by title. */
export function upcoming(listings: Listing[], now: Date): AgendaItem[] {
  return listings
    .flatMap((listing) => {
      const deadline = nextDeadline(listing, now)
      return deadline ? [{ listing, deadline }] : []
    })
    .sort(byDeadline)
}

/** Every deadline still ahead, one item each, nearest first: a challenge appears once for each phase. */
export function upcomingDeadlines(
  listings: Listing[],
  now: Date
): AgendaItem[] {
  return listings
    .flatMap((listing) =>
      listing.deadlines
        .filter((deadline) => Date.parse(deadline.at) > now.getTime())
        .map((deadline) => ({ listing, deadline }))
    )
    .sort(byDeadline)
}

/** Items grouped by the date of their deadline in the viewer's time zone, keeping their order. */
export function byDate(
  items: AgendaItem[],
  timeZone: string
): Map<string, AgendaItem[]> {
  const dates = new Map<string, AgendaItem[]>()
  for (const item of items) {
    const date = zonedDate(new Date(item.deadline.at), timeZone)
    dates.set(date, [...(dates.get(date) ?? []), item])
  }
  return dates
}

/** Whole calendar days from today to the deadline's date, both in the viewer's time zone; 0 means today. */
export function daysLeft(at: string, now: Date, timeZone: string): number {
  const day = (date: Date) => Date.parse(`${zonedDate(date, timeZone)}T00:00Z`)
  return Math.round((day(new Date(at)) - day(now)) / 86_400_000)
}

/** A `YYYY-MM` month moved by a number of months. */
export function addMonths(month: string, count: number): string {
  const [year, index] = month.split("-").map(Number)
  const moved = new Date(Date.UTC(year, index - 1 + count, 1))
  return moved.toISOString().slice(0, 7)
}

/**
 * The weeks of a `YYYY-MM` month, Sunday first, each a list of seven `YYYY-MM-DD` dates or null for the days
 * that belong to the month before or after.
 */
export function monthWeeks(month: string): (string | null)[][] {
  const [year, index] = month.split("-").map(Number)
  const first = new Date(Date.UTC(year, index - 1, 1))
  const length = new Date(Date.UTC(year, index, 0)).getUTCDate()
  const cells: (string | null)[] = Array(first.getUTCDay()).fill(null)
  for (let day = 1; day <= length; day += 1)
    cells.push(`${month}-${String(day).padStart(2, "0")}`)
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}
