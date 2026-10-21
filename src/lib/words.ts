import { conferences, type Conference, type Listing } from "./listing.ts"

/** Text as it is compared: NFKC, so that full-width and other compatibility forms match their plain ones, in lower case. */
export function fold(text: string): string {
  return text.normalize("NFKC").toLowerCase()
}

/** A text's words, folded: its runs of letters and of digits. */
export function words(text: string): string[] {
  return fold(text).match(/\p{L}+|\p{N}+/gu) ?? []
}

const CONFERENCE_WORDS = new Map<string, Conference>(
  conferences.map((name) => [name.toLowerCase(), name])
)

/** Whether a folded word is a conference's name. */
export function isConferenceWord(word: string): boolean {
  return CONFERENCE_WORDS.has(word)
}

/**
 * The conferences a listing belongs to: the one its conference field states, or else those its title names, as
 * Codabench titles such as "NeurIPS Predictive AI Evaluation Competition" do. A title can also mention conferences
 * a listing merely relates to, which is why the field wins when it is filled.
 */
export function namedConferences(listing: Listing): Set<Conference> {
  const named = new Set<Conference>()
  if (listing.conference) return named.add(listing.conference.name)
  for (const word of words(listing.title)) {
    const name = CONFERENCE_WORDS.get(word)
    if (name) named.add(name)
  }
  return named
}
