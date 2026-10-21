import { describe, expect, it } from "vitest"

import { mergeDuplicates } from "./duplicates.ts"
import type { Listing } from "./listing.ts"

// The pair both sources carried on 2026-10-21, as collected.
const openreview: Listing = {
  id: "openreview:NeurIPS.cc/2026/Workshop/PAIEC",
  source: "openreview",
  kind: "challenge",
  title: "Predictive AI Evaluation Competition at NeurIPS 2026",
  organizer: null,
  conference: { name: "NeurIPS", year: 2026 },
  url: "https://aimslab.stanford.edu/competition",
  sourceUrl:
    "https://openreview.net/group?id=NeurIPS.cc%2F2026%2FWorkshop%2FPAIEC",
  opensAt: null,
  deadlines: [
    {
      kind: "submission",
      label: null,
      at: "2026-10-31T11:59:00.000Z",
      zone: "AoE",
    },
  ],
}

const codabench: Listing = {
  id: "codabench:17828",
  source: "codabench",
  kind: "challenge",
  title: "NeurIPS Predictive AI Evaluation Competition",
  organizer: null,
  conference: null,
  url: "https://www.codabench.org/competitions/17828/",
  sourceUrl: "https://www.codabench.org/competitions/17828/",
  opensAt: "2026-09-01T00:00:00.000Z",
  deadlines: [
    {
      kind: "phase",
      label: "Development",
      at: "2026-10-31T11:59:00.000Z",
      zone: "AoE",
    },
  ],
}

function track(id: number, name: string): Listing {
  return {
    ...codabench,
    id: `codabench:${id}`,
    title: `NeurIPS 2026 — Agenthon — Track ${id - 17764}: ${name}`,
    conference: { name: "NeurIPS", year: 2026 },
    url: `https://www.codabench.org/competitions/${id}/`,
    sourceUrl: `https://www.codabench.org/competitions/${id}/`,
  }
}

describe("mergeDuplicates", () => {
  it("lists a challenge two sources carry once, as the challenge platform's listing", () => {
    const merged = mergeDuplicates([openreview, codabench])
    expect(merged).toHaveLength(1)
    expect(merged[0].id).toBe("codabench:17828")
    expect(merged[0].url).toBe("https://www.codabench.org/competitions/17828/")
    expect(merged[0].deadlines).toEqual(codabench.deadlines)
  })

  it("fills the facts the kept listing lacks from the other", () => {
    const [merged] = mergeDuplicates([codabench, openreview])
    expect(merged.conference).toEqual({ name: "NeurIPS", year: 2026 })
    expect(merged.opensAt).toBe("2026-09-01T00:00:00.000Z")
  })

  it("keeps the tracks of one challenge apart, though they share a deadline", () => {
    const tracks = [
      track(17765, "Coding"),
      track(17766, "Time-Series Forecasting"),
    ]
    expect(mergeDuplicates(tracks)).toEqual(tracks)
  })

  it("keeps the editions of a recurring challenge apart", () => {
    // Neither states a conference, so only the deadlines tell them apart.
    const next: Listing = {
      ...openreview,
      id: "openreview:NeurIPS.cc/2027/Workshop/PAIEC",
      title: "Predictive AI Evaluation Competition 2027",
      conference: null,
      deadlines: [
        { ...openreview.deadlines[0], at: "2027-10-31T11:59:00.000Z" },
      ],
    }
    expect(mergeDuplicates([codabench, next])).toHaveLength(2)
  })

  it("keeps two entries of one source apart, since the source counts them as two", () => {
    const copy: Listing = {
      ...codabench,
      id: "codabench:17829",
      url: "https://www.codabench.org/competitions/17829/",
    }
    expect(mergeDuplicates([codabench, copy])).toHaveLength(2)
  })

  it("keeps every deadline of both, each minute once, in order", () => {
    const report = {
      kind: "submission" as const,
      label: null,
      at: "2026-11-15T11:59:00.000Z",
      zone: "AoE" as const,
    }
    const withReport: Listing = {
      ...openreview,
      deadlines: [report, ...openreview.deadlines],
    }
    const [merged] = mergeDuplicates([withReport, codabench])
    expect(merged.deadlines).toEqual([...codabench.deadlines, report])
  })

  it("lists a challenge three sources carry once, though two share no deadline", () => {
    const at = (day: number) => ({
      kind: "phase" as const,
      label: null,
      at: `2026-11-${day}T11:59:00.000Z`,
      zone: "AoE" as const,
    })
    const evalai: Listing = {
      ...codabench,
      id: "evalai:2800",
      source: "evalai",
      deadlines: [at(20), at(28)],
    }
    // Codabench's is kept and shares no deadline with OpenReview's.
    const platform: Listing = { ...codabench, deadlines: [at(10), at(20)] }
    const venue: Listing = { ...openreview, deadlines: [at(28)] }
    expect(mergeDuplicates([venue, platform, evalai])).toHaveLength(1)
  })

  it("keeps listings apart whose conferences differ", () => {
    const other: Listing = {
      ...codabench,
      conference: { name: "ICML", year: 2026 },
    }
    expect(mergeDuplicates([openreview, other])).toHaveLength(2)
  })

  it("keeps a paper call apart from the challenge of the same name", () => {
    const call: Listing = { ...openreview, kind: "cfp" }
    expect(mergeDuplicates([call, codabench])).toHaveLength(2)
  })

  it("keeps listings apart whose titles name different conferences", () => {
    const cvpr: Listing = {
      ...codabench,
      title: "CVPR Robust Vision Challenge",
    }
    const neurips: Listing = {
      ...codabench,
      id: "evalai:2801",
      source: "evalai",
      title: "NeurIPS Robust Vision Challenge",
    }
    expect(mergeDuplicates([cvpr, neurips])).toHaveLength(2)
  })

  it("keeps apart titles that differ in a number that is not a year", () => {
    const small: Listing = { ...codabench, title: "Tiny Models 1024" }
    const large: Listing = {
      ...openreview,
      conference: null,
      title: "Tiny Models 4096",
    }
    expect(mergeDuplicates([small, large])).toHaveLength(2)
  })

  it("does not match titles that name only a conference and a year", () => {
    const a: Listing = { ...openreview, title: "NeurIPS 2026" }
    const b: Listing = { ...codabench, title: "NeurIPS 2026" }
    expect(mergeDuplicates([a, b])).toHaveLength(2)
  })
})
