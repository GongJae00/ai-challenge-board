import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { listingSchema } from "../../../lib/listing.ts"
import edgeCases from "./fixtures/list-open-upcoming-edge-cases.json"
import lastPage from "./fixtures/list-open-ml-last-page.json"
import page1 from "./fixtures/list-open-ml-page1.json"
import pastEnd from "./fixtures/list-open-ml-past-end.json"
import upcomingPage1 from "./fixtures/list-upcoming-ml-page1.json"
import {
  calendarUrl,
  opensAtFrom,
  parseCalendar,
  parseListPage,
  toListing,
  type ListedHackathon,
} from "./parse.ts"

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")
}
const amazonIcs = fixture("calendar-open-amazon.ics")
const kiroweenIcs = fixture("calendar-upcoming-kiroween.ics")
const sinceAiIcs = fixture("calendar-onsite-since-ai.ics")

const now = new Date("2026-10-21T14:00:00Z")

const hackathon = (overrides: Partial<ListedHackathon> = {}) => ({
  id: 30992,
  title: "Build, Ship, Shape: Amazon Developer Hackathon",
  url: "https://amazonappdev2026.devpost.com/",
  organizer: "Amazon",
  dates: "Aug 31 - Oct 23, 2026",
  inviteOnly: false,
  ai: true,
  ...overrides,
})

describe("parseListPage", () => {
  it("reads the total and each hackathon's id, title, link, organizer, dates, and invite-only flag", () => {
    const page = parseListPage(page1)
    expect(page.total).toBe(31)
    expect(page.hackathons).toHaveLength(3)
    expect(page.hackathons[0]).toEqual(hackathon())
    expect(page.hackathons[2].dates).toBe("Oct 05 - 27, 2026")
  })

  it("reads an invite-only hackathon's flag", () => {
    const page = parseListPage(lastPage)
    expect(page.hackathons.map((h) => [h.id, h.inviteOnly])).toEqual([
      [31737, false],
      [31626, true],
      [31735, false],
      [31821, false],
    ])
  })

  it("marks a hackathon without the AI theme, which the collector leaves out", () => {
    const raw = structuredClone(page1)
    raw.hackathons[0].themes = [{ id: 22, name: "Open Ended" }]
    expect(parseListPage(raw).hackathons[0].ai).toBe(false)
  })

  it("reads an empty page past the end", () => {
    expect(parseListPage(pastEnd)).toEqual({ total: 31, hackathons: [] })
  })

  it("keeps a placeholder organizer name as null, and a real name as written", () => {
    for (const name of ["nill", "NULL", "n/a", "N/A", "-", "none", "TBD"]) {
      const raw = structuredClone(page1)
      raw.hackathons[0].organization_name = name
      expect(parseListPage(raw).hackathons[0].organizer, name).toBeNull()
    }
    for (const name of ["NA", "Acme Inc."]) {
      const raw = structuredClone(page1)
      raw.hackathons[0].organization_name = name
      expect(parseListPage(raw).hackathons[0].organizer).toBe(name)
    }
  })

  it("keeps an empty organizer name as null", () => {
    const raw = structuredClone(page1)
    raw.hackathons[0].organization_name = "  "
    expect(parseListPage(raw).hackathons[0].organizer).toBeNull()
  })

  it("rejects a response without hackathons", () => {
    expect(() => parseListPage({ meta: { total_count: 1 } })).toThrow(
      /Devpost list response does not fit/
    )
  })

  it("rejects a response without a total", () => {
    expect(() => parseListPage({ hackathons: [] })).toThrow(/Devpost list/)
  })

  it("rejects a hackathon whose link is not a devpost.com subdomain over https, so that no other host is requested", () => {
    for (const url of [
      "https://evil.example.com/",
      "http://amazonappdev2026.devpost.com/",
      "https://devpost.com.evil.example/",
      "https://a.b.devpost.com/",
      "javascript:alert(1)",
    ]) {
      const raw = structuredClone(page1)
      raw.hackathons[0].url = url
      expect(() => parseListPage(raw), url).toThrow(/Devpost list/)
    }
  })

  it("rejects a hackathon without a title", () => {
    const raw = structuredClone(page1)
    raw.hackathons[0].title = " "
    expect(() => parseListPage(raw)).toThrow(/Devpost list/)
  })
})

describe("calendarUrl", () => {
  it("is the calendar file on the hackathon's own host", () => {
    expect(calendarUrl(hackathon())).toBe(
      "https://amazonappdev2026.devpost.com/calendar"
    )
  })
})

describe("parseCalendar", () => {
  it("reads an online hackathon's submission deadline in the zone of its TZID", () => {
    // 12:00 PDT is 19:00 UTC, the instant the hackathon's dates page gives as 2026-10-23T15:00:00-04:00.
    expect(parseCalendar(amazonIcs)).toEqual({
      kind: "submission",
      label: null,
      at: "2026-10-23T19:00:00.000Z",
      zone: "America/Los_Angeles",
    })
  })

  it("reads the submission deadline of an upcoming hackathon after the clocks change to standard time", () => {
    // 14:00 PST on 2026-12-04 is 22:00 UTC; the dates page gives 2026-12-04T17:00:00-05:00.
    expect(parseCalendar(kiroweenIcs)).toMatchObject({
      kind: "submission",
      at: "2026-12-04T22:00:00.000Z",
      zone: "America/Los_Angeles",
    })
  })

  it("takes the end of an on-site event, not its start, as the end", () => {
    // The event runs 2026-11-06 17:00 to 2026-11-08 10:00 in Turku, which is on EET (UTC+2) after 25 October;
    // the dates page gives the end as 2026-11-08T03:00:00-05:00.
    expect(parseCalendar(sinceAiIcs)).toEqual({
      kind: "end",
      label: null,
      at: "2026-11-08T08:00:00.000Z",
      zone: "Europe/Helsinki",
    })
  })

  it("reads a summary the calendar folds onto two lines", () => {
    // The Amazon file breaks "submission deadline" after "deadlin"; read unfolded, it is an online deadline,
    // and read as it stands, the summary would look like an on-site event's.
    expect(amazonIcs).toMatch(/deadlin\r?\n e/)
    expect(parseCalendar(amazonIcs)?.kind).toBe("submission")
  })

  it("ignores the time zone rules and the reminder around the event", () => {
    // VTIMEZONE has DTSTART lines without a TZID, and VALARM has a SUMMARY that does not end in "deadline".
    const ics = kiroweenIcs.replace(
      "SUMMARY:Kiroween 2026 submission deadline",
      "SUMMARY:Kiroween 2026"
    )
    expect(parseCalendar(ics)?.kind).toBe("end")
  })

  it("accepts LF line breaks", () => {
    expect(parseCalendar(amazonIcs.replaceAll("\r\n", "\n"))).toEqual(
      parseCalendar(amazonIcs)
    )
  })

  it("reads a time written in UTC with a Z as zone UTC", () => {
    const ics = amazonIcs.replace(
      "DTSTART;TZID=America/Los_Angeles:20261023T120000",
      "DTSTART:20261023T070000Z"
    )
    expect(parseCalendar(ics)).toEqual({
      kind: "submission",
      label: null,
      at: "2026-10-23T07:00:00.000Z",
      zone: "UTC",
    })
  })

  it("reads a quoted TZID", () => {
    const ics = amazonIcs.replace(
      "DTSTART;TZID=America/Los_Angeles:",
      'DTSTART;TZID="America/Los_Angeles":'
    )
    expect(parseCalendar(ics)).toEqual(parseCalendar(amazonIcs))
  })

  it("is null when the TZID is not an IANA zone", () => {
    expect(
      parseCalendar(amazonIcs.replaceAll("America/Los_Angeles", "Not/AZone"))
    ).toBeNull()
  })

  it("is null when the time does not read", () => {
    expect(
      parseCalendar(amazonIcs.replace("20261023T120000", "20261323T120000"))
    ).toBeNull()
  })

  it("is null when there is no event", () => {
    expect(parseCalendar("BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n")).toBeNull()
    expect(parseCalendar("<html>Not found</html>")).toBeNull()
  })

  it("is null for an all-day time", () => {
    const ics = amazonIcs.replace(
      "DTSTART;TZID=America/Los_Angeles:20261023T120000",
      "DTSTART;VALUE=DATE:20261023"
    )
    expect(parseCalendar(ics)).toBeNull()
  })

  it("is null for a floating time with neither a TZID nor a Z", () => {
    const ics = amazonIcs.replace(
      "DTSTART;TZID=America/Los_Angeles:20261023T120000",
      "DTSTART:20261023T120000"
    )
    expect(parseCalendar(ics)).toBeNull()
  })

  it("is null when an on-site event has no end", () => {
    expect(
      parseCalendar(sinceAiIcs.replace(/DTEND;[^\r\n]*\r?\n/, ""))
    ).toBeNull()
  })
})

describe("opensAtFrom", () => {
  const la = "America/Los_Angeles"

  it("reads the start of a range over two months", () => {
    expect(opensAtFrom("Aug 31 - Oct 23, 2026", la)).toBe(
      "2026-08-31T07:00:00.000Z"
    )
  })

  it("reads the start of a range inside one month", () => {
    expect(opensAtFrom("Oct 05 - 27, 2026", la)).toBe(
      "2026-10-05T07:00:00.000Z"
    )
  })

  it("reads a single day, at midnight in the zone, on the day before the clocks change", () => {
    // 2026-11-01 00:00 is still PDT (UTC-7); the clocks change at 02:00 that night.
    expect(opensAtFrom("Nov 01, 2026", la)).toBe("2026-11-01T07:00:00.000Z")
  })

  it("reads the start of a range across years from the year at its front", () => {
    expect(opensAtFrom("Jul 16, 2026 - Jan 15, 2027", la)).toBe(
      "2026-07-16T07:00:00.000Z"
    )
    expect(opensAtFrom("Aug 23, 2026 - Jan 02, 2027", "Europe/Helsinki")).toBe(
      "2026-08-22T21:00:00.000Z"
    )
  })

  it("is null when the string does not parse", () => {
    for (const dates of [
      "",
      "Upcoming",
      "Foo 05 - 27, 2026",
      "Feb 30 - Mar 02, 2026",
      "Oct 05 - 27",
      "October 05 - 27, 2026",
    ])
      expect(opensAtFrom(dates, la), dates).toBeNull()
  })

  it("is null when the start falls after the end, rather than inferring another year", () => {
    expect(opensAtFrom("Oct 30 - 05, 2026", la)).toBeNull()
    expect(opensAtFrom("Dec 20 - Jan 10, 2027", la)).toBeNull()
  })

  it("is null in a zone that does not exist, and never throws", () => {
    expect(opensAtFrom("Oct 05 - 27, 2026", "Not/AZone")).toBeNull()
  })
})

describe("toListing", () => {
  const deadline = parseCalendar(amazonIcs)!

  it("lists a hackathon as a challenge with its page as both links and its deadline in the event's zone", () => {
    const listing = toListing(hackathon(), deadline, now)
    expect(listing).toEqual({
      id: "devpost:30992",
      source: "devpost",
      kind: "challenge",
      title: "Build, Ship, Shape: Amazon Developer Hackathon",
      organizer: "Amazon",
      conference: null,
      url: "https://amazonappdev2026.devpost.com/",
      sourceUrl: "https://amazonappdev2026.devpost.com/",
      opensAt: "2026-08-31T07:00:00.000Z",
      deadlines: [
        {
          kind: "submission",
          label: null,
          at: "2026-10-23T19:00:00.000Z",
          zone: "America/Los_Angeles",
        },
      ],
    })
    expect(listingSchema.safeParse(listing).success).toBe(true)
  })

  it("lists an on-site event with its end", () => {
    const listing = toListing(
      hackathon({ id: 1, dates: "Nov 06 - 08, 2026" }),
      parseCalendar(sinceAiIcs)!,
      now
    )
    expect(listing?.deadlines).toEqual([
      {
        kind: "end",
        label: null,
        at: "2026-11-08T08:00:00.000Z",
        zone: "Europe/Helsinki",
      },
    ])
    expect(listing?.opensAt).toBe("2026-11-05T22:00:00.000Z")
    expect(listingSchema.safeParse(listing).success).toBe(true)
  })

  it("leaves the opening empty when the dates do not parse", () => {
    expect(
      toListing(hackathon({ dates: "Soon" }), deadline, now)?.opensAt
    ).toBe(null)
  })

  it("leaves the organizer empty when the list has none", () => {
    expect(
      toListing(hackathon({ organizer: null }), deadline, now)?.organizer
    ).toBeNull()
  })

  it("cleans the title of control characters and extra spaces", () => {
    expect(
      toListing(
        hackathon({ title: "Hack\u0000 the\n  Planet " }),
        deadline,
        now
      )?.title
    ).toBe("Hack the Planet")
  })

  it("lists nothing once the deadline has passed", () => {
    expect(
      toListing(hackathon(), deadline, new Date("2026-10-23T19:00:00Z"))
    ).toBeNull()
  })

  it("lists nothing for a deadline so far ahead that it is a placeholder", () => {
    const far = { ...deadline, at: "2031-01-01T00:00:00.000Z" }
    expect(toListing(hackathon(), far, now)).toBeNull()
  })

  it("lists a hackathon whose dates are in 2028", () => {
    const [brewing] = parseListPage(upcomingPage1).hackathons.filter(
      (h) => h.id === 29135
    )
    expect(brewing.dates).toBe("Mar 12 - 27, 2028")
    const far = { ...deadline, at: "2028-03-28T06:59:00.000Z" }
    // Midnight on 12 March 2028 is the last hour of standard time in Los Angeles: the clocks change at 02:00.
    expect(toListing(brewing, far, now)?.opensAt).toBe(
      "2028-03-12T08:00:00.000Z"
    )
  })
})

describe("edge-case list items", () => {
  it("reads the cross-year range and the invite-only items", () => {
    const page = parseListPage(edgeCases)
    expect(page.total).toBe(175)
    expect(page.hackathons.map((h) => [h.id, h.inviteOnly, h.dates])).toEqual([
      [31108, false, "Aug 23, 2026 - Jan 02, 2027"],
      [31551, true, "Oct 30, 2026"],
      [31152, true, "Oct 16 - 23, 2026"],
    ])
  })
})
