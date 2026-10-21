/**
 * Reading the data a server-rendered Next.js page ships as `self.__next_f.push([1,"…"])` scripts, its flight data,
 * without running the page.
 */

const FLIGHT_SCRIPT = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g

/** The page's flight data: every script's string literal decoded and joined in order. */
export function flightText(html: string): string {
  return [...html.matchAll(FLIGHT_SCRIPT)]
    .map((match) => JSON.parse(match[1]) as string)
    .join("")
}

const CLOSING: Record<string, string> = { "{": "}", "[": "]" }

/** The index of the bracket that closes the object or array opening at `start`, or -1 when the text ends first. */
function valueEnd(text: string, start: number): number {
  const open = text[start]
  const close = CLOSING[open]
  let depth = 0
  let inString = false
  for (let i = start; i < text.length; i += 1) {
    const char = text[i]
    if (inString) {
      if (char === "\\") i += 1
      else if (char === '"') inString = false
    } else if (char === '"') inString = true
    else if (char === open) depth += 1
    else if (char === close) {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

/**
 * The JSON object or array that opens at `start` in the flight text; `what` names it in the error when it is cut
 * off or does not parse, such as "AIFactory task object".
 */
export function jsonAt(text: string, start: number, what: string): unknown {
  if (!(text[start] in CLOSING))
    throw new Error(`${what} does not start with { or [`)
  const end = valueEnd(text, start)
  if (end === -1) throw new Error(`${what} is cut off`)
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch (error) {
    throw new Error(`${what} does not parse: ${String(error)}`, {
      cause: error,
    })
  }
}
