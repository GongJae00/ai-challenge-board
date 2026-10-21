import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { listingSchema } from "../../../lib/listing.ts"
import {
  inScope,
  listingUrl,
  parseEvents,
  toListing,
  type LablabEvent,
} from "./parse.ts"

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")
}

/** A time before every event in the fixtures, so that each is read in full. */
const before = new Date("2020-01-01T00:00:00Z")

const events = parseEvents(fixture("list-excerpt.html"), before)

function event(slug: string): LablabEvent {
  const found = events.find((e) => e.slug === slug)
  if (!found) throw new Error(`fixture has no event ${slug}`)
  return found
}

/** A page whose flight scripts carry `payloads`, written as the site writes them. */
function page(...payloads: string[]): string {
  const scripts = payloads.map(
    (p) => `<script>self.__next_f.push([1,${JSON.stringify(p)}])</script>`
  )
  return `<html><body>${scripts.join("")}</body></html>`
}

/** An event as the list carries it, with the keys ACB reads. */
function eventJson(slug: string): string {
  return `{"name":"a","slug":"${slug}","startAt":"2026-01-01T00:00:00.000Z","endAt":"2026-02-01T00:00:00.000Z","timezone":null}`
}

/** The page with the given events in its `sortedEvents` array. */
function sorted(...items: string[]): string {
  return page(
    `22:["$","$L23",null,{"sortedEvents":[${items.join(",")}],"teamsActive":true}]`
  )
}

describe("parseEvents", () => {
  it("finds the six events in the list excerpt, in page order", () => {
    expect(events.map((e) => e.slug)).toEqual([
      "amd-lablab-ai-academy-challenge",
      "vultr-hackathon",
      "amd-developer-hackathon-act-iii",
      "assemblyai-voice-agent-hackathon",
      "qualcomm-x-meta-executorch-hackathon",
      "wework-gpt3-codex",
    ])
  })

  it("reads the fields the listing needs and nothing else", () => {
    expect(event("vultr-hackathon")).toEqual({
      name: "Vultr: Agent Rush Hackathon",
      slug: "vultr-hackathon",
      startAt: "2026-11-03T15:00:00.000Z",
      endAt: "2026-11-08T22:00:00.000Z",
      timezone: null,
    })
  })

  it("reads the timezone an organizer set", () => {
    expect(event("amd-developer-hackathon-act-iii").timezone).toBe(
      "Europe/Rome"
    )
  })

  it("reads an event whose description is a reference to a text row", () => {
    // The page holds "description":"$24" and, elsewhere, the row "24:T35,Application deadline: …".
    expect(event("qualcomm-x-meta-executorch-hackathon")).toEqual({
      name: "ExecuTorch Hackathon",
      slug: "qualcomm-x-meta-executorch-hackathon",
      startAt: "2026-06-27T20:00:00.000Z",
      endAt: "2026-06-28T20:00:00.000Z",
      timezone: null,
    })
  })

  it("lists an event that appears twice once", () => {
    const entry = eventJson("a")
    expect(parseEvents(sorted(entry, entry), before)).toHaveLength(1)
  })

  it("fails when the page has no flight data, since the markup has changed", () => {
    expect(() => parseEvents("<html>Access denied</html>", before)).toThrow(
      /no events/
    )
  })

  it("fails when the page has flight data without the event list", () => {
    expect(() => parseEvents(page('1:["$","div",null,{}]'), before)).toThrow(
      /no events/
    )
  })

  it("fails when the event list is empty, since the page always lists past events", () => {
    expect(() => parseEvents(sorted(), before)).toThrow(/no events/)
  })

  it("fails when the event list is cut off", () => {
    expect(() =>
      parseEvents(page('1:{"sortedEvents":[{"name":"a"'), before)
    ).toThrow(/cut off/)
  })

  it("leaves out a past event without reading the rest of it", () => {
    const past = eventJson("old").replace(
      '"startAt":"2026-01-01T00:00:00.000Z"',
      '"startAt":null'
    )
    const after = new Date("2026-03-01T00:00:00Z")
    expect(parseEvents(sorted(past), after)).toEqual([])
  })

  it("leaves out an event whose end does not read", () => {
    const noEnd = eventJson("a").replace("2026-02-01T00:00:00.000Z", "later")
    expect(
      parseEvents(sorted(noEnd, eventJson("b")), before).map((e) => e.slug)
    ).toEqual(["b"])
  })

  it("fails when an event does not fit, naming the field", () => {
    const badDate = eventJson("a").replace("2026-01-01T00:00:00.000Z", "soon")
    expect(() => parseEvents(sorted(badDate), before)).toThrow(/startAt/)
    expect(() => parseEvents(sorted(eventJson("not a slug")), before)).toThrow(
      /slug/
    )
    const badZone = eventJson("a").replace(
      '"timezone":null',
      '"timezone":"Mars/Base"'
    )
    expect(() => parseEvents(sorted(badZone), before)).toThrow(/timezone/)
  })
})

describe("inScope", () => {
  const slugs = (now: string) =>
    events.filter((e) => inScope(e, new Date(now))).map((e) => e.slug)

  it("keeps the live and the upcoming event", () => {
    expect(slugs("2026-10-21T12:00:00Z")).toEqual([
      "amd-lablab-ai-academy-challenge",
      "vultr-hackathon",
    ])
  })

  it("keeps the event with a timezone while it is ahead", () => {
    expect(slugs("2026-10-10T00:00:00Z")).toEqual([
      "amd-lablab-ai-academy-challenge",
      "vultr-hackathon",
      "amd-developer-hackathon-act-iii",
    ])
  })

  it("keeps none when every event has ended", () => {
    expect(slugs("2026-12-02T00:00:00Z")).toEqual([])
  })

  it("leaves out an event that ends before it starts, even when its end is ahead", () => {
    const anomaly = event("wework-gpt3-codex")
    const now = new Date("2022-05-01T00:00:00Z")
    expect(anomaly.endAt < anomaly.startAt).toBe(true)
    expect(inScope(anomaly, now)).toBe(false)
    // The same event with its end after its start is ahead of now, so the order is what leaves it out.
    expect(
      inScope({ ...anomaly, endAt: "2022-05-25T00:00:00.000Z" }, now)
    ).toBe(true)
    expect(inScope({ ...anomaly, endAt: anomaly.startAt }, now)).toBe(false)
  })

  it("leaves out an end more than two years ahead as a placeholder", () => {
    const now = new Date("2026-10-21T00:00:00Z")
    const ends = (endAt: string) =>
      inScope({ ...event("vultr-hackathon"), endAt }, now)
    expect(ends("2028-10-22T00:00:00.000Z")).toBe(false)
    expect(ends("2028-10-20T00:00:00.000Z")).toBe(true)
  })

  it("leaves out an event with no title", () => {
    expect(
      inScope(
        { ...event("vultr-hackathon"), name: " \n" },
        new Date("2026-10-21T00:00:00Z")
      )
    ).toBe(false)
  })
})

describe("toListing", () => {
  it("fills the fields ACB shows and fits the schema", () => {
    const listing = toListing(event("vultr-hackathon"))
    expect(listing).toEqual({
      id: "lablab:vultr-hackathon",
      source: "lablab",
      kind: "challenge",
      title: "Vultr: Agent Rush Hackathon",
      organizer: null,
      conference: null,
      url: "https://lablab.ai/ai-hackathons/vultr-hackathon",
      sourceUrl: "https://lablab.ai/ai-hackathons/vultr-hackathon",
      opensAt: "2026-11-03T15:00:00.000Z",
      deadlines: [
        {
          kind: "end",
          label: null,
          at: "2026-11-08T22:00:00.000Z",
          zone: "UTC",
        },
      ],
    })
    expect(listingSchema.safeParse(listing).success).toBe(true)
  })

  it("links to the event page by its slug", () => {
    expect(listingUrl("vultr-hackathon")).toBe(
      "https://lablab.ai/ai-hackathons/vultr-hackathon"
    )
  })

  it("gives the deadline in UTC when the event sets no timezone", () => {
    const live = toListing(event("amd-lablab-ai-academy-challenge"))
    expect(live.deadlines).toEqual([
      { kind: "end", label: null, at: "2026-12-01T19:00:00.000Z", zone: "UTC" },
    ])
  })

  it("does not read an end at 11:59 or 12:00 UTC as Anywhere on Earth", () => {
    // lablab gives exact instants, so deadlineZone's AoE rule does not apply.
    for (const endAt of [
      "2026-12-01T11:59:00.000Z",
      "2026-12-01T12:00:00.000Z",
    ])
      expect(
        toListing({ ...event("vultr-hackathon"), endAt }).deadlines[0].zone
      ).toBe("UTC")
  })

  it("gives the deadline in the event's timezone, with the instant unchanged", () => {
    const listing = toListing(event("amd-developer-hackathon-act-iii"))
    expect(listing.deadlines).toEqual([
      {
        kind: "end",
        label: null,
        at: "2026-10-18T10:30:00.000Z",
        zone: "Europe/Rome",
      },
    ])
    expect(listing.opensAt).toBe("2026-10-12T15:00:00.000Z")
    expect(listingSchema.safeParse(listing).success).toBe(true)
  })

  it("leaves the organizer empty, since the sponsor appears only in prose", () => {
    expect(
      toListing(event("assemblyai-voice-agent-hackathon")).organizer
    ).toBeNull()
  })

  it("cleans the title", () => {
    const listing = toListing({
      ...event("vultr-hackathon"),
      name: "  A\n  <b>title</b>\u0000 ",
    })
    expect(listing.title).toBe("A <b>title</b>")
  })

  it("fails on an event with no title", () => {
    expect(() => toListing({ ...event("vultr-hackathon"), name: " " })).toThrow(
      /vultr-hackathon/
    )
  })
})
