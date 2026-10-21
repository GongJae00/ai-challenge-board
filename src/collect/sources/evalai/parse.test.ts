import { describe, expect, it } from "vitest"

import { listingSchema } from "../../../lib/listing.ts"
import challengesFuture from "./fixtures/challenges-future.json"
import challengesPast from "./fixtures/challenges-past-page1.json"
import challengesPresent from "./fixtures/challenges-present.json"
import phases2672 from "./fixtures/phases-2672.json"
import phases2680 from "./fixtures/phases-2680.json"
import phases2703 from "./fixtures/phases-2703.json"
import {
  conferenceFromTags,
  isOpenTimeBound,
  parseChallengePage,
  parsePhasePage,
  toListing,
} from "./parse.ts"

const now = new Date("2026-10-21T06:00:00Z")

const present = parseChallengePage(challengesPresent).challenges
const byId = (id: number) => present.find((c) => c.id === id)!

describe("parseChallengePage", () => {
  it("reads each challenge's id, title, organizer, dates, tags, and flags", () => {
    expect(present.map((c) => c.id)).toEqual([2703, 2680, 2672, 2619, 518])
    expect(byId(2703)).toEqual({
      id: 2703,
      title:
        "CLIP2 - The 2nd Cadenza Lyrics Intelligibility Prediction Challenge",
      teamName: "Cadenza Project Team",
      startDate: "2026-06-08T00:00:00Z",
      endDate: "2027-01-08T23:59:59Z",
      tags: [
        "lyric-intelligibility",
        "signal-processing",
        "machine-learning",
        "music",
      ],
      published: true,
      approved: true,
    })
  })

  it("has no next page when the source gives none", () => {
    expect(parseChallengePage(challengesPresent).next).toBeNull()
  })

  it("reads an empty future list", () => {
    expect(parseChallengePage(challengesFuture)).toEqual({
      challenges: [],
      next: null,
    })
  })

  it("returns the next page's link when it is on eval.ai", () => {
    expect(parseChallengePage(challengesPast).next).toBe(
      "https://eval.ai/api/challenges/challenge/past/approved/public?limit=1&page=2"
    )
  })

  it.each([
    "https://evil.example.org/api/challenges/challenge/past/approved/public?page=2",
    "https://eval.ai.evil.example.org/api/challenges?page=2",
    "http://eval.ai/api/challenges/challenge/past/approved/public?page=2",
    "javascript:alert(1)",
    "not a url",
  ])("rejects a next link that is not https on eval.ai: %s", (next) => {
    expect(() => parseChallengePage({ ...challengesPast, next })).toThrow(
      new RegExp(`next.*${next.replace(/[?.()]/g, "\\$&")}`)
    )
  })

  it("rejects a response that is not the paged envelope", () => {
    expect(() => parseChallengePage({ detail: "Not found." })).toThrow(
      /EvalAI challenges response does not fit/
    )
    expect(() => parseChallengePage([])).toThrow(/does not fit/)
  })

  it("rejects a challenge without an end date or with one that is not a date", () => {
    const [first] = challengesPresent.results
    const broken = (patch: object) => ({
      ...challengesPresent,
      results: [{ ...first, ...patch }],
    })
    expect(() => parseChallengePage(broken({ end_date: null }))).toThrow(
      /end_date/
    )
    expect(() => parseChallengePage(broken({ end_date: "soon" }))).toThrow(
      /end_date/
    )
    expect(() => parseChallengePage(broken({ id: "2703" }))).toThrow(/id/)
  })
})

describe("parsePhasePage", () => {
  it("reads each phase's name, end, and whether it is public", () => {
    expect(parsePhasePage(phases2680).phases).toEqual([
      {
        name: "Quiz Phase",
        endDate: "2026-11-02T04:59:59Z",
        isPublic: true,
      },
      {
        name: "Test Phase (Private)",
        endDate: "2026-11-07T04:59:59Z",
        isPublic: true,
      },
    ])
  })

  it("rejects a response without phases and a next link on another host", () => {
    expect(() => parsePhasePage({ count: 0 })).toThrow(
      /EvalAI phases response does not fit/
    )
    expect(() =>
      parsePhasePage({
        ...phases2680,
        next: "https://evil.example.org/p?page=2",
      })
    ).toThrow(/next/)
  })
})

describe("isOpenTimeBound", () => {
  it("keeps the challenges with a real end date ahead", () => {
    expect(
      present.filter((c) => isOpenTimeBound(c, now)).map((c) => c.id)
    ).toEqual([2703, 2680])
  })

  it("excludes persistent benchmarks, whose end date is a placeholder in 2042, 2099, or 2100", () => {
    for (const id of [518, 2672, 2619])
      expect(isOpenTimeBound(byId(id), now)).toBe(false)
  })

  it("keeps an end date just under two years ahead and drops one just over it", () => {
    const challenge = byId(2703)
    expect(
      isOpenTimeBound({ ...challenge, endDate: "2028-10-20T00:00:00Z" }, now)
    ).toBe(true)
    expect(
      isOpenTimeBound({ ...challenge, endDate: "2028-10-23T00:00:00Z" }, now)
    ).toBe(false)
  })

  it("excludes a challenge whose end date has passed", () => {
    const past = parseChallengePage(challengesPast).challenges
    expect(past.map((c) => c.id)).toEqual([2717, 2713, 2707])
    expect(past.some((c) => isOpenTimeBound(c, now))).toBe(false)
    expect(
      isOpenTimeBound({ ...byId(2703), endDate: "2026-10-21T06:00:00Z" }, now)
    ).toBe(false)
  })

  it("excludes a challenge that is not published or not approved", () => {
    expect(isOpenTimeBound({ ...byId(2703), published: false }, now)).toBe(
      false
    )
    expect(isOpenTimeBound({ ...byId(2703), approved: false }, now)).toBe(false)
  })
})

describe("conferenceFromTags", () => {
  it("maps a tag of a phase-1 conference and a year to the conference's canonical name", () => {
    expect(conferenceFromTags(["vqa", "iccv-2025"])).toEqual({
      name: "ICCV",
      year: 2025,
    })
    expect(conferenceFromTags(["cvpr2026"])).toEqual({
      name: "CVPR",
      year: 2026,
    })
    expect(conferenceFromTags(["NeurIPS_2026"])).toEqual({
      name: "NeurIPS",
      year: 2026,
    })
    expect(conferenceFromTags(["ICLR-2027"])).toEqual({
      name: "ICLR",
      year: 2027,
    })
  })

  it("takes the first tag that matches", () => {
    expect(conferenceFromTags(["eccv-2026", "icml-2026"])).toEqual({
      name: "ECCV",
      year: 2026,
    })
  })

  it.each([
    ["a conference without a year", ["cvpr"]],
    ["a year without a conference", ["2026"]],
    ["a two-digit year", ["cvpr-26"]],
    ["a conference outside phase 1", ["emnlp-2026"]],
    ["a tag that only contains a conference", ["cvpr-2026-workshop"]],
    ["a tag that is a longer word", ["xcvpr-2026"]],
    ["no tags", []],
  ])("gives null for %s", (_, tags) => {
    expect(conferenceFromTags(tags)).toBeNull()
  })

  it("does not read the conference from the title", () => {
    const listing = toListing(
      { ...byId(2672), endDate: "2026-12-01T00:00:00Z" },
      parsePhasePage(phases2672).phases,
      now
    )
    expect(listing.title).toMatch(/CVPR 2026/)
    expect(listing.conference).toBeNull()
  })
})

describe("toListing", () => {
  it("turns a challenge into a listing with its phase and end deadlines", () => {
    const listing = toListing(
      byId(2703),
      parsePhasePage(phases2703).phases,
      now
    )
    expect(listing).toEqual({
      id: "evalai:2703",
      source: "evalai",
      kind: "challenge",
      title:
        "CLIP2 - The 2nd Cadenza Lyrics Intelligibility Prediction Challenge",
      organizer: "Cadenza Project Team",
      conference: null,
      url: "https://eval.ai/web/challenges/challenge-page/2703",
      sourceUrl: "https://eval.ai/web/challenges/challenge-page/2703",
      opensAt: "2026-06-08T00:00:00.000Z",
      deadlines: [
        {
          kind: "phase",
          label: "Validation Phase",
          at: "2027-01-07T23:59:59.000Z",
          zone: "UTC",
        },
        {
          kind: "end",
          label: null,
          at: "2027-01-08T23:59:59.000Z",
          zone: "UTC",
        },
      ],
    })
    expect(listingSchema.safeParse(listing).success).toBe(true)
  })

  it("leaves out the end deadline when a phase ends at the same instant", () => {
    const listing = toListing(
      byId(2680),
      parsePhasePage(phases2680).phases,
      now
    )
    expect(listing.deadlines).toEqual([
      {
        kind: "phase",
        label: "Quiz Phase",
        at: "2026-11-02T04:59:59.000Z",
        zone: "UTC",
      },
      {
        kind: "phase",
        label: "Test Phase (Private)",
        at: "2026-11-07T04:59:59.000Z",
        zone: "UTC",
      },
    ])
    expect(listingSchema.safeParse(listing).success).toBe(true)
  })

  it("lists only the public phases that have not ended, and sorts the deadlines by time", () => {
    const phases = [
      { name: "Final", endDate: "2026-12-01T00:00:00Z", isPublic: true },
      { name: "Hidden", endDate: "2026-11-15T00:00:00Z", isPublic: false },
      { name: "Over", endDate: "2026-10-01T00:00:00Z", isPublic: true },
      { name: " Warm\n up ", endDate: "2026-11-01T00:00:00Z", isPublic: true },
    ]
    const listing = toListing(byId(2703), phases, now)
    expect(listing.deadlines.map((d) => [d.kind, d.label])).toEqual([
      ["phase", "Warm up"],
      ["phase", "Final"],
      ["end", null],
    ])
  })

  it("gives only the end deadline when no phase qualifies", () => {
    const listing = toListing(byId(2703), [], now)
    expect(listing.deadlines).toEqual([
      { kind: "end", label: null, at: "2027-01-08T23:59:59.000Z", zone: "UTC" },
    ])
  })

  it("sets the conference from a tag and leaves the organizer empty when the team name is blank", () => {
    const listing = toListing(
      {
        ...byId(2619),
        endDate: "2026-12-01T00:00:00Z",
        teamName: "  ",
      },
      [],
      now
    )
    expect(listing.conference).toEqual({ name: "ICCV", year: 2025 })
    expect(listing.organizer).toBeNull()
  })

  it("shortens a title longer than the schema allows", () => {
    const listing = toListing(
      { ...byId(2703), title: "x".repeat(400) },
      [],
      now
    )
    expect(listing.title).toHaveLength(300)
    expect(listingSchema.safeParse(listing).success).toBe(true)
  })
})
