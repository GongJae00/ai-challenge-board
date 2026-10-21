import { describe, expect, it } from "vitest"

import {
  deadlineZone,
  endsAhead,
  isoFromKst,
  isoFromMs,
  PLACEHOLDER_AFTER_MS,
} from "./time.ts"

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

describe("isoFromKst", () => {
  it("reads a Korean local time without a zone as KST, UTC+9", () => {
    expect(isoFromKst("2026-11-02 10:00:00")).toBe("2026-11-02T01:00:00.000Z")
    expect(isoFromKst("2026-11-02T23:59")).toBe("2026-11-02T14:59:00.000Z")
    expect(isoFromKst(" 2026-11-02 10:00:00 ")).toBe("2026-11-02T01:00:00.000Z")
  })

  it("reads 24:00 as midnight at the end of the day", () => {
    expect(isoFromKst("2026-11-02 24:00:00")).toBe("2026-11-02T15:00:00.000Z")
    expect(isoFromKst("2026-11-02 24:01")).toBeNull()
  })

  it("rejects text that is not a local date and time", () => {
    expect(isoFromKst("2026-11-02")).toBeNull()
    expect(isoFromKst("2026-11-02T01:00:00Z")).toBeNull()
    expect(isoFromKst("2026-13-02 10:00:00")).toBeNull()
    expect(isoFromKst("2026-11-02 10:61:00")).toBeNull()
    expect(isoFromKst("2026-02-30 10:00:00")).toBeNull()
    expect(isoFromKst("0000-01-01 00:00")).toBeNull()
    expect(isoFromKst("")).toBeNull()
  })
})

describe("endsAhead", () => {
  const now = new Date("2026-10-21T00:00:00Z")

  it("holds for an end after now and within the placeholder horizon", () => {
    expect(endsAhead(now.getTime() + 1, now)).toBe(true)
    expect(endsAhead(now.getTime() + PLACEHOLDER_AFTER_MS, now)).toBe(true)
  })

  it("fails for an end that has passed or is a placeholder for never", () => {
    expect(endsAhead(now.getTime(), now)).toBe(false)
    expect(endsAhead(now.getTime() + PLACEHOLDER_AFTER_MS + 1, now)).toBe(false)
  })
})
