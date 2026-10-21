import { CheckIcon, ChevronDownIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Locale } from "@/i18n/locales"

interface Props {
  current: Locale
  /** The menu's accessible name, such as "언어". */
  label: string
  options: { locale: Locale; name: string; href: string }[]
}

/** The language menu: the trigger names the current language, and each item links to that language's page. */
export default function LanguageMenu({ current, label, options }: Props) {
  const currentName = options.find((o) => o.locale === current)?.name
  return (
    <DropdownMenu>
      {/* The accessible name, "언어 한국어", keeps the visible language name in it. */}
      <DropdownMenuTrigger render={<Button variant="ghost" />}>
        <span className="sr-only">{label}</span>
        {currentName}
        <ChevronDownIcon aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto">
        {options.map((option) => (
          <DropdownMenuLinkItem
            key={option.locale}
            href={option.href}
            hrefLang={option.locale}
            lang={option.locale}
            aria-current={option.locale === current ? "page" : undefined}
            className="justify-between gap-6"
          >
            {option.name}
            {option.locale === current && <CheckIcon aria-hidden="true" />}
          </DropdownMenuLinkItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
