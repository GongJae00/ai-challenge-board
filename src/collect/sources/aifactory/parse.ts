import { z } from "zod"

import { minuteOf } from "../../../lib/datetime.ts"
import type { Deadline, Listing } from "../../../lib/listing.ts"
import { flightText, jsonAt } from "../../flight.ts"
import { cleanName, cleanText } from "../../text.ts"
import { endsAhead, isoFromMs } from "../../time.ts"

const instant = z.iso.datetime()

/** AIFactory's list entry for a competition, as the page's data carries it. */
const taskSchema = z.object({
  id: z.string().regex(/^\d+$/),
  type: z.number(),
  name: z.string(),
  startDate: instant,
  endDate: instant,
  participationStartDate: instant.optional(),
  participationDeadline: instant.optional(),
})

export type Task = z.infer<typeof taskSchema>

/** AIFactory's type for a competition (경진대회); seminars are type 2. */
const COMPETITION = 1
/** Titles of practice entries and of recruitment posts, which the list mixes in with the competitions. */
const NOT_A_CHALLENGE = ["[연습용]", "(채용"]

// The page is a server-rendered Next.js page; `src/collect/flight.ts` reads the data it ships.
const TASK_KEY = '"task":'
const ORGANIZER_ROLE = "주최"
// A row of the detail page: an element keyed "<role>-<name>-<n>", whose props follow the key.
const ORGANIZER_ROW = new RegExp(
  `\\["\\$","[A-Za-z0-9$]+","(${ORGANIZER_ROLE}-(?:[^"\\\\]|\\\\.)*-\\d+)",(?=\\{)`,
  "g"
)

/**
 * Every object that follows a `"task":` key in the flight text. Other occurrences of the key hold a reference
 * such as `"$1f"`, a string, and are skipped.
 */
export function extractTasks(text: string): unknown[] {
  const tasks: unknown[] = []
  for (
    let at = text.indexOf(TASK_KEY);
    at !== -1;
    at = text.indexOf(TASK_KEY, at + TASK_KEY.length)
  ) {
    const start = at + TASK_KEY.length
    if (text[start] === "{")
      tasks.push(jsonAt(text, start, "AIFactory task object"))
  }
  return tasks
}

function hasId(item: unknown): boolean {
  return typeof item === "object" && item !== null && "id" in item
}

/**
 * The competitions on the list page, each once; fails when the page holds none or one does not fit. A competition
 * always has an id; the page's interface strings also sit under a `"task"` key, without one, and are skipped.
 */
export function parseTasks(html: string): Task[] {
  const found = extractTasks(flightText(html)).filter(hasId)
  if (found.length === 0)
    throw new Error("AIFactory list page holds no competitions")
  const byId = new Map<string, Task>()
  for (const item of found) {
    const result = taskSchema.safeParse(item)
    if (!result.success)
      throw new Error(
        `AIFactory competition does not fit: ${z.prettifyError(result.error)}`
      )
    if (!byId.has(result.data.id)) byId.set(result.data.id, result.data)
  }
  return [...byId.values()]
}

/** The competition's page, which the listing links to and takes its facts from. */
export function listingUrl(id: string): string {
  return `https://aifactory.space/ko/competitions/${id}`
}

/** Whether the competition is a time-bound challenge that ends after now, as ACB lists them. */
export function inScope(task: Task, now: Date): boolean {
  const end = Date.parse(task.endDate)
  return (
    task.type === COMPETITION &&
    !NOT_A_CHALLENGE.some((prefix) =>
      task.name.trimStart().startsWith(prefix)
    ) &&
    cleanText(task.name, 300) !== null &&
    endsAhead(end, now)
  )
}

/** A date AIFactory filled in: it stores an empty one as the epoch, 1970-01-01. */
function given(date: string | undefined): string | undefined {
  return date && Date.parse(date) > 0 ? date : undefined
}

/**
 * The listing of a competition that is in scope. AIFactory gives each date as an instant, which the organizers
 * entered in Korean time and the site shows in it, so every deadline carries the zone KST with the instant
 * unchanged. The end of the competition period is the final deadline. The deadline to join comes first when it
 * is still ahead and falls before the end; some entries have it after the end, or as 1970-01-01, which the
 * comparison with now also rules out.
 */
export function toListing(
  task: Task,
  organizer: string | null,
  now: Date
): Listing {
  const title = cleanText(task.name, 300)
  if (title === null)
    throw new Error(`AIFactory competition ${task.id} has no title`)
  const url = listingUrl(task.id)
  const end = Date.parse(task.endDate)
  const entry = task.participationDeadline
    ? Date.parse(task.participationDeadline)
    : null
  const deadlines: Deadline[] = []
  if (
    entry !== null &&
    entry > now.getTime() &&
    minuteOf(entry) < minuteOf(end)
  )
    deadlines.push({
      kind: "entry",
      label: null,
      at: isoFromMs(entry),
      zone: "KST",
    })
  deadlines.push({ kind: "end", label: null, at: isoFromMs(end), zone: "KST" })

  return {
    id: `aifactory:${task.id}`,
    source: "aifactory",
    kind: "challenge",
    title,
    organizer: cleanName(organizer ?? undefined, 200),
    conference: null,
    url,
    sourceUrl: url,
    opensAt: isoFromMs(
      Date.parse(given(task.participationStartDate) ?? task.startDate)
    ),
    deadlines,
  }
}

/** The text strings of a flight element's children, in reading order. */
function texts(node: unknown): string[] {
  if (typeof node === "string") return [node]
  if (Array.isArray(node))
    return node[0] === "$" ? texts(node[3]) : node.flatMap(texts)
  if (typeof node === "object" && node !== null)
    return texts((node as { children?: unknown }).children)
  return []
}

/**
 * The 주최 (host) of a competition from its page, or null when the page does not state it as a row. Newer pages
 * render a row for each organization, keyed "주최-<name>-<n>", with the role and then the name as text; older
 * pages give the organizers only in the description's free text, which is not read. Several hosts are joined
 * with a comma. The page must hold flight data, or its markup has changed.
 */
export function parseOrganizer(html: string): string | null {
  const text = flightText(html)
  if (text === "") throw new Error("AIFactory competition page holds no data")
  const names: string[] = []
  for (const match of text.matchAll(ORGANIZER_ROW)) {
    const props = jsonAt(
      text,
      match.index + match[0].length,
      "AIFactory organizer row"
    )
    const [role, ...rest] = texts(props)
    const name = rest.join("").trim()
    if (role?.trim() === ORGANIZER_ROLE && name !== "" && !names.includes(name))
      names.push(name)
  }
  return names.length > 0 ? names.join(", ") : null
}
