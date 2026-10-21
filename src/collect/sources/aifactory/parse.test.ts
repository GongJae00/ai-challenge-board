import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { listingSchema } from "../../../lib/listing.ts"
import {
  extractTasks,
  inScope,
  listingUrl,
  parseOrganizer,
  parseTasks,
  toListing,
  type Task,
} from "./parse.ts"

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")
}

const listHtml = fixture("list-excerpt.html")
const structuredHtml = fixture("detail-9306-structured.html")
const freeTextHtml = fixture("detail-9237-freetext-organizers.html")
const tasks = parseTasks(listHtml)

function task(id: string): Task {
  const found = tasks.find((t) => t.id === id)
  if (!found) throw new Error(`fixture has no task ${id}`)
  return found
}

/** A page whose flight scripts carry `payloads`, written as the site writes them. */
function page(...payloads: string[]): string {
  const scripts = payloads.map(
    (p) => `<script>self.__next_f.push([1,${JSON.stringify(p)}])</script>`
  )
  return `<html><body>${scripts.join("")}</body></html>`
}

/** A competition as the list carries it. */
function taskJson(id: string, extra = ""): string {
  return `{"task":{"id":"${id}","type":1,"name":"a","startDate":"2026-01-01T00:00:00.000Z","endDate":"2026-02-01T00:00:00.000Z"${extra}}}`
}

describe("extractTasks", () => {
  it("reads the object after each task key and skips the string references", () => {
    const text =
      '[{"task":{"id":"1","name":"a"},"x":{"task":"$1f"}},{"task":{"id":"2"}}]'
    expect(extractTasks(text)).toEqual([{ id: "1", name: "a" }, { id: "2" }])
  })

  it("skips a task key inside a string that holds escaped JSON", () => {
    const text = `[{"meta":"{\\"task\\":{\\"id\\":\\"9\\"}}"},${taskJson("2")}]`
    expect(extractTasks(text)).toEqual([JSON.parse(taskJson("2")).task])
  })

  it("keeps braces, quotes, and escapes inside strings out of the brace count", () => {
    const text =
      '{"task":{"id":"1","name":"a } \\" { b \\\\","page":{"name":"c"}}}'
    expect(extractTasks(text)).toEqual([
      { id: "1", name: 'a } " { b \\', page: { name: "c" } },
    ])
  })

  it("fails on an object that is cut off", () => {
    expect(() => extractTasks('{"task":{"id":"1","name":"a')).toThrow(
      /AIFactory/
    )
  })
})

describe("parseTasks", () => {
  it("finds the 19 competitions in the list excerpt, each once", () => {
    expect(tasks).toHaveLength(19)
    expect(new Set(tasks.map((t) => t.id)).size).toBe(19)
    expect(tasks.map((t) => t.id).slice(0, 3)).toEqual(["9306", "9307", "9304"])
  })

  it("reads the fields the listing needs, with the ones AIFactory leaves out as empty", () => {
    expect(task("9306")).toMatchObject({
      id: "9306",
      type: 1,
      name: "주제 3: 국립공원 내 시설물 변화 탐지",
      startDate: "2026-09-14T01:00:00.000Z",
      endDate: "2026-10-06T05:00:00.000Z",
      participationStartDate: "2026-07-31T01:00:00.000Z",
      participationDeadline: "2026-10-06T05:00:00.000Z",
    })
    expect(task("2105").participationStartDate).toBeUndefined()
    expect(task("2105").participationDeadline).toBeUndefined()
  })

  it("skips the page's interface strings, which sit under a task key too", () => {
    // The live page carries its translation table as "task":{"status":{...},...}, an object without an id.
    const strings = '"task":{"status":{"upcoming":"진행예정","closed":"종료"}}'
    expect(parseTasks(page(`1:[{${strings}},${taskJson("7")}]`))).toHaveLength(
      1
    )
  })

  it("lists a competition that appears twice once", () => {
    const entry = taskJson("7")
    expect(parseTasks(page(`1:[${entry},${entry}]`))).toHaveLength(1)
  })

  it("fails when the page holds no task object, since the markup has changed", () => {
    expect(() => parseTasks(page('1:["$","ul",null,{"task":"$1f"}]'))).toThrow(
      /no competitions/
    )
    expect(() => parseTasks("<html>Access denied</html>")).toThrow(
      /no competitions/
    )
  })

  it("fails when a task does not fit, naming the field", () => {
    const badDate = taskJson("7").replace("2026-01-01T00:00:00.000Z", "soon")
    expect(() => parseTasks(page(`1:[${badDate}]`))).toThrow(/startDate/)
    expect(() => parseTasks(page(`1:[${taskJson("x7")}]`))).toThrow(/at id/)
  })
})

describe("inScope", () => {
  const ids = (now: string) =>
    tasks.filter((t) => inScope(t, new Date(now))).map((t) => t.id)

  it("keeps the competitions that end after now", () => {
    expect(ids("2026-09-01T00:00:00Z")).toEqual([
      "9306",
      "9307",
      "9304",
      "9305",
    ])
  })

  it("keeps none when every competition has ended", () => {
    expect(ids("2026-10-21T00:00:00Z")).toEqual([])
  })

  it("leaves out practice entries and recruitment posts", () => {
    // 2369 "[연습용] 추론자동화 제출_시계열 분야" and 2004 "(채용)💡 Project manager / 연구개발" are open here.
    const practiceNow = new Date("2025-06-01T00:00:00Z")
    const recruitNow = new Date("2022-03-01T00:00:00Z")
    expect(inScope(task("2369"), practiceNow)).toBe(false)
    expect(
      inScope({ ...task("2369"), name: "추론자동화 제출" }, practiceNow)
    ).toBe(true)
    expect(inScope(task("2004"), recruitNow)).toBe(false)
    expect(
      inScope({ ...task("2004"), name: "Project manager" }, recruitNow)
    ).toBe(true)
  })

  it("leaves out a seminar, which is not type 1", () => {
    expect(
      inScope({ ...task("9306"), type: 2 }, new Date("2026-09-01T00:00:00Z"))
    ).toBe(false)
  })

  it("leaves out an end more than two years ahead as a placeholder", () => {
    const now = new Date("2026-09-01T00:00:00Z")
    const ends = (endDate: string) => inScope({ ...task("9306"), endDate }, now)
    expect(ends("2028-09-02T00:00:00.000Z")).toBe(false)
    expect(ends("2028-08-30T00:00:00.000Z")).toBe(true)
  })
})

describe("toListing", () => {
  const now = new Date("2026-09-01T00:00:00Z")

  it("fills the fields ACB shows and fits the schema", () => {
    const listing = toListing(task("9304"), "국립공원공단", now)
    expect(listing).toMatchObject({
      id: "aifactory:9304",
      source: "aifactory",
      kind: "challenge",
      title: "주제 1: 구상나무 고사 탐지 및 분포 분석",
      organizer: "국립공원공단",
      conference: null,
      url: "https://aifactory.space/ko/competitions/9304",
      sourceUrl: "https://aifactory.space/ko/competitions/9304",
      opensAt: "2026-07-31T01:00:00.000Z",
    })
    expect(listingSchema.safeParse(listing).success).toBe(true)
  })

  it("links to the competition page", () => {
    expect(listingUrl("9304")).toBe(
      "https://aifactory.space/ko/competitions/9304"
    )
  })

  it("gives the entry and end deadlines in Korean time, with the instants unchanged", () => {
    expect(toListing(task("9304"), null, now).deadlines).toEqual([
      {
        kind: "entry",
        label: null,
        at: "2026-09-11T01:00:00.000Z",
        zone: "KST",
      },
      { kind: "end", label: null, at: "2026-09-21T05:00:00.000Z", zone: "KST" },
    ])
  })

  it("leaves out an entry deadline in the same minute as the end", () => {
    expect(toListing(task("9306"), null, now).deadlines).toEqual([
      { kind: "end", label: null, at: "2026-10-06T05:00:00.000Z", zone: "KST" },
    ])
    const stray = {
      ...task("9306"),
      participationDeadline: "2026-10-06T05:00:30.000Z",
    }
    expect(toListing(stray, null, now).deadlines).toHaveLength(1)
  })

  it("leaves out an entry deadline that is already past", () => {
    // 9237 closes registration on 2026-01-02 and ends on 2026-04-30.
    const kinds = (at: string) =>
      toListing(task("9237"), null, new Date(at)).deadlines.map((d) => d.kind)
    expect(kinds("2025-12-20T00:00:00Z")).toEqual(["entry", "end"])
    expect(kinds("2026-02-01T00:00:00Z")).toEqual(["end"])
  })

  it("leaves out an entry deadline after the end", () => {
    // 2234: participationDeadline 2023-07-16, endDate 2023-06-19.
    const listing = toListing(
      task("2234"),
      null,
      new Date("2023-03-01T00:00:00Z")
    )
    expect(listing.deadlines.map((d) => d.kind)).toEqual(["end"])
  })

  it("keeps an entry deadline that falls before the start", () => {
    // 9159: participationDeadline 2025-07-31, startDate 2025-08-01.
    const listing = toListing(
      task("9159"),
      null,
      new Date("2025-07-20T00:00:00Z")
    )
    expect(listing.deadlines.map((d) => d.at)).toEqual([
      "2025-07-31T14:59:00.000Z",
      "2025-09-25T08:00:00.000Z",
    ])
  })

  it("leaves out the 1970 placeholder as an entry deadline", () => {
    // 2086: participationDeadline 1970-01-01.
    const listing = toListing(
      task("2086"),
      null,
      new Date("2022-09-01T00:00:00Z")
    )
    expect(listing.deadlines.map((d) => d.kind)).toEqual(["end"])
  })

  it("has only the end deadline when participationDeadline is absent", () => {
    const listing = toListing(
      task("2105"),
      null,
      new Date("2022-09-01T00:00:00Z")
    )
    expect(listing.deadlines.map((d) => d.kind)).toEqual(["end"])
  })

  it("opens at the start of the competition when registration has no start", () => {
    const listing = toListing(
      task("2105"),
      null,
      new Date("2022-09-01T00:00:00Z")
    )
    expect(listing.opensAt).toBe("2022-08-29T00:00:00.000Z")
  })

  it("opens at the start of the competition when registration starts at the 1970 placeholder", () => {
    const listing = toListing(
      { ...task("2105"), participationStartDate: "1970-01-01T00:00:00.000Z" },
      null,
      new Date("2022-09-01T00:00:00Z")
    )
    expect(listing.opensAt).toBe("2022-08-29T00:00:00.000Z")
  })

  it("cleans the title and the organizer", () => {
    const listing = toListing(
      { ...task("9304"), name: "  A\n  title " },
      "  Org\u0000 ",
      now
    )
    expect(listing.title).toBe("A title")
    expect(listing.organizer).toBe("Org")
    expect(toListing(task("9304"), null, now).organizer).toBeNull()
  })
})

describe("parseOrganizer", () => {
  it("reads 주최 from the structured rows and trims the name", () => {
    expect(parseOrganizer(structuredHtml)).toBe("국립공원공단")
  })

  it("is empty for a page that states the organizers only in free text", () => {
    expect(parseOrganizer(freeTextHtml)).toBeNull()
  })

  it("joins several 주최 rows and ignores the other roles", () => {
    const row = (role: string, name: string, n: number) =>
      `["$","div","${role}-${name}-${n}",{"children":[["$","span",null,{"children":"${role}"}],["$","span",null,{"children":"${name}"}]]}]`
    const html = page(
      `64:["$","div",null,{"children":[${row("주최", "가기관", 0)},${row("주관", "나기관", 1)},${row("주최", "다기관 ", 2)}]}]\n`
    )
    expect(parseOrganizer(html)).toBe("가기관, 다기관")
  })

  it("fails when the page has no flight data, since the markup has changed", () => {
    expect(() => parseOrganizer("<html>Not found</html>")).toThrow(/AIFactory/)
  })
})
