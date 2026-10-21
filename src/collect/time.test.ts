import { describe, expect, it } from "vitest"

import { deadlineZone, isoFromMs } from "./time.ts"

describe("isoFromMs", () => {
  it("writes an epoch time as a UTC instant", () => {
    expect(isoFromMs(1788263940000)).toBe("2026-09-01T11:59:00.000Z")
  })
})

describe("deadlineZone", () => {
  it("reads 11:59 and 12:00 UTC as the end of a day Anywhere on Earth", () => {
    expect(deadlineZone(Date.parse("2026-11-16T11:59:00Z"))).toBe("AoE")
    expect(deadlineZone(Date.parse("2026-11-16T11:59:59Z"))).toBe("AoE")
    expect(deadlineZone(Date.parse("2026-11-16T12:00:00Z"))).toBe("AoE")
  })

  it("keeps any other time in UTC", () => {
    expect(deadlineZone(Date.parse("2026-11-16T10:59:00Z"))).toBe("UTC")
    expect(deadlineZone(Date.parse("2026-11-16T23:59:59Z"))).toBe("UTC")
    expect(deadlineZone(Date.parse("2026-11-16T12:01:00Z"))).toBe("UTC")
  })
})
