import type { Locale } from "./locales"

// Every user-facing string lives here, keyed the same way in each language. `{name}` marks a value filled in
// by `t`.
const ko = {
  "site.name": "AI Challenge Board",
  "site.description":
    "AI 챌린지, 대회, 워크숍 논문 모집의 마감일을 한곳에서 확인합니다.",
  "nav.language": "언어",
  "home.heading": "AI 챌린지와 논문 모집",
  "home.summary": "마감 전 {count}건",
  "home.empty": "지금 모집 중인 챌린지나 논문 모집이 없습니다.",
  "view.table": "표",
  "view.calendar": "캘린더",
  "table.start": "시작일",
  "table.deadline": "마감일 (KST)",
  "table.host": "주최",
  "table.title": "제목",
  "table.kind": "형식",
  "listing.kind.cfp": "논문 모집",
  "listing.kind.challenge": "챌린지",
  "deadline.phase": "{name} 마감",
  "deadline.phaseUnnamed": "단계 마감",
  "deadline.end": "대회 종료",
  "calendar.previous": "이전 달",
  "calendar.next": "다음 달",
  "calendar.zone": "날짜와 시간은 한국 시간(KST) 기준입니다.",
  "calendar.count": "{count}건",
  "calendar.list": "{month}의 마감",
  "redirect.link": "한국어 홈으로 이동",
  "notFound.heading": "페이지를 찾을 수 없습니다",
  "notFound.home": "홈으로 돌아가기",
}

export type MessageKey = keyof typeof ko

const en: Record<MessageKey, string> = {
  "site.name": "AI Challenge Board",
  "site.description":
    "Deadlines for AI challenges, competitions, and workshop paper calls in one place.",
  "nav.language": "Language",
  "home.heading": "AI challenges and paper calls",
  "home.summary": "{count} upcoming",
  "home.empty": "No challenges or paper calls are open right now.",
  "view.table": "Table",
  "view.calendar": "Calendar",
  "table.start": "Opens",
  "table.deadline": "Deadline (KST)",
  "table.host": "Host",
  "table.title": "Title",
  "table.kind": "Type",
  "listing.kind.cfp": "Paper call",
  "listing.kind.challenge": "Challenge",
  "deadline.phase": "{name} ends",
  "deadline.phaseUnnamed": "Phase ends",
  "deadline.end": "Challenge ends",
  "calendar.previous": "Previous month",
  "calendar.next": "Next month",
  "calendar.zone": "Dates and times are in Korean time (KST).",
  "calendar.count": "{count} due",
  "calendar.list": "Deadlines in {month}",
  "redirect.link": "Go to the Korean home",
  "notFound.heading": "Page not found",
  "notFound.home": "Back to the home page",
}

export const messages: Record<Locale, Record<MessageKey, string>> = { ko, en }

export function t(
  locale: Locale,
  key: MessageKey,
  values: Record<string, string | number> = {}
): string {
  return messages[locale][key].replace(/\{(\w+)\}/g, (placeholder, name) =>
    name in values ? String(values[name]) : placeholder
  )
}
