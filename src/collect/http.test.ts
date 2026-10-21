import { describe, expect, it } from "vitest"

import { BlockedError, createClient, USER_AGENT } from "./http.ts"

type Handler = (url: string, init: RequestInit) => Response

function fakeWeb(handler: Handler) {
  const calls: {
    url: string
    at: number
    headers: Headers
    method: string
    body: string | null
  }[] = []
  let clock = 0
  const client = createClient({
    fetch: async (input, init = {}) => {
      const url = String(input)
      calls.push({
        url,
        at: clock,
        headers: new Headers(init.headers),
        method: init.method ?? "GET",
        body: typeof init.body === "string" ? init.body : null,
      })
      return handler(url, init)
    },
    sleep: async (ms) => {
      clock += ms
    },
    now: () => clock,
    minDelayMs: 5000,
  })
  return { client, calls }
}

const robotsAllowAll = "User-agent: *\nAllow: /\n"

describe("createClient", () => {
  it("reads robots.txt once per host and sends the collector's User-Agent", async () => {
    const { client, calls } = fakeWeb((url) =>
      url.endsWith("/robots.txt")
        ? new Response(robotsAllowAll)
        : new Response("{}", { status: 200 })
    )
    await client.getText("https://a.example/api/1")
    await client.getText("https://a.example/api/2")
    expect(calls.map((c) => c.url)).toEqual([
      "https://a.example/robots.txt",
      "https://a.example/api/1",
      "https://a.example/api/2",
    ])
    expect(calls.every((c) => c.headers.get("user-agent") === USER_AGENT)).toBe(
      true
    )
  })

  it("refuses a path that robots.txt disallows for the collector", async () => {
    const { client, calls } = fakeWeb((url) =>
      url.endsWith("/robots.txt")
        ? new Response("User-agent: ACB-collector\nDisallow: /private\n")
        : new Response("{}")
    )
    await expect(client.getText("https://a.example/private/x")).rejects.toThrow(
      BlockedError
    )
    expect(calls).toHaveLength(1)
  })

  it("treats an unreachable robots.txt as a full disallow", async () => {
    const { client } = fakeWeb((url) =>
      url.endsWith("/robots.txt")
        ? new Response("", { status: 503 })
        : new Response("{}")
    )
    await expect(client.getText("https://a.example/api")).rejects.toThrow(
      BlockedError
    )
  })

  it("treats a missing robots.txt as no restriction", async () => {
    const { client } = fakeWeb((url) =>
      url.endsWith("/robots.txt")
        ? new Response("", { status: 404 })
        : new Response("ok")
    )
    await expect(client.getText("https://a.example/api")).resolves.toBe("ok")
  })

  it("reads no rules from an HTML page served as robots.txt", async () => {
    const { client } = fakeWeb((url) =>
      url.endsWith("/robots.txt")
        ? new Response("<html>User-agent: *\nDisallow: /\n</html>", {
            headers: { "content-type": "text/html" },
          })
        : new Response("ok")
    )
    await expect(client.getText("https://a.example/api")).resolves.toBe("ok")
  })

  it("spaces requests to one host by the larger of the minimum and Crawl-delay", async () => {
    const { client, calls } = fakeWeb((url) =>
      url.endsWith("/robots.txt")
        ? new Response("User-agent: *\nCrawl-delay: 10\n")
        : new Response("ok")
    )
    await client.getText("https://a.example/1")
    await client.getText("https://a.example/2")
    const [robots, first, second] = calls.map((c) => c.at)
    expect(first - robots).toBeGreaterThanOrEqual(10_000)
    expect(second - first).toBeGreaterThanOrEqual(10_000)
  })

  it("stops on 403 without retrying", async () => {
    const { client, calls } = fakeWeb((url) =>
      url.endsWith("/robots.txt")
        ? new Response(robotsAllowAll)
        : new Response("no", { status: 403 })
    )
    await expect(client.getText("https://a.example/api")).rejects.toThrow(
      BlockedError
    )
    expect(calls).toHaveLength(2)
  })

  it("stops on a challenge page", async () => {
    const { client } = fakeWeb((url) =>
      url.endsWith("/robots.txt")
        ? new Response(robotsAllowAll)
        : new Response("<html>", {
            status: 200,
            headers: { "cf-mitigated": "challenge" },
          })
    )
    await expect(client.getText("https://a.example/api")).rejects.toThrow(
      BlockedError
    )
  })

  it("retries a server error with backoff, then succeeds", async () => {
    let attempts = 0
    const { client, calls } = fakeWeb((url) => {
      if (url.endsWith("/robots.txt")) return new Response(robotsAllowAll)
      attempts += 1
      return attempts < 3
        ? new Response("busy", { status: 502 })
        : new Response("ok")
    })
    await expect(client.getText("https://a.example/api")).resolves.toBe("ok")
    expect(calls).toHaveLength(4)
  })

  it("retries a request whose body fails while it streams", async () => {
    let attempts = 0
    const { client } = fakeWeb((url) => {
      if (url.endsWith("/robots.txt")) return new Response(robotsAllowAll)
      attempts += 1
      if (attempts === 1)
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.error(new Error("connection reset"))
            },
          })
        )
      return new Response("ok")
    })
    await expect(client.getText("https://a.example/api")).resolves.toBe("ok")
    expect(attempts).toBe(2)
  })

  it("gives up on a 429 that does not clear", async () => {
    const { client, calls } = fakeWeb((url) =>
      url.endsWith("/robots.txt")
        ? new Response(robotsAllowAll)
        : new Response("slow down", { status: 429 })
    )
    await expect(client.getText("https://a.example/api")).rejects.toThrow(
      BlockedError
    )
    expect(calls).toHaveLength(4)
  })

  it("fails on another client error with the status in the message", async () => {
    const { client } = fakeWeb((url) =>
      url.endsWith("/robots.txt")
        ? new Response(robotsAllowAll)
        : new Response("gone", { status: 404 })
    )
    await expect(client.getText("https://a.example/api")).rejects.toThrow(
      /404.*https:\/\/a\.example\/api/
    )
  })

  it("follows a redirect on the same host after the redirect's own checks", async () => {
    const { client, calls } = fakeWeb((url) => {
      if (url.endsWith("/robots.txt")) return new Response(robotsAllowAll)
      if (url.endsWith("/old"))
        return new Response(null, {
          status: 301,
          headers: { location: "/new" },
        })
      return new Response("moved here")
    })
    await expect(client.getText("https://a.example/old")).resolves.toBe(
      "moved here"
    )
    expect(calls.map((c) => c.url)).toEqual([
      "https://a.example/robots.txt",
      "https://a.example/old",
      "https://a.example/new",
    ])
  })

  it("reads another host's robots.txt before following a redirect there", async () => {
    const { client, calls } = fakeWeb((url) => {
      if (url === "https://b.example/robots.txt")
        return new Response("User-agent: *\nDisallow: /\n")
      if (url.endsWith("/robots.txt")) return new Response(robotsAllowAll)
      return new Response(null, {
        status: 302,
        headers: { location: "https://b.example/page" },
      })
    })
    await expect(client.getText("https://a.example/page")).rejects.toThrow(
      BlockedError
    )
    expect(calls.map((c) => c.url)).toEqual([
      "https://a.example/robots.txt",
      "https://a.example/page",
      "https://b.example/robots.txt",
    ])
  })

  it("refuses a redirect to plain http", async () => {
    const { client } = fakeWeb((url) =>
      url.endsWith("/robots.txt")
        ? new Response(robotsAllowAll)
        : new Response(null, {
            status: 301,
            headers: { location: "http://a.example/page" },
          })
    )
    await expect(client.getText("https://a.example/page")).rejects.toThrow(
      /Only https/
    )
  })

  it("reads robots.txt once when the first requests to a host start together", async () => {
    const { client, calls } = fakeWeb((url) =>
      url.endsWith("/robots.txt")
        ? new Response(robotsAllowAll)
        : new Response("ok")
    )
    await Promise.all([
      client.getText("https://a.example/1"),
      client.getText("https://a.example/2"),
    ])
    expect(calls.filter((c) => c.url.endsWith("/robots.txt"))).toHaveLength(1)
  })

  it("stops when robots.txt keeps answering 429", async () => {
    const { client } = fakeWeb((url) =>
      url.endsWith("/robots.txt")
        ? new Response("", { status: 429 })
        : new Response("ok")
    )
    await expect(client.getText("https://a.example/api")).rejects.toThrow(
      BlockedError
    )
  })

  it("retries a robots.txt request that fails on the network", async () => {
    let failures = 0
    const { client } = fakeWeb((url) => {
      if (url.endsWith("/robots.txt") && failures < 1) {
        failures += 1
        throw new TypeError("network down")
      }
      return url.endsWith("/robots.txt")
        ? new Response(robotsAllowAll)
        : new Response("ok")
    })
    await expect(client.getText("https://a.example/api")).resolves.toBe("ok")
  })

  it("posts a JSON query with its headers and reads the JSON answer", async () => {
    const { client, calls } = fakeWeb((url) =>
      url.endsWith("/robots.txt")
        ? new Response("", { status: 404 })
        : new Response('{"items":[]}')
    )
    await expect(
      client.postJson(
        "https://api.example/list",
        { page: 1 },
        { authorization: "Bearer test-token" }
      )
    ).resolves.toEqual({ items: [] })
    const post = calls[1]
    expect(post.method).toBe("POST")
    expect(post.body).toBe('{"page":1}')
    expect(post.headers.get("authorization")).toBe("Bearer test-token")
    expect(post.headers.get("content-type")).toBe("application/json")
    // robots.txt is read without the token.
    expect(calls[0].headers.get("authorization")).toBeNull()
  })

  it("does not follow a redirect from a POST, so its headers go nowhere else", async () => {
    const { client, calls } = fakeWeb((url) =>
      url.endsWith("/robots.txt")
        ? new Response(robotsAllowAll)
        : new Response(null, {
            status: 302,
            headers: { location: "https://b.example/steal" },
          })
    )
    await expect(
      client.postJson("https://a.example/list", {}, { authorization: "x" })
    ).rejects.toThrow(/redirect/)
    expect(calls.some((c) => c.url.startsWith("https://b.example"))).toBe(false)
  })

  it("parses JSON responses", async () => {
    const { client } = fakeWeb((url) =>
      url.endsWith("/robots.txt")
        ? new Response(robotsAllowAll)
        : new Response('{"n":1}')
    )
    await expect(client.getJson("https://a.example/api")).resolves.toEqual({
      n: 1,
    })
  })
})
