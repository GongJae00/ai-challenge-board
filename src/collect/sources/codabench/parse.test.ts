import { describe, expect, it } from "vitest"

import { listingSchema } from "../../../lib/listing.ts"
import benchmarkNoEnd from "./fixtures/detail-17718-benchmark-no-end.json"
import finished from "./fixtures/detail-12971-finished-single-phase.json"
import multiPhase from "./fixtures/detail-18062-multi-phase-upcoming.json"
import upcoming from "./fixtures/detail-18221-upcoming-single-phase.json"
import openEnded from "./fixtures/detail-18274-open-ended-no-end.json"
import lastPhaseNoEnd from "./fixtures/detail-5263-final-phase-flag-false-open-end.json"
import listExcerpt from "./fixtures/list-public-excerpt.json"
import {
  candidates,
  conferenceFromTitle,
  isSettled,
  parseDetail,
  parseListPage,
  toListing,
} from "./parse.ts"

const now = new Date("2026-10-21T06:00:00Z")

describe("parseListPage", () => {
  it("reads the total and each competition's id, type, and first phase start", () => {
    const page = parseListPage(listExcerpt)
    expect(page.count).toBe(1536)
    expect(page.competitions[0]).toEqual({
      id: 18411,
      title: "Shared Task 1: BanglaKnight",
      published: true,
      type: "competition",
      firstPhaseStart: "2026-10-17T00:00:00Z",
    })
  })

  it("rejects a response without results", () => {
    expect(() => parseListPage({ count: 1 })).toThrow(/Codabench list/)
  })
})

describe("candidates", () => {
  const listed = (
    id: number,
    title: string,
    firstPhaseStart: string | null = "2026-10-01T00:00:00Z"
  ) => ({ id, title, published: true, type: "competition", firstPhaseStart })

  it("keeps competitions whose title names a phase-1 conference, newest first", () => {
    const competitions = [
      listed(1, "NTIRE 2026 Challenge (@ CVPR 2026)"),
      listed(3, "Agenthon at NeurIPS"),
      listed(2, "Homework 3: Iris"),
    ]
    expect(candidates(competitions, now, new Set(), new Set())).toEqual([3, 1])
  })

  it("leaves out settled competitions, benchmarks, and unpublished ones", () => {
    const competitions = [
      listed(1, "CVPR 2026 A"),
      { ...listed(2, "CVPR 2026 B"), type: "benchmark" },
      { ...listed(3, "CVPR 2026 C"), published: false },
    ]
    expect(candidates(competitions, now, new Set([1]), new Set())).toEqual([])
  })

  it("leaves out competitions that started more than a year ago, unless they were open", () => {
    const old = listed(1, "ICCV 2025 long challenge", "2025-09-01T00:00:00Z")
    expect(candidates([old], now, new Set(), new Set())).toEqual([])
    expect(candidates([old], now, new Set(), new Set([1]))).toEqual([1])
  })
})

describe("toListing", () => {
  it("lists each phase still ahead as a deadline, in UTC", () => {
    const listing = toListing(parseDetail(multiPhase), now)
    expect(listing).toMatchObject({
      id: "codabench:18062",
      source: "codabench",
      kind: "challenge",
      organizer: null,
      conference: null,
      url: "https://www.codabench.org/competitions/18062/",
      opensAt: "2026-09-16T00:00:00.000Z",
    })
    // The post-evaluation phase, a practice period after the challenge, is no deadline.
    expect(listing?.deadlines).toEqual([
      {
        kind: "phase",
        label: "Progress",
        at: "2026-11-10T00:00:00.000Z",
        zone: "UTC",
      },
      {
        kind: "phase",
        label: "Evaluation FLAG",
        at: "2026-11-17T23:00:00.000Z",
        zone: "UTC",
      },
      {
        kind: "phase",
        label: "Evaluation FLAG 2",
        at: "2026-11-26T00:00:00.000Z",
        zone: "UTC",
      },
    ])
    expect(listingSchema.safeParse(listing).success).toBe(true)
  })

  it("lists a competition that has not started", () => {
    expect(toListing(parseDetail(upcoming), now)?.deadlines).toHaveLength(1)
  })

  it("lists nothing for a finished competition or one whose phases never end", () => {
    expect(toListing(parseDetail(finished), now)).toBeNull()
    expect(toListing(parseDetail(openEnded), now)).toBeNull()
    expect(toListing(parseDetail(benchmarkNoEnd), now)).toBeNull()
    expect(toListing(parseDetail(lastPhaseNoEnd), now)).toBeNull()
  })

  it("lists nothing for a competition whose only deadline is a placeholder years away", () => {
    const detail = parseDetail(upcoming)
    const placeholder = {
      ...detail,
      phases: [{ ...detail.phases[0], end: "2099-01-01T00:00:00Z" }],
    }
    expect(toListing(placeholder, now)).toBeNull()
  })
})

describe("isSettled", () => {
  const settled = (detail: unknown) => {
    const competition = parseDetail(detail)
    return isSettled(competition, toListing(competition, now), now)
  }

  it("settles a competition that ended over a month ago, one without an end, and a benchmark", () => {
    expect(settled(finished)).toBe(true)
    expect(settled(openEnded)).toBe(true)
    expect(settled(benchmarkNoEnd)).toBe(true)
  })

  it("does not settle a competition with a deadline ahead", () => {
    expect(settled(multiPhase)).toBe(false)
    expect(settled(upcoming)).toBe(false)
  })

  it("keeps checking a competition that ended within the month, in case it is extended", () => {
    const recent = {
      ...finished,
      phases: [{ ...finished.phases[0], end: "2026-10-11T00:00:00Z" }],
    }
    expect(settled(recent)).toBe(false)
  })
})

describe("conferenceFromTitle", () => {
  it("reads a conference named with its year", () => {
    expect(
      conferenceFromTitle(
        "NTIRE 2026 Single Image Reflection Removal in the Wild (@ CVPR 2026)"
      )
    ).toEqual({ name: "CVPR", year: 2026 })
    expect(conferenceFromTitle("neurips2026 Weather4cast")).toEqual({
      name: "NeurIPS",
      year: 2026,
    })
  })

  it("ignores a conference named without a year", () => {
    expect(conferenceFromTitle("A CVPR-style detection challenge")).toBeNull()
  })
})
