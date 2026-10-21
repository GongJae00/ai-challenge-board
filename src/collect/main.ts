/**
 * Collects every source and writes `src/data/sources/<source>.json`, and a source's own state to
 * `src/data/state/<source>.json`; run with `npm run collect`. It exits non-zero when a source failed, after
 * writing the others, so that the scheduled job shows the failure.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises"

import { sourceFileSchema, type SourceFile } from "../lib/listing.ts"
import { createClient } from "./http.ts"
import { runSource } from "./run.ts"
import { sources } from "./sources/index.ts"

const dataDir = new URL("../data/sources/", import.meta.url)
const stateDir = new URL("../data/state/", import.meta.url)

/** A JSON file's parsed content, or null when the file does not exist. */
async function readJson(url: URL): Promise<unknown> {
  let text: string
  try {
    text = await readFile(url, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
    throw error
  }
  return JSON.parse(text) as unknown
}

async function writeJson(url: URL, value: unknown): Promise<void> {
  await writeFile(url, `${JSON.stringify(value, null, 2)}\n`)
}

async function readPrevious(id: string): Promise<SourceFile | null> {
  const json = await readJson(new URL(`${id}.json`, dataDir))
  return json === null ? null : sourceFileSchema.parse(json)
}

const client = createClient()
const now = new Date()
await mkdir(dataDir, { recursive: true })
await mkdir(stateDir, { recursive: true })

// Sources live on different hosts, so they run at once; the client keeps each host to one request at a time.
const results = await Promise.allSettled(
  sources.map(async (source) => {
    const result = await runSource({
      source,
      client,
      now,
      previous: await readPrevious(source.id),
      previousState: await readJson(new URL(`${source.id}.json`, stateDir)),
    })
    if (result.file)
      await writeJson(new URL(`${source.id}.json`, dataDir), result.file)
    if (result.outcome === "updated" && result.state !== undefined)
      await writeJson(new URL(`${source.id}.json`, stateDir), result.state)
    return result
  })
)

let failed = false
results.forEach((settled, i) => {
  const id = sources[i].id
  if (settled.status === "rejected") {
    failed = true
    console.error(`${id}: failed: ${String(settled.reason)}`)
    return
  }
  const result = settled.value
  if (result.outcome === "updated")
    console.log(`${id}: updated, ${result.file.listings.length} listings`)
  else if (result.outcome === "skipped")
    console.log(`${id}: skipped, ${result.reason}`)
  else {
    failed = true
    console.error(`${id}: kept the last data: ${result.reason}`)
  }
})
if (failed) process.exitCode = 1
