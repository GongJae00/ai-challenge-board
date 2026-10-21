import { z } from "zod"

/** The sources ACB collects from; each has a collector under `src/collect/sources/`. */
export const sourceIds = [
  "openreview",
  "evalai",
  "codabench",
  "kaggle",
  "dacon",
  "aifactory",
  "drivendata",
  "lablab",
  "zindi",
  "signate",
  "tianchi",
  "devpost",
  "grandchallenge",
  "aicrowd",
] as const
export type SourceId = (typeof sourceIds)[number]

/** A time-bound challenge or competition, or a workshop's call for papers. */
export const kinds = ["challenge", "cfp"] as const
export type Kind = (typeof kinds)[number]

export const conferences = [
  "CVPR",
  "ICCV",
  "ECCV",
  "NeurIPS",
  "ICML",
  "ICLR",
  "AAAI",
] as const
export type Conference = (typeof conferences)[number]

/** The conferences in alphabetical order, as the pages list them. */
export const conferencesByName = [...conferences].sort((a, b) =>
  a.localeCompare(b, "en")
)

/** An instant in UTC, written as ISO 8601 with a `Z`. */
const instant = z.iso.datetime()

/** Only web links reach the pages, so a `javascript:` or `data:` link from a source never becomes an href. */
const webUrl = z.url({ protocol: /^https?$/ })

/**
 * Short codes for the zones deadlines most often come in, each with its IANA zone; a deadline in any other zone
 * carries the zone's IANA name, such as "America/Los_Angeles".
 */
export const zoneCodes = {
  UTC: "UTC",
  AoE: "Etc/GMT+12",
  KST: "Asia/Seoul",
  JST: "Asia/Tokyo",
} as const

/** IANA's names for UTC itself, which say no more than the code `UTC`. */
const UTC_NAMES = new Set([
  "UTC",
  "Etc/UTC",
  "Etc/UCT",
  "UCT",
  "Etc/GMT",
  "Etc/GMT0",
  "Etc/GMT+0",
  "Etc/GMT-0",
  "GMT",
  "GMT0",
  "Etc/Greenwich",
  "Greenwich",
  "Etc/Zulu",
  "Zulu",
  "Etc/Universal",
  "Universal",
])

/** A deadline's zone as stored: `UTC` for any of IANA's names for UTC, and any other zone as given. */
export function canonicalZone(zone: string): string {
  return UTC_NAMES.has(zone) ? "UTC" : zone
}

/** Whether a name is an IANA time zone the runtime knows, such as "America/Los_Angeles". */
export function isTimeZone(name: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: name })
    return true
  } catch {
    return false
  }
}

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

/** The conference a listing belongs to as the pages show it, such as "NeurIPS 2026", or null. */
export function conferenceName(listing: Listing): string | null {
  return listing.conference
    ? `${listing.conference.name} ${listing.conference.year}`
    : null
}
