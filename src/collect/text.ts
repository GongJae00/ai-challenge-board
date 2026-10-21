// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g

/** Text from another site, as one line of plain text: control characters removed, whitespace collapsed. */
export function cleanText(
  text: string | undefined,
  maxLength: number
): string | null {
  if (text === undefined) return null
  const clean = text
    .replace(CONTROL_CHARACTERS, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (clean === "") return null
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 1)}…` : clean
}

/** A link from another site as an absolute http(s) URL, adding https:// to a bare host; null when it is not one. */
export function webUrl(text: string | undefined): string | null {
  const raw = text?.trim()
  if (!raw) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`
  try {
    const url = new URL(withScheme)
    if (url.protocol !== "https:" && url.protocol !== "http:") return null
    if (!url.hostname.includes(".")) return null
    return url.href
  } catch {
    return null
  }
}
