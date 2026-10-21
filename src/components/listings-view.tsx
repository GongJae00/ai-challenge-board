import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Locale } from "@/i18n/locales"
import { t } from "@/i18n/messages"
import { upcoming, upcomingDeadlines } from "@/lib/agenda"
import { DISPLAY_TIME_ZONE } from "@/lib/datetime"
import type { Listing } from "@/lib/listing"

import { ListingCalendar } from "./listing-calendar"
import { ListingTable } from "./listing-table"
import { useNow } from "./use-now"
import { useUrlParam } from "./use-url-param"

const views = ["table", "calendar"] as const
type View = (typeof views)[number]

function isView(value: string): value is View {
  return (views as readonly string[]).includes(value)
}

interface Props {
  listings: Listing[]
  locale: Locale
  /** When the page was built; the page shows the listings as of then until the browser knows the time. */
  builtAt: string
}

/** The open listings, as a table or as a calendar; the chosen view stays in the URL. */
export default function ListingsView({ listings, locale, builtAt }: Props) {
  const now = useNow(builtAt)
  const timeZone = DISPLAY_TIME_ZONE
  const items = upcoming(listings, now)
  const [viewParam, setView] = useUrlParam("view", "table")
  const view: View = isView(viewParam) ? viewParam : "table"

  return (
    <Tabs
      value={view}
      onValueChange={(next) => setView(String(next))}
      className="mt-6 gap-4"
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {t(locale, "home.summary", { count: items.length })}
        </p>
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
          <p>{t(locale, "home.empty")}</p>
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
        <ListingCalendar
          items={upcomingDeadlines(listings, now)}
          locale={locale}
          now={now}
          timeZone={timeZone}
        />
      </TabsContent>
    </Tabs>
  )
}
