import type { Deadline } from "../lib/listing.ts"

/** Milliseconds since the epoch as an ISO 8601 UTC instant. */
export function isoFromMs(ms: number): string {
  return new Date(ms).toISOString()
}

/**
 * The zone to show a deadline in when the source stores only the instant. An instant at 11:59 or 12:00 UTC is
 * 23:59 or midnight Anywhere on Earth (UTC−12), the convention of AI paper deadlines, so it is shown as AoE: the
 * instant is the same either way, and the organizers' announcement then reads the same date and time.
 */
export function deadlineZone(ms: number): Deadline["zone"] {
  const at = new Date(ms)
  const clock = at.getUTCHours() * 60 + at.getUTCMinutes()
  return clock === 11 * 60 + 59 || clock === 12 * 60 ? "AoE" : "UTC"
}
