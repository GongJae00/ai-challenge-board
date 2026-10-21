/**
 * Collects every source and writes `src/data/sources/<source>.json`; run with `npm run collect`. It exits
 * non-zero when a source failed, after writing the others, so that the scheduled job shows the failure.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises"

import { sourceFileSchema, type SourceFile } from "../lib/listing.ts"
import { createClient } from "./http.ts"
import { runSource } from "./run.ts"
import { sources } from "./sources/index.ts"

const dataDir = new URL("../data/sources/", import.meta.url)

async function readPrevious(id: string): Promise<SourceFile | null> {
  let text: string
  try {
    text = await readFile(new URL(`${id}.json`, dataDir), "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
    throw error
  }
  return sourceFileSchema.parse(JSON.parse(text))
}

const client = createClient()
const now = new Date()
await mkdir(dataDir, { recursive: true })

// Sources live on different hosts, so they run at once; the client keeps each host to one request at a time.
const results = await Promise.allSettled(
  sources.map(async (source) => {
    const result = await runSource({
      source,
      client,
      now,
      previous: await readPrevious(source.id),
    })
    if (result.file)
      await writeFile(
        new URL(`${source.id}.json`, dataDir),
        `${JSON.stringify(result.file, null, 2)}\n`
      )
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
