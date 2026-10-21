import type { Locale } from "@/i18n/locales"
import { t } from "@/i18n/messages"
import type { Listing } from "@/lib/listing"

import { hostName } from "./listing-text"

/** A listing's type and host as two items, such as "논문 모집" and "NeurIPS 2026", for a line of secondary facts. */
export function ListingContext({
  listing,
  locale,
}: {
  listing: Listing
  locale: Locale
}) {
  const host = hostName(listing)
  return (
    <>
      <span>{t(locale, `listing.kind.${listing.kind}`)}</span>
      {host && <span>{host}</span>}
    </>
  )
}
