import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useEffect } from "react"

import { Button } from "@/components/ui/button"
import type { Locale } from "@/i18n/locales"
import { t } from "@/i18n/messages"
import { addMonths, byDate, monthWeeks, type AgendaItem } from "@/lib/agenda"
import {
  formatDate,
  formatMonth,
  formatSourceTime,
  formatTime,
  weekdayNames,
  zonedDate,
} from "@/lib/datetime"
import { cn } from "@/lib/utils"

import { deadlineName } from "./listing-text"
import { ListingContext } from "./listing-context"
import { useUrlParam } from "./use-url-param"

interface Props {
  /** Every deadline ahead, nearest first. */
  items: AgendaItem[]
  locale: Locale
  now: Date
  timeZone: string
}

function dayAnchor(date: string): string {
  return `deadlines-${date}`
}

/** A disabled month button stays focusable, so it needs its own disabled look. */
const MONTH_BUTTON = "data-disabled:opacity-50"

/**
 * A month calendar of deadlines, from this month to the month of the last deadline, followed by the month's
 * deadlines by date. A day cell counts its deadlines and links to that date in the list, which holds each
 * deadline with its title and time.
 */
export function ListingCalendar({ items, locale, now, timeZone }: Props) {
  const today = zonedDate(now, timeZone)
  const firstMonth = today.slice(0, 7)
  const lastItem = items.at(-1)
  const lastMonth = lastItem
    ? zonedDate(new Date(lastItem.deadline.at), timeZone).slice(0, 7)
    : firstMonth
  // The calendar opens on the month of the first deadline, this month unless filters leave it empty.
  const openingMonth = items[0]
    ? zonedDate(new Date(items[0].deadline.at), timeZone).slice(0, 7)
    : firstMonth
  const [monthParam, setMonth] = useUrlParam("month", openingMonth)
  // A month from the URL outside the range, or not a month at all, falls back to the opening month.
  const month =
    /^\d{4}-\d{2}$/.test(monthParam) &&
    monthParam >= firstMonth &&
    monthParam <= lastMonth
      ? monthParam
      : openingMonth
  const dates = byDate(items, timeZone)
  const monthDates = [...dates].filter(([date]) => date.startsWith(month))
  // A date in the list's headings shows its year only when it is not the year of the month on show.
  const monthReference = new Date(`${month}-15T00:00:00Z`)

  // A day link opened afresh, from a bookmark or a share, lands on the calendar only after hydration, so
  // the browser's own jump to the date has nothing to find; scroll to it once the list exists.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1))
    if (id.startsWith("deadlines-"))
      document.getElementById(id)?.scrollIntoView()
  }, [])

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold" aria-live="polite">
            {formatMonth(month, locale)}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t(locale, "calendar.zone")}
          </p>
        </div>
        <div className="flex gap-1">
          {/* focusableWhenDisabled keeps the keyboard on a button that the move to an end month disables. */}
          <Button
            variant="outline"
            size="icon-lg"
            aria-label={t(locale, "calendar.previous")}
            disabled={month <= firstMonth}
            focusableWhenDisabled
            className={MONTH_BUTTON}
            onClick={() => setMonth(addMonths(month, -1))}
          >
            <ChevronLeftIcon aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon-lg"
            aria-label={t(locale, "calendar.next")}
            disabled={month >= lastMonth}
            focusableWhenDisabled
            className={MONTH_BUTTON}
            onClick={() => setMonth(addMonths(month, 1))}
          >
            <ChevronRightIcon aria-hidden="true" />
          </Button>
        </div>
      </div>

      <table className="mt-3 w-full table-fixed border-collapse text-sm">
        <thead>
          <tr>
            {weekdayNames(locale).map((name) => (
              <th
                key={name}
                scope="col"
                className="pb-2 text-xs font-normal text-muted-foreground"
              >
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthWeeks(month).map((week, i) => (
            <tr key={i}>
              {week.map((date, j) => {
                const list = date ? (dates.get(date) ?? []) : []
                return (
                  <td
                    key={date ?? `pad-${j}`}
                    className={cn(
                      "h-16 border align-top sm:h-20",
                      !date && "bg-muted/40"
                    )}
                  >
                    {date && list.length === 0 && (
                      <span className="block p-1 sm:p-1.5">
                        <DayNumber date={date} today={today} />
                      </span>
                    )}
                    {date && list.length > 0 && (
                      <a
                        href={`#${dayAnchor(date)}`}
                        className="block h-full p-1 hover:bg-muted sm:p-1.5"
                      >
                        <DayNumber date={date} today={today} />
                        <span className="block px-1 text-xs font-medium">
                          {t(locale, "calendar.count", { count: list.length })}
                        </span>
                      </a>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {monthDates.length > 0 && (
        <section className="mt-8">
          <h3 className="font-semibold">
            {t(locale, "calendar.list", { month: formatMonth(month, locale) })}
          </h3>
          {monthDates.map(([date, list]) => (
            <div key={date} id={dayAnchor(date)} className="mt-4 scroll-mt-4">
              <h4 className="text-sm font-medium">
                {formatDate(
                  new Date(list[0].deadline.at),
                  locale,
                  timeZone,
                  monthReference
                )}
              </h4>
              <ul className="mt-1 divide-y border-y">
                {list.map(({ listing, deadline }) => {
                  const name = deadlineName(deadline, locale)
                  const sourceTime = formatSourceTime(
                    deadline,
                    locale,
                    timeZone
                  )
                  return (
                    <li
                      key={`${listing.id}-${listing.deadlines.indexOf(deadline)}`}
                      className="grid grid-cols-[3.5rem_1fr] gap-x-3 py-2.5 break-keep"
                    >
                      <time
                        dateTime={deadline.at}
                        className="text-sm tabular-nums"
                      >
                        {formatTime(new Date(deadline.at), locale, timeZone)}
                      </time>
                      <div className="min-w-0">
                        <a
                          href={listing.url}
                          className="font-medium break-words underline-offset-4 hover:underline"
                        >
                          {listing.title}
                        </a>
                        <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                          <ListingContext listing={listing} locale={locale} />
                          {name && <span>{name}</span>}
                          {sourceTime && (
                            <span className="tabular-nums">{sourceTime}</span>
                          )}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}

function DayNumber({ date, today }: { date: string; today: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
        date === today && "bg-foreground font-semibold text-background"
      )}
    >
      {Number(date.slice(8))}
    </span>
  )
}
