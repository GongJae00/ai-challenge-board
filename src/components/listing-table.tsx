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
import { cn } from "@/lib/utils"

import { ListingContext } from "./listing-context"
import { conferenceName, deadlineName, hostName } from "./listing-text"

/** Deadlines a week or less away stand out. */
const SOON_DAYS = 7

/** Columns a phone leaves out; their facts move under the title there. */
const WIDE_ONLY = "hidden sm:table-cell"

interface Props {
  items: AgendaItem[]
  locale: Locale
  now: Date
  timeZone: string
}

/**
 * Open listings as a table, one row each with its next deadline, nearest first. A phone shows the deadline and the
 * title side by side, with the host and type under the title.
 */
export function ListingTable({ items, locale, now, timeZone }: Props) {
  return (
    <Table className="table-fixed break-keep sm:min-w-[56rem]">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={cn("w-36", WIDE_ONLY)}>
            {t(locale, "table.start")}
          </TableHead>
          <TableHead className="w-36 sm:w-60">
            {t(locale, "table.deadline")}
          </TableHead>
          <TableHead className={cn("w-44", WIDE_ONLY)}>
            {t(locale, "table.host")}
          </TableHead>
          <TableHead>{t(locale, "table.title")}</TableHead>
          <TableHead className={cn("w-28", WIDE_ONLY)}>
            {t(locale, "table.kind")}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map(({ listing, deadline }) => {
          const at = new Date(deadline.at)
          const days = daysLeft(deadline.at, now, timeZone)
          const conference = conferenceName(listing)
          const name = deadlineName(deadline, locale)
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
                <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                  <span className="text-foreground tabular-nums sm:hidden">
                    {formatTime(at, locale, timeZone)}
                  </span>
                  <span
                    className={cn(
                      days <= SOON_DAYS && "font-semibold text-foreground"
                    )}
                  >
                    {formatDaysLeft(days, locale)}
                  </span>
                  {name && <span>{name}</span>}
                  {/* A deadline the organizers state in AoE also reads as they announce it. */}
                  {deadline.zone === "AoE" && (
                    <span className="tabular-nums">
                      {formatSourceTime(deadline, locale)}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className={cn("whitespace-normal", WIDE_ONLY)}>
                {hostName(listing) ?? "–"}
                {listing.organizer && conference && (
                  <span className="block text-xs text-muted-foreground">
                    {conference}
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
