import robotsParser from "robots-parser"

/** The token robots.txt rules name to address this collector. */
export const ROBOTS_TOKEN = "ACB-collector"
export const USER_AGENT = `${ROBOTS_TOKEN}/0.1 (+https://github.com/GongJae00/ai-challenge-board)`

/** Codabench sends its API responses at a few kilobytes a second, so a list page takes tens of seconds. */
const TIMEOUT_MS = 90_000
/** Tries per request: the first and up to two retries. */
const MAX_ATTEMPTS = 3
const BACKOFF_MS = [5_000, 15_000]
const MAX_REDIRECTS = 5

/** The source refused the collector, or robots.txt does not allow it; stop collecting from the source. */
export class BlockedError extends Error {
  readonly url: string
  constructor(url: string, reason: string) {
    super(`Blocked at ${url}: ${reason}`)
    this.name = "BlockedError"
    this.url = url
  }
}

export interface ClientOptions {
  fetch?: typeof globalThis.fetch
  sleep?: (ms: number) => Promise<void>
  now?: () => number
  /** The least time between two requests to one host; robots.txt's Crawl-delay can raise it. */
  minDelayMs?: number
}

export interface Client {
  getText(url: string): Promise<string>
  getJson(url: string): Promise<unknown>
  /**
   * A POST that only reads, such as a list query an API takes as JSON. It is retried like a GET, and it is not
   * followed through a redirect, so `headers` such as a token reach only the URL given.
   */
  postJson(
    url: string,
    body: unknown,
    headers?: Record<string, string>
  ): Promise<unknown>
}

/** A response with its body read. */
interface Answer {
  status: number
  headers: Headers
  body: string
}

type RequestSpec =
  | { method: "GET" }
  | { method: "POST"; body: string; headers: Record<string, string> }

const GET: RequestSpec = { method: "GET" }

interface Host {
  robots: { isAllowed(url: string, ua?: string): boolean | undefined } | null
  delayMs: number
  pace: Pace
}

/** When a site may next be asked, and its requests' chain, so that they run one after another. */
interface Pace {
  nextAt: number
  queue: Promise<unknown>
}

/**
 * The site a host belongs to, its registrable domain, such as `devpost.com` for `amazonappdev2026.devpost.com`:
 * the last two labels, or three under a country's second level such as `co.kr`. The hosts of one site share one
 * pace, since they are one server; each still has its own robots.txt.
 */
export function siteOf(hostname: string): string {
  const labels = hostname.split(".")
  const secondLevel = /^(ac|co|go|or|ne|re|com|net|org|gov|edu)$/
  const keep =
    labels.length > 2 &&
    labels.at(-1)!.length === 2 &&
    secondLevel.test(labels.at(-2)!)
      ? 3
      : 2
  return labels.slice(-keep).join(".")
}

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500
}

/**
 * An HTTP client that keeps the collection rules in `.claude/rules/engineering.md`: it reads each host's
 * robots.txt first and obeys it and its Crawl-delay, sends one request at a time per site, times out every
 * request, retries only network errors, server errors, and rate limits with backoff, stops on a refusal or a
 * challenge, and follows a redirect only through the same checks, so another host is read under its own rules.
 */
export function createClient(options: ClientOptions = {}): Client {
  const doFetch = options.fetch ?? globalThis.fetch
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const now = options.now ?? Date.now
  const minDelayMs = options.minDelayMs ?? 5_000
  // The promise, not the host, so that concurrent first requests to an origin share one robots.txt read.
  const hosts = new Map<string, Promise<Host>>()
  const paces = new Map<string, Pace>()

  function paceOf(hostname: string): Pace {
    const site = siteOf(hostname)
    let pace = paces.get(site)
    if (!pace) {
      pace = { nextAt: 0, queue: Promise.resolve() }
      paces.set(site, pace)
    }
    return pace
  }

  async function waitTurn(host: Host): Promise<void> {
    const wait = host.pace.nextAt - now()
    if (wait > 0) await sleep(wait)
    host.pace.nextAt = now() + host.delayMs
  }

  /**
   * One request with retries on network errors, 5xx, and 429, with its body read inside the retry, so that a
   * timeout or a reset while a slow body streams is retried too. It returns the last answer, or throws when the
   * request never got one; a 429 that does not clear blocks the source.
   */
  async function fetchWithRetry(
    host: Host,
    url: string,
    redirect: RequestRedirect,
    spec: RequestSpec = GET
  ): Promise<Answer> {
    for (let n = 1; ; n += 1) {
      await waitTurn(host)
      let answer: Answer | null = null
      let failure: unknown = null
      try {
        const response = await doFetch(url, {
          method: spec.method,
          headers: {
            "user-agent": USER_AGENT,
            accept: "*/*",
            ...(spec.method === "POST"
              ? { "content-type": "application/json", ...spec.headers }
              : {}),
          },
          body: spec.method === "POST" ? spec.body : undefined,
          redirect,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        })
        answer = {
          status: response.status,
          headers: response.headers,
          body: await response.text(),
        }
      } catch (error) {
        failure = error
      }
      if (answer && !isRetryable(answer.status)) return answer
      if (n >= MAX_ATTEMPTS) {
        if (answer?.status === 429)
          throw new BlockedError(url, "rate limit did not clear")
        if (answer) return answer
        throw new Error(`Request to ${url} failed: ${String(failure)}`, {
          cause: failure,
        })
      }
      await sleep(BACKOFF_MS[n - 1] ?? BACKOFF_MS.at(-1)!)
    }
  }

  async function loadRobots(origin: string): Promise<Host> {
    const host: Host = {
      robots: null,
      delayMs: minDelayMs,
      pace: paceOf(new URL(origin).hostname),
    }
    const robotsUrl = `${origin}/robots.txt`
    // RFC 9309 has crawlers follow robots.txt's own redirects.
    const response = await fetchWithRetry(host, robotsUrl, "follow")
    if (response.status >= 500)
      // RFC 9309: an unreachable robots.txt means the whole site is disallowed.
      throw new BlockedError(
        robotsUrl,
        `robots.txt answered ${response.status}`
      )
    const isText = (response.headers.get("content-type") ?? "text/plain")
      .toLowerCase()
      .startsWith("text/plain")
    if (response.status >= 200 && response.status < 300 && isText) {
      const robots = robotsParser(robotsUrl, response.body)
      host.robots = robots
      const crawlDelay = robots.getCrawlDelay(ROBOTS_TOKEN)
      if (crawlDelay !== undefined)
        host.delayMs = Math.max(minDelayMs, crawlDelay * 1000)
      host.pace.nextAt = Math.max(host.pace.nextAt, now() + host.delayMs)
    }
    // RFC 9309: a robots.txt that is unavailable (4xx) places no restriction, and neither does a page served
    // in its place, such as a single-page app answering every path with its HTML shell.
    return host
  }

  function hostFor(url: URL): Promise<Host> {
    let host = hosts.get(url.origin)
    if (!host) {
      host = loadRobots(url.origin)
      hosts.set(url.origin, host)
    }
    return host
  }

  /** The body of a successful response, or the next URL when the response redirects. */
  async function fetchPage(
    host: Host,
    url: string,
    spec: RequestSpec
  ): Promise<{ text: string } | { redirect: string }> {
    const response = await fetchWithRetry(host, url, "manual", spec)
    const location = response.headers.get("location")
    if (response.status >= 300 && response.status < 400 && location) {
      if (spec.method === "POST")
        throw new Error(`A POST to ${url} answered a redirect to ${location}`)
      return { redirect: new URL(location, url).href }
    }
    if (response.headers.get("cf-mitigated") === "challenge")
      throw new BlockedError(url, "challenge page")
    if (response.status === 401 || response.status === 403)
      throw new BlockedError(url, `status ${response.status}`)
    if (response.status < 200 || response.status >= 300)
      throw new Error(`Status ${response.status} from ${url}`)
    return { text: response.body }
  }

  async function fetchText(
    url: string,
    spec: RequestSpec,
    redirects = 0
  ): Promise<string> {
    const parsed = new URL(url)
    if (parsed.protocol !== "https:")
      throw new Error(`Only https is collected: ${url}`)
    const host = await hostFor(parsed)
    if (host.robots && host.robots.isAllowed(url, ROBOTS_TOKEN) === false)
      throw new BlockedError(url, "disallowed by robots.txt")

    const run = () => fetchPage(host, url, spec)
    const result = host.pace.queue.then(run, run)
    host.pace.queue = result.catch(() => undefined)
    const page = await result
    if ("text" in page) return page.text
    if (redirects >= MAX_REDIRECTS)
      throw new Error(`More than ${MAX_REDIRECTS} redirects from ${url}`)
    // The redirect goes through the same checks: https, the new host's robots.txt, and its queue.
    return fetchText(page.redirect, GET, redirects + 1)
  }

  function parseJson(text: string, url: string): unknown {
    try {
      return JSON.parse(text) as unknown
    } catch (error) {
      throw new Error(`Response from ${url} is not JSON`, { cause: error })
    }
  }

  return {
    getText: (url) => fetchText(url, GET),
    async getJson(url) {
      return parseJson(await fetchText(url, GET), url)
    },
    async postJson(url, body, headers = {}) {
      const spec: RequestSpec = {
        method: "POST",
        body: JSON.stringify(body),
        headers,
      }
      return parseJson(await fetchText(url, spec), url)
    },
  }
}
