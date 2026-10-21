import { describe, expect, it } from "vitest"

import type { Listing } from "./listing.ts"
import { platformName } from "./sites.ts"

const dacon: Listing = {
  id: "dacon:236771",
  source: "dacon",
  kind: "challenge",
  title: "항만 문제해결을 위한 AI 기술 공모전",
  organizer: "해양수산부",
  conference: null,
  url: "https://dacon.io/competitions/official/236771/overview/description",
  sourceUrl:
    "https://dacon.io/competitions/official/236771/overview/description",
  opensAt: null,
  deadlines: [
    { kind: "end", label: null, at: "2026-11-02T01:00:00.000Z", zone: "KST" },
  ],
}

describe("platformName", () => {
  it("names the platform a competition runs on", () => {
    expect(platformName(dacon)).toBe("DACON")
    expect(
      platformName({ ...dacon, id: "aifactory:9306", source: "aifactory" })
    ).toBe("AIFactory")
  })

  it("names none for a call that OpenReview carries", () => {
    expect(
      platformName({ ...dacon, source: "openreview", kind: "cfp" })
    ).toBeNull()
  })

  it("names none when the platform runs the competition itself", () => {
    expect(
      platformName({ ...dacon, source: "kaggle", organizer: "Kaggle" })
    ).toBeNull()
    expect(
      platformName({ ...dacon, source: "kaggle", organizer: "Kaggle Inc." })
    ).toBeNull()
  })
})
