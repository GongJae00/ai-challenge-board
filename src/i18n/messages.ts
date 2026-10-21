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
  "home.summaryFiltered": "마감 전 {total}건 중 {count}건",
  "home.noMatch": "조건에 맞는 챌린지나 논문 모집이 없습니다.",
  "filter.search": "검색",
  "filter.searchPlaceholder": "제목이나 주최로 검색",
  "filter.kind": "형식",
  "filter.conference": "학회",
  "filter.platform": "플랫폼",
  "filter.clear": "필터 지우기",
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
  "deadline.entry": "참가 신청 마감",
  "deadline.merger": "팀 병합 마감",
  "calendar.previous": "이전 달",
  "calendar.next": "다음 달",
  "calendar.zone": "날짜와 시간은 한국 시간(KST) 기준입니다.",
  "calendar.count": "{count}건",
  "calendar.list": "{month}의 마감",
  "footer.heading": "수집 출처",
  "footer.conferences": "학회",
  "footer.abroad": "해외",
  "footer.korea": "국내",
  "footer.updates": "갱신",
  "footer.schedule": "하루 두 번, 오전 9시와 오후 9시 무렵 (KST)",
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
  "home.summaryFiltered": "{count} of {total} upcoming",
  "home.noMatch": "No challenges or paper calls match these filters.",
  "filter.search": "Search",
  "filter.searchPlaceholder": "Search titles and hosts",
  "filter.kind": "Type",
  "filter.conference": "Conference",
  "filter.platform": "Platform",
  "filter.clear": "Clear filters",
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
  "deadline.entry": "Entry deadline",
  "deadline.merger": "Team merger deadline",
  "calendar.previous": "Previous month",
  "calendar.next": "Next month",
  "calendar.zone": "Dates and times are in Korean time (KST).",
  "calendar.count": "{count} due",
  "calendar.list": "Deadlines in {month}",
  "footer.heading": "Sources",
  "footer.conferences": "Conferences",
  "footer.abroad": "International",
  "footer.korea": "Korea",
  "footer.updates": "Updated",
  "footer.schedule": "Twice a day, around 9:00 and 21:00 KST",
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
