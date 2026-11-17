// Only types come from the schema file: a runtime import would bring zod back into the pages' bundle.
import type { Listing } from "./listing-schema.ts"

/** The sources ACB collects from; each has a collector under `src/collect/sources/`. */
export const sourceIds = [
  "openreview",
  "evalai",
  "codabench",
  "kaggle",
  "dacon",
  "aifactory",
  "drivendata",
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

/**
 * The AI conferences ACB covers, grouped by field: vision, machine learning, AI, language, medical imaging,
 * robotics, data mining, and speech. An IEEE conference goes by its own name, such as ICRA.
 */
export const conferences = [
  "CVPR",
  "ICCV",
  "ECCV",
  "WACV",
  "NeurIPS",
  "ICML",
  "ICLR",
  "IJCNN",
  "AAAI",
  "ACL",
  "EMNLP",
  "NAACL",
  "MICCAI",
  "ISBI",
  "CoRL",
  "ICRA",
  "IROS",
  "KDD",
  "ICASSP",
] as const
export type Conference = (typeof conferences)[number]

/** The conferences in alphabetical order, as the pages list them. */
export const conferencesByName = [...conferences].sort((a, b) =>
  a.localeCompare(b, "en")
)

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

/** The conference a listing belongs to as the pages show it, such as "NeurIPS 2026", or null. */
export function conferenceName(listing: Listing): string | null {
  return listing.conference
    ? `${listing.conference.name} ${listing.conference.year}`
    : null
}

/** Who runs a listing: its organizer, or else its conference, such as "NeurIPS 2026". */
export function hostName(listing: Listing): string | null {
  return listing.organizer ?? conferenceName(listing)
}

export type { Deadline, Listing, SourceFile } from "./listing-schema.ts"
