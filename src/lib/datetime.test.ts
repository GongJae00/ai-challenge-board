import { describe, expect, it } from "vitest"

import {
  formatDate,
  formatDaysLeft,
  formatMonth,
  formatSourceTime,
  formatTime,
  minuteOf,
  weekdayNames,
} from "./datetime.ts"
import type { Deadline } from "./listing.ts"

// 11:59 UTC on 16 November is 23:59 on 15 November Anywhere on Earth.
const at = new Date("2026-11-16T11:59:00Z")
const utc: Deadline = {
  kind: "submission",
  label: null,
  at: at.toISOString(),
  zone: "UTC",
}
const aoe: Deadline = { ...utc, zone: "AoE" }
const kst: Deadline = { ...utc, zone: "KST" }

describe("datetime", () => {
  it("names months in each locale", () => {
    expect(formatMonth("2026-11", "ko")).toBe("2026년 11월")
    expect(formatMonth("2026-11", "en")).toBe("November 2026")
  })

  it("gives the date and weekday in the viewer's zone", () => {
    expect(formatDate(at, "ko", "Asia/Seoul", at)).toBe("11월 16일 (월)")
    expect(formatDate(at, "en", "Pacific/Honolulu", at)).toBe("Mon, Nov 16")
    expect(formatDate(at, "en", "Etc/GMT+12", at)).toBe("Sun, Nov 15")
  })

  it("adds the year to a date in another year than now", () => {
    const next = new Date("2027-01-08T00:00:00Z")
    expect(formatDate(next, "ko", "Asia/Seoul", at)).toBe("2027년 1월 8일 (금)")
    expect(formatDate(next, "en", "Asia/Seoul", at)).toBe("Fri, Jan 8, 2027")
  })

  it("writes the time on a 24-hour clock", () => {
    expect(formatTime(at, "ko", "Asia/Seoul")).toBe("20:59")
    expect(formatTime(at, "en", "UTC")).toBe("11:59")
  })

  it("gives the source's own date and clock, with AoE as UTC−12", () => {
    expect(formatSourceTime(aoe, "ko", "Asia/Seoul")).toBe(
      "AoE 11월 15일 23:59"
    )
    expect(formatSourceTime(aoe, "en", "Asia/Seoul")).toBe("AoE Nov 15, 23:59")
    expect(formatSourceTime(kst, "en", "UTC")).toBe("KST Nov 16, 20:59")
  })

  it("gives no source time when it would repeat the shown time or the source states no zone", () => {
    expect(formatSourceTime(kst, "ko", "Asia/Seoul")).toBeNull()
    expect(formatSourceTime(aoe, "en", "Etc/GMT+12")).toBeNull()
    expect(formatSourceTime(utc, "en", "Asia/Seoul")).toBeNull()
    expect(formatSourceTime(kst, "ko", "Asia/Tokyo")).toBeNull()
  })

  it("puts instants of the same minute together, stray seconds and milliseconds included", () => {
    const minute = minuteOf(Date.parse("2026-11-12T23:59:00.000Z"))
    expect(minuteOf(Date.parse("2026-11-12T23:59:59.807Z"))).toBe(minute)
    expect(minuteOf(Date.parse("2026-11-13T00:00:00.000Z"))).toBe(minute + 1)
  })

  it("says days left in words", () => {
    expect(formatDaysLeft(0, "ko")).toBe("오늘")
    expect(formatDaysLeft(1, "en")).toBe("tomorrow")
    expect(formatDaysLeft(31, "ko")).toBe("31일 후")
    expect(formatDaysLeft(31, "en")).toBe("in 31 days")
  })

  it("names the weekdays Sunday first", () => {
    expect(weekdayNames("ko")).toEqual([
      "일",
      "월",
      "화",
      "수",
      "목",
      "금",
      "토",
    ])
    expect(weekdayNames("en")[0]).toBe("Sun")
  })
})
