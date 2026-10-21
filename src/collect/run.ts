import { z } from "zod"

import {
  listingSchema,
  type Listing,
  type SourceFile,
  type SourceId,
} from "../lib/listing.ts"
import type { Client } from "./http.ts"

/**
 * The half of the UTC day an instant falls in, such as "2026-10-21 PM". A source is fetched at most once in each
 * half, so at most twice a day, and a scheduled run that starts late still falls in its own half.
 */
export function collectionWindow(at: Date): string {
  return `${at.toISOString().slice(0, 10)} ${at.getUTCHours() < 12 ? "AM" : "PM"}`
}

/** One collector: it fetches a source through the shared client and returns its open listings. */
export interface Source {
  id: SourceId
  collect(client: Client, now: Date): Promise<Listing[]>
}

/**
 * What a run did and the file to write, if any. A kept source writes its previous file with the new
 * `attemptedAt`, so that a failed attempt also counts toward the twice-a-day limit.
 */
export type RunResult =
  | { outcome: "updated"; file: SourceFile; reason?: undefined }
  | { outcome: "kept"; file?: SourceFile; reason: string }
  | { outcome: "skipped"; file?: undefined; reason: string }

function lastDeadline(listing: Listing): number {
  return Math.max(...listing.deadlines.map((d) => Date.parse(d.at)))
}

/**
 * Collects one source and decides what to publish. The last good data stays when the source fails, when a
 * listing does not fit the schema, or when more than half of the listings that should still be open vanish,
 * which points to a changed or broken source rather than to calls that closed.
 */
export async function runSource(input: {
  source: Source
  client: Client
  now: Date
  previous: SourceFile | null
}): Promise<RunResult> {
  const { source, client, now, previous } = input
  const lastAttempt = previous?.attemptedAt ?? previous?.retrievedAt
  if (
    lastAttempt &&
    collectionWindow(new Date(lastAttempt)) === collectionWindow(now)
  )
    return { outcome: "skipped", reason: `last attempted at ${lastAttempt}` }

  const keep = (reason: string): RunResult => ({
    outcome: "kept",
    reason,
    file: previous
      ? { ...previous, attemptedAt: now.toISOString() }
      : undefined,
  })

  let listings: Listing[]
  try {
    const collected = await source.collect(client, now)
    const checked = z.array(listingSchema).safeParse(collected)
    if (!checked.success)
      return keep(
        `a listing does not fit the schema: ${z.prettifyError(checked.error)}`
      )
    listings = checked.data
  } catch (error) {
    return keep(error instanceof Error ? error.message : String(error))
  }

  if (previous) {
    const stillOpen = previous.listings.filter(
      (l) => lastDeadline(l) > now.getTime()
    ).length
    if (stillOpen >= 5 && listings.length < stillOpen / 2)
      return keep(
        `${stillOpen} listings should still be open, but the source returned ${listings.length}`
      )
  }

  return {
    outcome: "updated",
    file: {
      source: source.id,
      retrievedAt: now.toISOString(),
      listings: [...listings].sort((a, b) => a.id.localeCompare(b.id)),
    },
  }
}
