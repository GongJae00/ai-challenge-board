import type { Source } from "../run.ts"
import { evalai } from "./evalai/index.ts"
import { openreview } from "./openreview/index.ts"

export const sources: Source[] = [openreview, evalai]
