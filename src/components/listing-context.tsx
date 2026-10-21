import type { Locale } from "@/i18n/locales"
import { t } from "@/i18n/messages"
import type { Listing } from "@/lib/listing"
import { platformName } from "@/lib/sites"

import { hostName } from "./listing-text"

/**
 * A listing's type, host, and platform as items, such as "챌린지", "해양수산부", and "DACON", for a line of
 * secondary facts.
 */
export function ListingContext({
  listing,
  locale,
}: {
  listing: Listing
  locale: Locale
}) {
  const host = hostName(listing)
  const platform = platformName(listing)
  return (
    <>
      <span>{t(locale, `listing.kind.${listing.kind}`)}</span>
      {host && <span>{host}</span>}
      {platform && <span>{platform}</span>}
    </>
  )
}
