import { SearchIcon } from "lucide-react"
import { useEffect, useId, useMemo, useState, type RefObject } from "react"

import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { Locale } from "@/i18n/locales"
import { t } from "@/i18n/messages"
import type { FacetCounts, Filters } from "@/lib/filter"
import { conferences, conferencesByName, kinds } from "@/lib/listing"
import { platforms, sites } from "@/lib/sites"
import { pick } from "@/lib/utils"

import { useUrlParam } from "./use-url-param"

/** How long the search box waits after the last keystroke before it writes the query to the URL. */
const QUERY_URL_DELAY_MS = 400

/**
 * The filters, kept in the page's query string, `?q=…&kind=…&conference=…&platform=…` with commas between several
 * values, so that a filtered page survives a reload and can be shared. A value that is not one of the choices is
 * ignored. The query filters as it is typed but reaches the URL only once typing pauses, because browsers limit
 * how often a page may rewrite its URL, Safari to about 100 times in 30 seconds.
 */
export function useFilters() {
  const [urlQuery, setUrlQuery] = useUrlParam("q", "")
  const [kind, setKind] = useUrlParam("kind", "")
  const [conference, setConference] = useUrlParam("conference", "")
  const [platform, setPlatform] = useUrlParam("platform", "")
  const [query, setQuery] = useState(urlQuery)
  // The URL's query changes on its own only after hydration and on a return to the page; the box then takes it.
  const [seenUrlQuery, setSeenUrlQuery] = useState(urlQuery)
  if (urlQuery !== seenUrlQuery) {
    setSeenUrlQuery(urlQuery)
    setQuery(urlQuery)
  }
  useEffect(() => {
    if (query === urlQuery) return
    const write = () => setUrlQuery(query)
    const timer = setTimeout(write, QUERY_URL_DELAY_MS)
    // Leaving the page before the pause ends still keeps the query, for the return.
    window.addEventListener("pagehide", write)
    return () => {
      clearTimeout(timer)
      window.removeEventListener("pagehide", write)
    }
  }, [query, urlQuery, setUrlQuery])

  // One object per change of the filters, so that the work that depends on them runs only then.
  const filters: Filters = useMemo(
    () => ({
      query: query.trim(),
      kinds: pick(kind.split(","), kinds),
      conferences: pick(conference.split(","), conferences),
      platforms: pick(platform.split(","), platforms),
    }),
    [query, kind, conference, platform]
  )
  return {
    filters,
    /** The search box's text as typed, spaces included. */
    query,
    active:
      filters.query !== "" ||
      filters.kinds.length > 0 ||
      filters.conferences.length > 0 ||
      filters.platforms.length > 0,
    setQuery,
    setKinds: (values: string[]) => setKind(pick(values, kinds).join(",")),
    // Written in lower case, as the other values are; `pick` reads any case.
    setConferences: (values: string[]) =>
      setConference(
        pick(values, conferences)
          .map((name) => name.toLowerCase())
          .join(",")
      ),
    setPlatforms: (values: string[]) =>
      setPlatform(pick(values, platforms).join(",")),
    clear: () => {
      setQuery("")
      setUrlQuery("")
      setKind("")
      setConference("")
      setPlatform("")
    },
  }
}

interface Props {
  filters: ReturnType<typeof useFilters>
  counts: FacetCounts
  /** The search box, which the clear button beside the summary returns the keyboard to. */
  searchRef: RefObject<HTMLInputElement | null>
  locale: Locale
}

/**
 * The search box, and beneath it one row of chips for each way to narrow the listings: the kinds, the conferences,
 * and the platforms, which a visitor presses. Every conference and platform ACB covers has a chip, so the page
 * shows them all; one with nothing open, or nothing that fits the other filters, has its chip dimmed.
 */
export function ListingFilters({ filters, counts, searchRef, locale }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <SearchBox
        inputRef={searchRef}
        value={filters.query}
        onChange={filters.setQuery}
        locale={locale}
      />
      <div className="grid grid-cols-[auto_1fr] items-start gap-x-4 gap-y-2">
        <ChipRow
          label={t(locale, "filter.kind")}
          options={kinds.map((kind) => ({
            value: kind,
            name: t(locale, `listing.kind.${kind}`),
            count: counts.kinds[kind],
          }))}
          value={filters.filters.kinds}
          onChange={filters.setKinds}
        />
        <ChipRow
          label={t(locale, "filter.conference")}
          options={conferencesByName.map((name) => ({
            value: name,
            name,
            count: counts.conferences[name],
          }))}
          value={filters.filters.conferences}
          onChange={filters.setConferences}
        />
        <ChipRow
          label={t(locale, "filter.platform")}
          options={platforms.map((id) => ({
            value: id,
            name: sites[id].name,
            count: counts.platforms[id],
          }))}
          value={filters.filters.platforms}
          onChange={filters.setPlatforms}
        />
      </div>
    </div>
  )
}

/** The search box; its text lives in `useFilters`, so the browser's input method composes Korean undisturbed. */
function SearchBox({
  inputRef,
  value,
  onChange,
  locale,
}: {
  inputRef: RefObject<HTMLInputElement | null>
  value: string
  onChange: (value: string) => void
  locale: Locale
}) {
  return (
    <div className="relative w-full sm:w-80">
      <SearchIcon
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        ref={inputRef}
        type="search"
        aria-label={t(locale, "filter.search")}
        placeholder={t(locale, "filter.searchPlaceholder")}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        // The browser's own clear button in a search field takes no design tokens; the summary's clear button
        // covers it.
        className="pl-8 [&::-webkit-search-cancel-button]:appearance-none"
      />
    </div>
  )
}

/**
 * One filter's name and its choices as chips, any number pressed; pressing none sets no filter. The name labels
 * the group for screen readers, and each chip's count follows its name after a space, as in "NeurIPS 13".
 */
function ChipRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; name: string; count: number }[]
  value: T[]
  onChange: (value: string[]) => void
}) {
  const id = useId()
  // A row whose chips are all dimmed has nothing to focus, so the row itself takes the tab stop, which keeps a
  // row that scrolls sideways on a phone reachable by keyboard.
  const allDisabled = options.every(
    (option) => option.count === 0 && !value.includes(option.value)
  )
  return (
    <>
      <span
        id={id}
        className="flex h-7 items-center text-sm text-muted-foreground sm:h-8"
      >
        {label}
      </span>
      {/* A toolbar, since arrow keys move between its chips. A phone keeps each row to one line that scrolls
          sideways, so the listings stay in view; a wider screen wraps the row. */}
      <ToggleGroup
        multiple
        role="toolbar"
        aria-labelledby={id}
        tabIndex={allDisabled ? 0 : undefined}
        value={value}
        onValueChange={onChange}
        spacing={1.5}
        className="w-full min-w-0 [scrollbar-width:none] flex-nowrap gap-1.5 overflow-x-auto sm:w-fit sm:flex-wrap sm:overflow-visible"
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            variant="outline"
            // A pressed chip stays enabled, so that it can be released.
            disabled={option.count === 0 && !value.includes(option.value)}
            // A phone gets smaller chips, so the rows leave the listings in view.
            className="h-7 rounded-full px-2.5 text-[0.8125rem] aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background sm:h-8 sm:px-3 sm:text-sm"
          >
            {option.name}{" "}
            {option.count > 0 && (
              <span className="font-normal tabular-nums opacity-60">
                {option.count}
              </span>
            )}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </>
  )
}
