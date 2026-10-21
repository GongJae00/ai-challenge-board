import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Locale } from "@/i18n/locales"
import { t } from "@/i18n/messages"
import { upcoming, upcomingDeadlines } from "@/lib/agenda"
import { DISPLAY_TIME_ZONE } from "@/lib/datetime"
import { facetCounts, filterListings } from "@/lib/filter"
import type { Listing } from "@/lib/listing"
import { isOneOf } from "@/lib/utils"

import { ListingCalendar } from "./listing-calendar"
import { ListingFilters, useFilters } from "./listing-filters"
import { ListingTable } from "./listing-table"
import { useNow } from "./use-now"
import { useUrlParam } from "./use-url-param"

const views = ["table", "calendar"] as const
type View = (typeof views)[number]

/** A value as it stood once it stopped changing for `delayMs`. */
function useSettled<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return settled
}

interface Props {
  listings: Listing[]
  locale: Locale
  /** When the page was built; the page shows the listings as of then until the browser knows the time. */
  builtAt: string
}

/**
 * The open listings, as a table or as a calendar, narrowed by the filters above them; the chosen view and the
 * filters stay in the URL.
 */
export default function ListingsView({ listings, locale, builtAt }: Props) {
  const now = useNow(builtAt)
  const timeZone = DISPLAY_TIME_ZONE
  const filters = useFilters()
  // The open listings change only with the clock; the filters then narrow them on every keystroke.
  const all = useMemo(() => upcoming(listings, now), [listings, now])
  const open = useMemo(() => all.map(({ listing }) => listing), [all])
  const shown = useMemo(
    () => new Set(filterListings(open, filters.filters)),
    [open, filters.filters]
  )
  const items = useMemo(
    () => all.filter(({ listing }) => shown.has(listing)),
    [all, shown]
  )
  const counts = useMemo(
    () => facetCounts(open, filters.filters),
    [open, filters.filters]
  )
  const search = useRef<HTMLInputElement>(null)
  const [viewParam, setView] = useUrlParam("view", "table")
  const view: View = isOneOf(views, viewParam) ? viewParam : "table"
  // With nothing open at all, the page says so rather than blaming the filters.
  const noMatch = filters.active && all.length > 0 && items.length === 0
  const summary = filters.active
    ? t(locale, "home.summaryFiltered", {
        count: items.length,
        total: all.length,
      })
    : t(locale, "home.summary", { count: items.length })
  // Screen readers hear the count once typing pauses, not after every keystroke.
  const announced = useSettled(summary, 700)

  return (
    <>
      <div className="mt-6">
        <ListingFilters
          filters={filters}
          counts={counts}
          searchRef={search}
          locale={locale}
        />
      </div>
      <Tabs
        value={view}
        onValueChange={(next) => setView(String(next))}
        className="mt-4 gap-4"
      >
        <div className="flex items-center justify-between gap-4">
          {/* The clear button sits beside the count it resets, so the search box keeps its width. */}
          <div className="flex min-h-8 items-center gap-2">
            <p className="text-sm text-muted-foreground">{summary}</p>
            {filters.active && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => {
                  filters.clear()
                  // The button goes away with the filters, so the keyboard continues from the search box.
                  search.current?.focus()
                }}
              >
                {t(locale, "filter.clear")}
              </Button>
            )}
            <span className="sr-only" aria-live="polite">
              {announced}
            </span>
          </div>
          <TabsList className="group-data-horizontal/tabs:h-9">
            {views.map((value) => (
              <TabsTrigger key={value} value={value} className="px-3">
                {t(locale, `view.${value}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {/* The panels hold links, so they need no tab stop of their own. */}
        <TabsContent value="table" tabIndex={-1}>
          {items.length === 0 ? (
            <p>{t(locale, noMatch ? "home.noMatch" : "home.empty")}</p>
          ) : (
            <ListingTable
              items={items}
              locale={locale}
              now={now}
              timeZone={timeZone}
            />
          )}
        </TabsContent>
        <TabsContent value="calendar" tabIndex={-1}>
          {noMatch ? (
            <p>{t(locale, "home.noMatch")}</p>
          ) : (
            <ListingCalendar
              items={upcomingDeadlines([...shown], now)}
              locale={locale}
              now={now}
              timeZone={timeZone}
            />
          )}
        </TabsContent>
      </Tabs>
    </>
  )
}
