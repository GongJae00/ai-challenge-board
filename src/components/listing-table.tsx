import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Locale } from "@/i18n/locales"
import { t } from "@/i18n/messages"
import { daysLeft, type AgendaItem } from "@/lib/agenda"
import {
  formatDate,
  formatDaysLeft,
  formatSourceTime,
  formatTime,
} from "@/lib/datetime"
import { conferenceName, hostName } from "@/lib/listing"
import { platformName } from "@/lib/sites"
import { nextSort, type Sort, type SortColumn } from "@/lib/sort"
import { cn } from "@/lib/utils"

import { ListingContext } from "./listing-context"
import { deadlineName } from "./listing-text"

/** Deadlines a week or less away stand out. */
const SOON_DAYS = 7

/** Columns a phone leaves out; their facts move under the title there. */
const WIDE_ONLY = "hidden sm:table-cell"

interface Props {
  /** The rows in the order `sort` names; the table does not reorder them. */
  items: AgendaItem[]
  sort: Sort
  onSort: (sort: Sort) => void
  locale: Locale
  now: Date
  timeZone: string
}

interface SortHeadProps {
  column: SortColumn
  sort: Sort
  onSort: (sort: Sort) => void
  locale: Locale
  className?: string
}

/** A column header that sorts the table by its column; a second click reverses the order. */
function SortHead({ column, sort, onSort, locale, className }: SortHeadProps) {
  const active = sort.column === column
  const Icon = !active ? ChevronsUpDown : sort.descending ? ArrowDown : ArrowUp
  return (
    <TableHead
      className={className}
      aria-sort={
        active ? (sort.descending ? "descending" : "ascending") : undefined
      }
    >
      <button
        type="button"
        onClick={() => onSort(nextSort(sort, column))}
        className="-ml-1.5 inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {t(locale, `table.${column}`)}
        <Icon
          aria-hidden="true"
          className={cn("size-3.5", !active && "text-muted-foreground/60")}
        />
      </button>
    </TableHead>
  )
}

/**
 * Open listings as a table, one row each with its next deadline, in the order the visitor sorted them by, the
 * nearest deadline first to begin with. A phone shows the deadline and the title side by side, with the host and
 * type under the title.
 */
export function ListingTable({
  items,
  sort,
  onSort,
  locale,
  now,
  timeZone,
}: Props) {
  const head = { sort, onSort, locale }
  return (
    <Table className="table-fixed break-keep sm:min-w-[56rem]">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <SortHead
            column="start"
            className={cn("w-36", WIDE_ONLY)}
            {...head}
          />
          <SortHead column="deadline" className="w-36 sm:w-64" {...head} />
          <SortHead column="host" className={cn("w-44", WIDE_ONLY)} {...head} />
          <SortHead column="title" {...head} />
          <SortHead column="kind" className={cn("w-28", WIDE_ONLY)} {...head} />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map(({ listing, deadline }) => {
          const at = new Date(deadline.at)
          const days = daysLeft(deadline.at, now, timeZone)
          const conference = conferenceName(listing)
          const platform = platformName(listing)
          const host = hostName(listing)
          const name = deadlineName(deadline, listing, locale)
          const sourceTime = formatSourceTime(deadline, locale, timeZone)
          return (
            <TableRow key={listing.id} className="*:align-top">
              <TableCell
                className={cn("text-muted-foreground tabular-nums", WIDE_ONLY)}
              >
                {listing.opensAt
                  ? formatDate(new Date(listing.opensAt), locale, timeZone, now)
                  : "–"}
              </TableCell>
              <TableCell className="whitespace-normal">
                {/* A phone keeps the time on the second line, so that a date with its year still fits the first. */}
                <time dateTime={deadline.at} className="block font-medium">
                  {formatDate(at, locale, timeZone, now)}
                  <span className="hidden tabular-nums sm:inline">
                    {" "}
                    {formatTime(at, locale, timeZone)}
                  </span>
                </time>
                {/* A wide screen keeps the second line to one line: a long phase name gives way, cut short, to the
                    days left and the source's time. */}
                <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground sm:flex-nowrap">
                  <span className="text-foreground tabular-nums sm:hidden">
                    {formatTime(at, locale, timeZone)}
                  </span>
                  <span
                    className={cn(
                      "sm:shrink-0",
                      days <= SOON_DAYS && "font-semibold text-foreground"
                    )}
                  >
                    {formatDaysLeft(days, locale)}
                  </span>
                  {name && (
                    <span title={name} className="min-w-0 sm:truncate">
                      {name}
                    </span>
                  )}
                  {sourceTime && (
                    <span className="tabular-nums sm:shrink-0">
                      {sourceTime}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className={cn("whitespace-normal", WIDE_ONLY)}>
                {/* With no organizer or conference, the platform is the only host the row knows. */}
                {host ?? platform ?? "–"}
                {host && ((listing.organizer && conference) || platform) && (
                  <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                    {listing.organizer && conference && (
                      <span>{conference}</span>
                    )}
                    {platform && <span>{platform}</span>}
                  </span>
                )}
              </TableCell>
              <TableCell className="whitespace-normal">
                <a
                  href={listing.url}
                  className="font-medium break-words underline-offset-4 hover:underline"
                >
                  {listing.title}
                </a>
                <span className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground sm:hidden">
                  <ListingContext listing={listing} locale={locale} />
                </span>
              </TableCell>
              <TableCell className={cn("whitespace-normal", WIDE_ONLY)}>
                {t(locale, `listing.kind.${listing.kind}`)}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
