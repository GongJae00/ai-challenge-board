import robotsParser from "robots-parser"

/** The token robots.txt rules name to address this collector. */
export const ROBOTS_TOKEN = "ACB-collector"
export const USER_AGENT = `${ROBOTS_TOKEN}/0.1 (+https://github.com/GongJae00/ai-challenge-board)`

const TIMEOUT_MS = 30_000
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
}

interface Host {
  robots: { isAllowed(url: string, ua?: string): boolean | undefined } | null
  delayMs: number
  nextAt: number
  /** Requests to one host run one after another on this chain. */
  queue: Promise<unknown>
}

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500
}

/**
 * An HTTP client that keeps the collection rules in `.claude/rules/engineering.md`: it reads each host's
 * robots.txt first and obeys it and its Crawl-delay, sends one request at a time per host, times out every
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

  async function waitTurn(host: Host): Promise<void> {
    const wait = host.nextAt - now()
    if (wait > 0) await sleep(wait)
    host.nextAt = now() + host.delayMs
  }

  /**
   * One GET with retries on network errors, 5xx, and 429. It returns the last response, or throws when the
   * request never got one; a 429 that does not clear blocks the source.
   */
  async function fetchWithRetry(
    host: Host,
    url: string,
    redirect: RequestRedirect
  ): Promise<Response> {
    for (let n = 1; ; n += 1) {
      await waitTurn(host)
      let response: Response | null = null
      let failure: unknown = null
      try {
        response = await doFetch(url, {
          headers: { "user-agent": USER_AGENT, accept: "*/*" },
          redirect,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        })
      } catch (error) {
        failure = error
      }
      if (response && !isRetryable(response.status)) return response
      if (n >= MAX_ATTEMPTS) {
        if (response?.status === 429)
          throw new BlockedError(url, "rate limit did not clear")
        if (response) return response
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
      nextAt: 0,
      queue: Promise.resolve(),
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
    if (response.ok && isText) {
      const robots = robotsParser(robotsUrl, await response.text())
      host.robots = robots
      const crawlDelay = robots.getCrawlDelay(ROBOTS_TOKEN)
      if (crawlDelay !== undefined)
        host.delayMs = Math.max(minDelayMs, crawlDelay * 1000)
      host.nextAt = Math.max(host.nextAt, now() + host.delayMs)
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
    url: string
  ): Promise<{ text: string } | { redirect: string }> {
    const response = await fetchWithRetry(host, url, "manual")
    const location = response.headers.get("location")
    if (response.status >= 300 && response.status < 400 && location)
      return { redirect: new URL(location, url).href }
    if (response.headers.get("cf-mitigated") === "challenge")
      throw new BlockedError(url, "challenge page")
    if (response.status === 401 || response.status === 403)
      throw new BlockedError(url, `status ${response.status}`)
    if (!response.ok) throw new Error(`Status ${response.status} from ${url}`)
    return { text: await response.text() }
  }

  async function getText(url: string, redirects = 0): Promise<string> {
    const parsed = new URL(url)
    if (parsed.protocol !== "https:")
      throw new Error(`Only https is collected: ${url}`)
    const host = await hostFor(parsed)
    if (host.robots && host.robots.isAllowed(url, ROBOTS_TOKEN) === false)
      throw new BlockedError(url, "disallowed by robots.txt")

    const run = () => fetchPage(host, url)
    const result = host.queue.then(run, run)
    host.queue = result.catch(() => undefined)
    const page = await result
    if ("text" in page) return page.text
    if (redirects >= MAX_REDIRECTS)
      throw new Error(`More than ${MAX_REDIRECTS} redirects from ${url}`)
    // The redirect goes through the same checks: https, the new host's robots.txt, and its queue.
    return getText(page.redirect, redirects + 1)
  }

  return {
    getText: (url) => getText(url),
    async getJson(url) {
      const text = await getText(url)
      try {
        return JSON.parse(text) as unknown
      } catch (error) {
        throw new Error(`Response from ${url} is not JSON`, { cause: error })
      }
    },
  }
}
