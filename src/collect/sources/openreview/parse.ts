import { z } from "zod"

import type { Conference, Listing } from "../../../lib/listing.ts"
import { cleanText, webUrl } from "../../text.ts"
import { deadlineZone, isoFromMs } from "../../time.ts"

/** OpenReview wraps each content field as `{ value }`. */
const field = <T extends z.ZodType>(value: T) =>
  z.object({ value: value.optional() }).optional()

const groupsResponse = z.object({
  count: z.number().int().optional(),
  groups: z.array(
    z.object({
      id: z.string().min(1),
      content: z
        .object({
          title: field(z.string()),
          subtitle: field(z.string()),
          website: field(z.string()),
          submission_id: field(z.string()),
        })
        .optional(),
    })
  ),
})

const invitationsResponse = z.object({
  invitations: z.array(
    z.object({
      id: z.string().min(1),
      cdate: z.number().int().nullish(),
      duedate: z.number().int().nullish(),
      expdate: z.number().int().nullish(),
    })
  ),
})

export interface Group {
  id: string
  title: string | null
  shortName: string | null
  website: string | null
  submissionId: string | null
}

export interface Invitation {
  id: string
  cdate: number | null
  duedate: number | null
  expdate: number | null
}

function parse<T>(schema: z.ZodType<T>, json: unknown, what: string): T {
  const result = schema.safeParse(json)
  if (!result.success)
    throw new Error(
      `OpenReview ${what} response does not fit: ${z.prettifyError(result.error)}`
    )
  return result.data
}

export function parseGroups(json: unknown): Group[] {
  const response = parse(groupsResponse, json, "groups")
  if (response.count !== undefined && response.count > response.groups.length)
    throw new Error(
      `OpenReview listed ${response.groups.length} of ${response.count} groups; the collector does not page through them`
    )
  return response.groups.map((group) => ({
    id: group.id,
    title: group.content?.title?.value ?? null,
    shortName: group.content?.subtitle?.value ?? null,
    website: group.content?.website?.value ?? null,
    submissionId: group.content?.submission_id?.value ?? null,
  }))
}

export function parseInvitations(json: unknown): Invitation[] {
  return parse(invitationsResponse, json, "invitations").invitations.map(
    (invitation) => ({
      id: invitation.id,
      cdate: invitation.cdate ?? null,
      duedate: invitation.duedate ?? null,
      expdate: invitation.expdate ?? null,
    })
  )
}

/**
 * OpenReview keeps conference competitions, such as the NeurIPS competition track, under the same workshop
 * groups as paper calls; their titles name them as a challenge or a competition. The plural "challenges" is left
 * out, since workshop titles use it for open problems, as in "Open Challenges in Representation Learning".
 */
export const CHALLENGE_TITLE = /\b(challenge|competitions?)\b/i

export function venueUrl(groupId: string): string {
  return `https://openreview.net/group?id=${encodeURIComponent(groupId)}`
}

/**
 * The workshop calls of one conference that have not closed at `now`. A call closes at the invitation's
 * `expdate`; its `duedate` is the deadline the organizers announce, which OpenReview stores as an instant
 * without the organizers' time zone, so the listing gives it in UTC unless it falls at the end of a day Anywhere on
 * Earth.
 */
export function toListings(input: {
  groups: Group[]
  invitations: Invitation[]
  conference: Conference
  year: number
  now: Date
}): Listing[] {
  const invitationsById = new Map(input.invitations.map((i) => [i.id, i]))
  const listings: Listing[] = []
  for (const group of input.groups) {
    const invitation = group.submissionId
      ? invitationsById.get(group.submissionId)
      : undefined
    if (!invitation || invitation.duedate === null) continue
    const closesAt = invitation.expdate ?? invitation.duedate
    if (closesAt <= input.now.getTime()) continue

    const title =
      cleanText(group.title ?? undefined, 300) ??
      cleanText(group.shortName ?? undefined, 300) ??
      group.id.split("/").at(-1)!
    const sourceUrl = venueUrl(group.id)
    listings.push({
      id: `openreview:${group.id}`,
      source: "openreview",
      kind: CHALLENGE_TITLE.test(title) ? "challenge" : "cfp",
      title,
      organizer: null,
      conference: { name: input.conference, year: input.year },
      url: webUrl(group.website ?? undefined) ?? sourceUrl,
      sourceUrl,
      opensAt: invitation.cdate === null ? null : isoFromMs(invitation.cdate),
      deadlines: [
        {
          kind: "submission",
          label: null,
          at: isoFromMs(invitation.duedate),
          zone: deadlineZone(invitation.duedate),
        },
      ],
    })
  }
  return listings
}
