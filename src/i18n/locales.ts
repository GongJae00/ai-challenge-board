// The one list of site languages; astro.config.mjs builds its routing from it.
export const locales = ["ko", "en"] as const
export const defaultLocale = "ko"

export type Locale = (typeof locales)[number]

/** Each language in its own words, as the language menu lists it. */
export const localeNames: Record<Locale, string> = {
  ko: "한국어",
  en: "English",
}
