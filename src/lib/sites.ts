import type { Listing, SourceId } from "./listing.ts"
import { fold } from "./words.ts"

interface Site {
  /** The name visitors know the site by. */
  name: string
  /** The page a visitor opens to see the site's listings. */
  url: string
  /**
   * Whether the site runs the competitions it lists, so that a listing names it beside its organizer, rather
   * than taking a workshop's submissions on the conference's behalf, as OpenReview does.
   */
  platform: boolean
  /** A Korean site, which the footer lists apart from the others. */
  korean: boolean
}

/** Every site ACB collects from; a new source needs its entry here. */
export const sites = {
  openreview: {
    name: "OpenReview",
    url: "https://openreview.net/",
    platform: false,
    korean: false,
  },
  evalai: {
    name: "EvalAI",
    url: "https://eval.ai/",
    platform: true,
    korean: false,
  },
  codabench: {
    name: "Codabench",
    url: "https://www.codabench.org/",
    platform: true,
    korean: false,
  },
  kaggle: {
    name: "Kaggle",
    url: "https://www.kaggle.com/competitions",
    platform: true,
    korean: false,
  },
  dacon: {
    name: "DACON",
    url: "https://dacon.io/",
    platform: true,
    korean: true,
  },
  aifactory: {
    name: "AIFactory",
    url: "https://aifactory.space/",
    platform: true,
    korean: true,
  },
  drivendata: {
    name: "DrivenData",
    url: "https://www.drivendata.org/competitions/",
    platform: true,
    korean: false,
  },
  lablab: {
    name: "lablab.ai",
    url: "https://lablab.ai/ai-hackathons",
    platform: true,
    korean: false,
  },
  zindi: {
    name: "Zindi",
    url: "https://zindi.world/competitions",
    platform: true,
    korean: false,
  },
  signate: {
    name: "SIGNATE",
    url: "https://user.competition.signate.jp/ja/competition/list/",
    platform: true,
    korean: false,
  },
  tianchi: {
    name: "Tianchi",
    url: "https://tianchi.aliyun.com/competition/gameList/activeList",
    platform: true,
    korean: false,
  },
  devpost: {
    name: "Devpost",
    url: "https://devpost.com/hackathons",
    platform: true,
    korean: false,
  },
  grandchallenge: {
    name: "Grand Challenge",
    url: "https://grand-challenge.org/challenges/",
    platform: true,
    korean: false,
  },
  aicrowd: {
    name: "AIcrowd",
    url: "https://www.aicrowd.com/challenges",
    platform: true,
    korean: false,
  },
} as const satisfies Record<SourceId, Site>

/** The sources that are competition platforms, such as `dacon`. */
export type PlatformId = {
  [Id in SourceId]: (typeof sites)[Id]["platform"] extends true ? Id : never
}[SourceId]

/**
 * The platform a listing runs on, such as "DACON", for the host column; null for a call that OpenReview carries,
 * whose host is its conference, and for a competition the platform runs itself, whose organizer already names it,
 * as "Kaggle" or "Kaggle Inc." does.
 */
export function platformName(listing: Listing): string | null {
  if (!isPlatform(listing.source)) return null
  const site = sites[listing.source]
  const organizer = listing.organizer && fold(listing.organizer)
  if (organizer?.startsWith(fold(site.name))) return null
  return site.name
}

function byName(a: SourceId, b: SourceId): number {
  return sites[a].name.localeCompare(sites[b].name, "en")
}

const sourceIdsByName = (Object.keys(sites) as SourceId[]).sort(byName)

function isPlatform(id: SourceId): id is PlatformId {
  return sites[id].platform
}

/** The competition platforms, in alphabetical order, as the filters list them. */
export const platforms = sourceIdsByName.filter(isPlatform)

/** The sites outside Korea and the Korean ones, each in alphabetical order, as the footer lists them. */
export const sitesAbroad = sourceIdsByName.filter((id) => !sites[id].korean)
export const sitesInKorea = sourceIdsByName.filter((id) => sites[id].korean)
