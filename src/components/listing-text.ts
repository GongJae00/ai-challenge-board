import type { Locale } from "@/i18n/locales"
import { t } from "@/i18n/messages"
import { conferenceName, type Deadline, type Listing } from "@/lib/listing"

/**
 * What a deadline closes, such as "Quiz Phase 마감" or "대회 종료"; null for a submission deadline, which every
 * listing has and which needs no name.
 */
export function deadlineName(
  deadline: Deadline,
  locale: Locale
): string | null {
  if (deadline.kind === "submission") return null
  if (deadline.kind === "end") return t(locale, "deadline.end")
  if (deadline.kind === "entry") return t(locale, "deadline.entry")
  if (deadline.kind === "merger") return t(locale, "deadline.merger")
  return deadline.label
    ? t(locale, "deadline.phase", { name: deadline.label })
    : t(locale, "deadline.phaseUnnamed")
}

/** Who runs a listing: its organizer, or else its conference, such as "NeurIPS 2026". */
export function hostName(listing: Listing): string | null {
  return listing.organizer ?? conferenceName(listing)
}
