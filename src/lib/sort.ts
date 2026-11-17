import type { Locale } from "@/i18n/locales"

import type { AgendaItem } from "./agenda.ts"
import { zonedDate } from "./datetime.ts"
import { hostName, kinds } from "./listing.ts"
import { platformName } from "./sites.ts"

/** The table's columns a visitor can sort by, named as the `?sort=` parameter writes them. */
export const sortColumns = [
  "start",
  "deadline",
  "host",
  "title",
  "kind",
] as const
export type SortColumn = (typeof sortColumns)[number]

export interface Sort {
  column: SortColumn
  descending: boolean
}

/** The columns a phone shows, which `WIDE_ONLY` in `listing-table.tsx` leaves visible; a phone sorts only by these. */
export const phoneSortColumns: readonly SortColumn[] = ["deadline", "title"]

/** The order the page opens in: the nearest deadline first. */
export const defaultSort: Sort = { column: "deadline", descending: false }

/** Reads `?sort=title` as ascending and `?sort=-title` as descending; anything else is the default order. */
export function parseSort(param: string): Sort {
  const descending = param.startsWith("-")
  const column = descending ? param.slice(1) : param
  return (sortColumns as readonly string[]).includes(column)
    ? { column: column as SortColumn, descending }
    : defaultSort
}

export function formatSort({ column, descending }: Sort): string {
  return descending ? `-${column}` : column
}

/** What a click on a column's header sorts by: the column ascending, or the reverse when it is already sorted. */
export function nextSort(current: Sort, column: SortColumn): Sort {
  return {
    column,
    descending: current.column === column && !current.descending,
  }
}

/**
 * A column's value for an item as the row shows it; null when the row shows none. A start date is shown as a day
 * in `timeZone`, so starts within one day are equal. A type sorts in the order of the type chips, not by its
 * translated name, so that the order is the same in both languages.
 */
function sortKey(
  { listing, deadline }: AgendaItem,
  column: SortColumn,
  timeZone: string
): string | number | null {
  switch (column) {
    case "start":
      return listing.opensAt
        ? Date.parse(zonedDate(new Date(listing.opensAt), timeZone))
        : null
    case "deadline":
      return Date.parse(deadline.at)
    case "host":
      return hostName(listing) ?? platformName(listing)
    case "title":
      return listing.title
    case "kind":
      return kinds.indexOf(listing.kind)
  }
}

/**
 * The items ordered by one column, in a new array. A listing with nothing in the column stays last whichever way
 * the column goes, and listings equal in the column keep the nearest deadline first.
 */
export function sortItems(
  items: AgendaItem[],
  { column, descending }: Sort,
  locale: Locale,
  timeZone: string
): AgendaItem[] {
  const collator = new Intl.Collator(locale, { numeric: true })
  const sign = descending ? -1 : 1
  const keyed = items.map((item) => ({
    item,
    key: sortKey(item, column, timeZone),
  }))
  keyed.sort((a, b) => {
    if (a.key === null || b.key === null) {
      if (a.key !== b.key) return a.key === null ? 1 : -1
    } else if (typeof a.key === "number" && typeof b.key === "number") {
      if (a.key !== b.key) return sign * (a.key - b.key)
    } else {
      const order = collator.compare(String(a.key), String(b.key))
      if (order !== 0) return sign * order
    }
    return Date.parse(a.item.deadline.at) - Date.parse(b.item.deadline.at)
  })
  return keyed.map(({ item }) => item)
}
