import { z } from "zod"

import {
  conferences,
  isTimeZone,
  kinds,
  sourceIds,
  zoneCodes,
} from "./listing.ts"

// The schema is for the collector and the content collection. Pages import `listing.ts` instead, so that zod stays
// out of the client bundle, where its feature probe `Function("")` is blocked by the page's CSP.

/** An instant in UTC, written as ISO 8601 with a `Z`. */
const instant = z.iso.datetime()

/** Only web links reach the pages, so a `javascript:` or `data:` link from a source never becomes an href. */
const webUrl = z.url({ protocol: /^https?$/ })

export const deadlineSchema = z.object({
  /**
   * A final submission deadline, the end of one challenge phase, the end of a whole challenge, the last day to
   * join (Kaggle's entry deadline), or the last day to merge teams.
   */
  kind: z.enum(["submission", "phase", "end", "entry", "merger"]),
  /** The source's name for the deadline, such as a phase's name; null when the kind says it all. */
  label: z.string().min(1).nullable(),
  at: instant,
  /**
   * The time zone the source states the deadline in, as a code from `zoneCodes` or an IANA name. "UTC" also covers
   * sources that give only an instant.
   */
  zone: z.union([
    z.enum(Object.keys(zoneCodes) as [keyof typeof zoneCodes]),
    z.string().refine(isTimeZone, "not an IANA time zone"),
  ]),
})
export type Deadline = z.infer<typeof deadlineSchema>

export const listingSchema = z.object({
  /** `<source>:<the source's own id>`, stable across runs. */
  id: z.string().regex(/^[a-z]+:\S+$/),
  source: z.enum(sourceIds),
  kind: z.enum(kinds),
  title: z.string().min(1).max(300),
  organizer: z.string().min(1).max(200).nullable(),
  conference: z
    .object({ name: z.enum(conferences), year: z.number().int() })
    .nullable(),
  /** Where a visitor reads about the listing, such as the workshop's own site. */
  url: webUrl,
  /** The source page the facts were taken from. */
  sourceUrl: webUrl,
  opensAt: instant.nullable(),
  deadlines: z.array(deadlineSchema).min(1),
})
export type Listing = z.infer<typeof listingSchema>

/** What the collector writes for one source, in `src/data/sources/<source>.json`. */
export const sourceFileSchema = z.object({
  source: z.enum(sourceIds),
  retrievedAt: instant,
  /** The last run that fetched the source but kept the data above, when it came after `retrievedAt`. */
  attemptedAt: instant.optional(),
  listings: z.array(listingSchema),
})
export type SourceFile = z.infer<typeof sourceFileSchema>
