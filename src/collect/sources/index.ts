import type { Source } from "../run.ts"
import { aicrowd } from "./aicrowd/index.ts"
import { aifactory } from "./aifactory/index.ts"
import { codabench } from "./codabench/index.ts"
import { dacon } from "./dacon/index.ts"
import { evalai } from "./evalai/index.ts"
import { kaggle } from "./kaggle/index.ts"
import { lablab } from "./lablab/index.ts"
import { openreview } from "./openreview/index.ts"
import { signate } from "./signate/index.ts"
import { tianchi } from "./tianchi/index.ts"
import { zindi } from "./zindi/index.ts"

export const sources: Source[] = [
  openreview,
  evalai,
  codabench,
  kaggle,
  dacon,
  aifactory,
  lablab,
  zindi,
  signate,
  tianchi,
  aicrowd,
]
