import { describe, expect, it } from "vitest"

import type { Client } from "../../http.ts"
import page1 from "./fixtures/list-general-page1.json"
import page2 from "./fixtures/list-general-page2.json"
import { createKaggle } from "./index.ts"

const now = new Date("2026-10-21T07:00:00Z")

function fakeClient() {
  const posts: { body: unknown; headers?: Record<string, string> }[] = []
  const client: Client = {
    getText: async () => "",
    getJson: async () => ({}),
    postJson: async (_url, body, headers) => {
      posts.push({ body, headers })
      return (body as { page: number }).page === 1 ? page1 : page2
    },
  }
  return { client, posts }
}

describe("kaggle", () => {
  it("pages through the list with the token until a short page", async () => {
    const { client, posts } = fakeClient()
    const listings = await createKaggle(() => "test-token").collect(
      client,
      now,
      { previous: null }
    )
    expect(listings).toHaveLength(11)
    expect(posts.map((p) => (p.body as { page: number }).page)).toEqual([1, 2])
    expect(posts[0].headers).toEqual({ authorization: "Bearer test-token" })
  })

  it("fails with the setting's name when the token is missing", async () => {
    const { client } = fakeClient()
    await expect(
      createKaggle(() => undefined).collect(client, now, { previous: null })
    ).rejects.toThrow(/KAGGLE_API_TOKEN/)
  })

  it("rejects a token with a line break without echoing it", async () => {
    const { client } = fakeClient()
    const result = createKaggle(() => "abc\ndef").collect(client, now, {
      previous: null,
    })
    await expect(result).rejects.toThrow(/KAGGLE_API_TOKEN holds/)
    await expect(result).rejects.not.toThrow(/abc/)
  })
})
