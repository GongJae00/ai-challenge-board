// The one list of site languages; astro.config.mjs builds its routing from it.
export const locales = ["ko", "en"] as const
export const defaultLocale = "ko"

export type Locale = (typeof locales)[number]

// The language switcher links to the one other locale.
export function otherLocale(locale: Locale): Locale {
  const other = locales.find((candidate) => candidate !== locale)
  if (!other) throw new Error(`No locale other than ${locale}`)
  return other
}
