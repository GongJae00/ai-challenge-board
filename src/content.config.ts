import { defineCollection } from "astro:content"
import { glob } from "astro/loaders"

import { sourceFileSchema } from "./lib/listing.ts"

// One entry per collected source; the build fails when a file does not fit the schema.
const sources = defineCollection({
  loader: glob({ pattern: "*.json", base: "./src/data/sources" }),
  schema: sourceFileSchema,
})

export const collections = { sources }
