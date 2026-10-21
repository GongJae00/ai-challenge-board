import {
  conferences,
  type Conference,
  type Deadline,
  type Listing,
  type SourceId,
} from "./listing.ts"

/**
 * Which listing of a pair stands for both, lower first: a challenge platform's, which has the phases and the page
 * where entrants submit, before OpenReview's, which records a challenge only as a workshop venue. Ties go by id.
 */
const SOURCE_RANK: Record<SourceId, number> = {
  evalai: 0,
  codabench: 0,
  kaggle: 0,
  openreview: 1,
}

const CONFERENCE_WORDS = new Map<string, Conference>(
  conferences.map((name) => [name.toLowerCase(), name])
)

/** Words that say where or when a listing runs, which one source puts in a title and another leaves out. */
const CONTEXT_WORDS = new Set<string>([...CONFERENCE_WORDS.keys(), "at", "the"])

const YEAR = /^20\d\d$/

function words(title: string): string[] {
  return (
    title
      .normalize("NFKC")
      .toLowerCase()
      .match(/\p{L}+|\p{N}+/gu) ?? []
  )
}

/** A title's words without context words and years, sorted, or "" when nothing else is left. */
function titleKey(title: string): string {
  const kept = words(title).filter(
    (word) => !CONTEXT_WORDS.has(word) && !YEAR.test(word)
  )
  return [...new Set(kept)].sort().join(" ")
}

/** The conferences a listing names, in its conference field or its title. */
function namedConferences(listing: Listing): Set<Conference> {
  const named = new Set<Conference>()
  if (listing.conference) named.add(listing.conference.name)
  for (const word of words(listing.title)) {
    const name = CONFERENCE_WORDS.get(word)
    if (name) named.add(name)
  }
  return named
}

/** False when both name a conference and the conferences, or the years both state, disagree. */
function sameConference(a: Listing, b: Listing): boolean {
  if (a.conference && b.conference)
    return (
      a.conference.name === b.conference.name &&
      a.conference.year === b.conference.year
    )
  const aNamed = namedConferences(a)
  const bNamed = namedConferences(b)
  return (
    aNamed.size === 0 ||
    bNamed.size === 0 ||
    [...aNamed].some((name) => bNamed.has(name))
  )
}

function minute(deadline: Deadline): number {
  return Math.floor(Date.parse(deadline.at) / 60_000)
}

function shareDeadline(a: Listing, b: Listing): boolean {
  const aMinutes = new Set(a.deadlines.map(minute))
  return b.deadlines.some((deadline) => aMinutes.has(minute(deadline)))
}

/** The kept listing with the facts it lacks and the deadlines it does not have, to the minute, from the other. */
function absorb(kept: Listing, other: Listing): Listing {
  const minutes = new Set(kept.deadlines.map(minute))
  const added = other.deadlines.filter((d) => !minutes.has(minute(d)))
  return {
    ...kept,
    organizer: kept.organizer ?? other.organizer,
    conference: kept.conference ?? other.conference,
    opensAt: kept.opensAt ?? other.opensAt,
    deadlines: added.length
      ? [...kept.deadlines, ...added].sort(
          (a, b) => Date.parse(a.at) - Date.parse(b.at)
        )
      : kept.deadlines,
  }
}

/**
 * The listings with each challenge or call that several sources carry listed once. Two listings from different
 * sources are the same when they have the same kind and title key, conferences that agree, and a deadline in the
 * same minute. The one `SOURCE_RANK` prefers is kept and absorbs the other.
 */
export function mergeDuplicates(listings: Listing[]): Listing[] {
  const ranked = [...listings].sort(
    (a, b) =>
      SOURCE_RANK[a.source] - SOURCE_RANK[b.source] ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  )
  const merged: { listing: Listing; sources: Set<SourceId> }[] = []
  const byTitle = new Map<string, number[]>()
  for (const listing of ranked) {
    const title = titleKey(listing.title)
    const key = `${listing.kind} ${title}`
    const seen = title ? (byTitle.get(key) ?? []) : []
    const match = seen.find((index) => {
      const entry = merged[index]
      return (
        !entry.sources.has(listing.source) &&
        sameConference(entry.listing, listing) &&
        shareDeadline(entry.listing, listing)
      )
    })
    if (match === undefined) {
      if (title) byTitle.set(key, [...seen, merged.length])
      merged.push({ listing, sources: new Set([listing.source]) })
      continue
    }
    const entry = merged[match]
    entry.listing = absorb(entry.listing, listing)
    entry.sources.add(listing.source)
  }
  return merged.map((entry) => entry.listing)
}
