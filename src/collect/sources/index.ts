import type { Source } from "../run.ts"
import { codabench } from "./codabench/index.ts"
import { dacon } from "./dacon/index.ts"
import { evalai } from "./evalai/index.ts"
import { kaggle } from "./kaggle/index.ts"
import { openreview } from "./openreview/index.ts"

export const sources: Source[] = [openreview, evalai, codabench, kaggle, dacon]
