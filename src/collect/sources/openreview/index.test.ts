import { describe, expect, it } from "vitest"

import type { Client } from "../../http.ts"
import { openreview } from "./index.ts"

const now = new Date("2026-10-23T00:00:00Z")

function fakeClient() {
  const requested: string[] = []
  const client: Client = {
    postJson: async () => ({}),
    getText: async () => "",
    getJson: async (url) => {
      requested.push(url)
      return { groups: [] }
    },
  }
  return { client, requested }
}

/** The workshop parents the collector asked OpenReview for, in order. */
async function parents(): Promise<string[]> {
  const { client, requested } = fakeClient()
  await openreview.collect(client, now, { previous: null })
  return requested.map((url) => new URL(url).searchParams.get("parent")!)
}

describe("openreview", () => {
  it("asks for each conference's workshops of this year and the next, under the parent OpenReview files them", async () => {
    const asked = await parents()
    expect(asked).toHaveLength(38)
    // Copied from OpenReview's venue list: the prefixes differ from one conference to the next.
    for (const parent of [
      "NeurIPS.cc/2026/Workshop",
      "thecvf.com/CVPR/2027/Workshop",
      "thecvf.com/WACV/2027/Workshop",
      "aclweb.org/ACL/2027/Workshop",
      "EMNLP/2026/Workshop",
      "aclweb.org/NAACL/2027/Workshop",
      "MICCAI.org/2026/Workshop",
      "ieee.org/ISBI/2026/Workshop",
      "robot-learning.org/CoRL/2026/Workshop",
      "IEEE.org/ICRA/2027/Workshop",
      "IEEE.org/IROS/2026/Workshop",
      "KDD.org/2026/Workshop",
      "ICASSP/2026/Workshop",
      "IEEE.org/IJCNN/2026/Workshop",
    ])
      expect(asked).toContain(parent)
  })
})
