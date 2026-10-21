import {
  conferenceName,
  conferences,
  kinds,
  type Conference,
  type Kind,
  type Listing,
} from "./listing.ts"
import { platformName, platforms, type PlatformId } from "./sites.ts"
import { fold, namedConferences } from "./words.ts"

/**
 * What a visitor narrows the listings by. A listing passes a list when it has one of the kinds, names one of the
 * conferences, or runs on one of the platforms listed; an empty list, like an empty query, lets every listing pass.
 */
export interface Filters {
  query: string
  kinds: Kind[]
  conferences: Conference[]
  platforms: PlatformId[]
}

/** A listing's searchable text and conferences, worked out once, since every keystroke filters every listing. */
const prepared = new WeakMap<
  Listing,
  { text: string; conferences: Set<Conference> }
>()

function prepare(listing: Listing) {
  let entry = prepared.get(listing)
  if (!entry) {
    entry = {
      // What a listing's row shows of it, besides the type the chips cover.
      text: fold(
        [
          listing.title,
          listing.organizer,
          conferenceName(listing),
          platformName(listing),
        ]
          .filter(Boolean)
          .join("\n")
      ),
      conferences: namedConferences(listing),
    }
    prepared.set(listing, entry)
  }
  return entry
}

type Facet = "kinds" | "conferences" | "platforms"

/** Whether a listing passes one list of the filters. */
function passes(listing: Listing, filters: Filters, facet: Facet): boolean {
  if (facet === "kinds")
    return filters.kinds.length === 0 || filters.kinds.includes(listing.kind)
  if (facet === "platforms")
    return (
      filters.platforms.length === 0 ||
      (filters.platforms as string[]).includes(listing.source)
    )
  if (filters.conferences.length === 0) return true
  const { conferences: named } = prepare(listing)
  return filters.conferences.some((name) => named.has(name))
}

/** The listings that pass the query and every list but `except`, in their order. */
function filterAllBut(
  listings: Listing[],
  filters: Filters,
  except: Facet | null
): Listing[] {
  const terms = fold(filters.query).split(/\s+/).filter(Boolean)
  const facets = (["kinds", "conferences", "platforms"] as const).filter(
    (facet) => facet !== except
  )
  return listings.filter((listing) => {
    if (!facets.every((facet) => passes(listing, filters, facet))) return false
    if (terms.length === 0) return true
    const { text } = prepare(listing)
    return terms.every((term) => text.includes(term))
  })
}

/**
 * The listings that pass every filter, in their order. A query matches when each of its space-separated terms
 * appears somewhere in the listing's text, so that part of a Korean word finds it without splitting the word.
 */
export function filterListings(
  listings: Listing[],
  filters: Filters
): Listing[] {
  return filterAllBut(listings, filters, null)
}

/** How many listings each kind, conference, and platform has, for a count beside its filter. */
export interface FacetCounts {
  kinds: Record<Kind, number>
  conferences: Record<Conference, number>
  platforms: Record<PlatformId, number>
}

function countEach<T extends string>(
  values: readonly T[],
  listings: Listing[],
  has: (listing: Listing, value: T) => boolean
): Record<T, number> {
  return Object.fromEntries(
    values.map((value) => [
      value,
      listings.filter((listing) => has(listing, value)).length,
    ])
  ) as Record<T, number>
}

/**
 * The listings of each kind, conference, and platform that pass the query and the other lists, so that a count
 * does not change when another choice in its own row is picked, and a count of 0 marks a choice that would show
 * nothing more.
 */
export function facetCounts(
  listings: Listing[],
  filters: Filters
): FacetCounts {
  return {
    kinds: countEach(
      kinds,
      filterAllBut(listings, filters, "kinds"),
      (listing, kind) => listing.kind === kind
    ),
    conferences: countEach(
      conferences,
      filterAllBut(listings, filters, "conferences"),
      (listing, name) => prepare(listing).conferences.has(name)
    ),
    platforms: countEach(
      platforms,
      filterAllBut(listings, filters, "platforms"),
      (listing, source) => listing.source === source
    ),
  }
}
