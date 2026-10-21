import { describe, expect, it } from "vitest"

import { listingSchema } from "../../../lib/listing.ts"
import groupsNeurips from "./fixtures/groups_neurips2026_workshop.json"
import invitationsNeurips from "./fixtures/invitations_neurips2026_workshop.json"
import {
  CHALLENGE_TITLE,
  parseGroups,
  parseInvitations,
  toListings,
} from "./parse.ts"

const groups = parseGroups(groupsNeurips)
const invitations = parseInvitations(invitationsNeurips)
const venue = { conference: "NeurIPS", year: 2026 } as const

describe("parseGroups", () => {
  it("reads each workshop group's id, title, short name, site, and submission id", () => {
    expect(groups).toHaveLength(3)
    expect(groups[0]).toEqual({
      id: "NeurIPS.cc/2026/Workshop/MLForSys",
      title: "Machine Learning for Systems 2026",
      shortName: "MLForSys2026",
      website: "https://mlforsystems.org",
      submissionId: "NeurIPS.cc/2026/Workshop/MLForSys/-/Submission",
    })
  })

  it("rejects a response that holds only part of the groups", () => {
    expect(() =>
      parseGroups({ ...groupsNeurips, count: groupsNeurips.groups.length + 1 })
    ).toThrow(/does not page/)
  })

  it("rejects a response without a groups list", () => {
    expect(() => parseGroups({ count: 0 })).toThrow(/groups/)
  })
})

describe("parseInvitations", () => {
  it("reads each invitation's open time, deadline, and close time", () => {
    expect(invitations).toContainEqual({
      id: "NeurIPS.cc/2026/Workshop/MLForSys/-/Submission",
      cdate: 1784091600000,
      duedate: 1788263940000,
      expdate: 1788265740000,
    })
  })
})

describe("toListings", () => {
  it("lists only the calls that have not closed", () => {
    const now = new Date("2026-10-21T05:40:00Z")
    const listings = toListings({ groups, invitations, ...venue, now })
    expect(listings.map((l) => l.id)).toEqual([
      "openreview:NeurIPS.cc/2026/Workshop/A2NetOps",
    ])
  })

  it("turns a call named a challenge into a challenge listing with its deadline in UTC", () => {
    const now = new Date("2026-10-21T05:40:00Z")
    const [listing] = toListings({ groups, invitations, ...venue, now })
    expect(listing).toEqual({
      id: "openreview:NeurIPS.cc/2026/Workshop/A2NetOps",
      source: "openreview",
      kind: "challenge",
      title: "SAPC2: The Second Speech Accessibility Project Challenge",
      organizer: null,
      conference: { name: "NeurIPS", year: 2026 },
      url: "https://xiuwenz2.github.io/SAPC2-website/",
      sourceUrl:
        "https://openreview.net/group?id=NeurIPS.cc%2F2026%2FWorkshop%2FA2NetOps",
      opensAt: "2026-09-25T05:00:00.000Z",
      deadlines: [
        {
          kind: "submission",
          label: null,
          at: "2026-11-08T10:59:00.000Z",
          zone: "UTC",
        },
      ],
    })
    expect(listingSchema.safeParse(listing).success).toBe(true)
  })

  it("turns a workshop call due at 11:59 UTC into a paper call due at 23:59 AoE", () => {
    const now = new Date("2026-08-20T00:00:00Z")
    const listing = toListings({ groups, invitations, ...venue, now }).find(
      (l) => l.id.endsWith("/MLForSys")
    )
    expect(listing?.kind).toBe("cfp")
    expect(listing?.deadlines).toEqual([
      {
        kind: "submission",
        label: null,
        at: "2026-09-01T11:59:00.000Z",
        zone: "AoE",
      },
    ])
  })

  it("lists a call that has not opened yet", () => {
    const now = new Date("2026-08-20T00:00:00Z")
    const listings = toListings({ groups, invitations, ...venue, now })
    expect(listings.map((l) => l.id)).toHaveLength(3)
  })

  it("adds https to a site given as a bare host", () => {
    const now = new Date("2026-08-20T00:00:00Z")
    const listing = toListings({ groups, invitations, ...venue, now }).find(
      (l) => l.id.endsWith("/Simbiochem")
    )
    expect(listing?.url).toBe("https://www.simbiochem.com/")
  })

  it("links the OpenReview venue when the site is not a link", () => {
    const now = new Date("2026-08-20T00:00:00Z")
    const withoutSite = groups.map((g) => ({ ...g, website: "TBA" }))
    const [listing] = toListings({
      groups: withoutSite,
      invitations,
      ...venue,
      now,
    })
    expect(listing.url).toBe(listing.sourceUrl)
  })

  it("skips a group without a submission invitation or an invitation without a deadline", () => {
    const now = new Date("2026-08-20T00:00:00Z")
    const listings = toListings({
      groups: [{ ...groups[0], submissionId: null }, groups[1], groups[2]],
      invitations: invitations.map((i) =>
        i.id.includes("Simbiochem") ? { ...i, duedate: null } : i
      ),
      ...venue,
      now,
    })
    expect(listings.map((l) => l.id)).toEqual([
      "openreview:NeurIPS.cc/2026/Workshop/A2NetOps",
    ])
  })

  it("falls back to the short name when a group has no title", () => {
    const now = new Date("2026-08-20T00:00:00Z")
    const [listing] = toListings({
      groups: [{ ...groups[0], title: null }],
      invitations,
      ...venue,
      now,
    })
    expect(listing.title).toBe("MLForSys2026")
  })
})

describe("CHALLENGE_TITLE", () => {
  it("names a challenge or a competition, not a workshop on open challenges", () => {
    expect(CHALLENGE_TITLE.test("AIMO Interpretability Challenge")).toBe(true)
    expect(
      CHALLENGE_TITLE.test(
        "Predictive AI Evaluation Competition at NeurIPS 2026"
      )
    ).toBe(true)
    expect(
      CHALLENGE_TITLE.test(
        "Workshop on Open Challenges in Representation Learning"
      )
    ).toBe(false)
    expect(
      CHALLENGE_TITLE.test("Challenges and Opportunities of LLM Agents")
    ).toBe(false)
  })
})
