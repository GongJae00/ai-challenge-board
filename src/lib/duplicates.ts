import { minuteOf } from "./datetime.ts"
import type { Deadline, Listing, SourceId } from "./listing.ts"
import { isConferenceWord, namedConferences, words } from "./words.ts"

/**
 * Which listing of a pair stands for both, lower first: a challenge platform's, which has the phases and the page
 * where entrants submit, before OpenReview's, which records a challenge only as a workshop venue. Ties go by id.
 */
const SOURCE_RANK: Record<SourceId, number> = {
  evalai: 0,
  codabench: 0,
  kaggle: 0,
  dacon: 0,
  aifactory: 0,
  openreview: 1,
}

/** Words that join a challenge's name to its conference, as in "… at NeurIPS 2026". */
const CONTEXT_WORDS = new Set(["at", "the"])

const YEAR = /^20\d\d$/

/**
 * A title's words without those that say where or when a listing runs, which one source puts in a title and
 * another leaves out: conference names, years, and context words. Sorted, or "" when nothing else is left.
 */
function titleKey(title: string): string {
  const kept = words(title).filter(
    (word) =>
      !CONTEXT_WORDS.has(word) && !isConferenceWord(word) && !YEAR.test(word)
  )
  return [...new Set(kept)].sort().join(" ")
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
  return minuteOf(Date.parse(deadline.at))
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
