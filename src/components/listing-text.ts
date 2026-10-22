import type { Locale } from "@/i18n/locales"
import { t } from "@/i18n/messages"
import { conferenceName, type Deadline, type Listing } from "@/lib/listing"

/**
 * What a deadline closes, such as "Quiz Phase 마감" or "참가 신청 마감"; null for a submission deadline, which the
 * deadline column already means, and for the end of a challenge that has no other deadline. Beside phases or an
 * entry deadline, the end is named, "대회 종료", so that it is not taken for a cutoff to submit by.
 */
export function deadlineName(
  deadline: Deadline,
  listing: Listing,
  locale: Locale
): string | null {
  if (deadline.kind === "submission") return null
  if (deadline.kind === "end")
    return listing.deadlines.length > 1 ? t(locale, "deadline.end") : null
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
