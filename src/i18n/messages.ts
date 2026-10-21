import type { Locale } from "./locales"

// Every user-facing string lives here, keyed the same way in each language.
const ko = {
  "site.name": "AI Challenge Board",
  "site.description":
    "AI 챌린지, 대회, 워크숍 논문 모집의 마감일을 한곳에서 확인합니다.",
  "nav.otherLanguage": "English",
  "home.heading": "AI 챌린지와 대회",
  "home.empty": "아직 모은 챌린지가 없습니다.",
  "redirect.link": "한국어 홈으로 이동",
  "notFound.heading": "페이지를 찾을 수 없습니다",
  "notFound.home": "홈으로 돌아가기",
}

export type MessageKey = keyof typeof ko

const en: Record<MessageKey, string> = {
  "site.name": "AI Challenge Board",
  "site.description":
    "Deadlines for AI challenges, competitions, and workshop paper calls in one place.",
  "nav.otherLanguage": "한국어",
  "home.heading": "AI challenges and competitions",
  "home.empty": "No challenges collected yet.",
  "redirect.link": "Go to the Korean home",
  "notFound.heading": "Page not found",
  "notFound.home": "Back to the home page",
}

export const messages: Record<Locale, Record<MessageKey, string>> = { ko, en }

export function t(locale: Locale, key: MessageKey): string {
  return messages[locale][key]
}
