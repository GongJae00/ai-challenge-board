import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

import { defaultLocale, localeNames, locales } from "../src/i18n/locales"
import { t } from "../src/i18n/messages"

// Paths carry no leading slash so that they resolve under baseURL's /ai-challenge-board/.

/** Waits until every island has hydrated, so that checks see the page in the viewer's time zone. */
async function hydrated(page: Page) {
  await expect(page.locator("astro-island[ssr]")).toHaveCount(0)
}

test("the root redirects to the Korean home", async ({ page }) => {
  await page.goto("")
  await expect(page).toHaveURL(/\/ai-challenge-board\/ko\/$/)
})

for (const locale of locales) {
  test(`the ${locale} home renders the listings without errors`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text())
    })
    page.on("pageerror", (error) => errors.push(error.message))

    await page.goto(`${locale}/`)
    await hydrated(page)
    await expect(page.locator("html")).toHaveAttribute("lang", locale)
    await expect(
      page.getByRole("heading", { level: 1, name: t(locale, "home.heading") })
    ).toBeVisible()
    await expect(
      page.getByRole("tab", { name: t(locale, "view.table") })
    ).toHaveAttribute("aria-selected", "true")

    // The chosen view stays in the URL, so a return to the page keeps it.
    await page.getByRole("tab", { name: t(locale, "view.calendar") }).click()
    await expect(page).toHaveURL(/\?view=calendar$/)
    await page.reload()
    await hydrated(page)
    await expect(
      page.getByRole("tab", { name: t(locale, "view.calendar") })
    ).toHaveAttribute("aria-selected", "true")

    expect(errors).toEqual([])

    // Nothing pushes the page wider than the screen, such as a row of chips at phone width.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })

  for (const other of locales.filter((l) => l !== locale)) {
    test(`the ${locale} language menu leads to ${other} by keyboard`, async ({
      page,
    }) => {
      await page.goto(`${locale}/`)
      await hydrated(page)
      const menu = page.getByRole("button", { name: t(locale, "nav.language") })
      // The menu must be reachable by keyboard, wherever it sits in the tab order.
      await expect(async () => {
        await page.keyboard.press("Tab")
        await expect(menu).toBeFocused({ timeout: 100 })
      }).toPass({ timeout: 5000 })
      await page.keyboard.press("Enter")
      const item = page.getByRole("menuitem", { name: localeNames[other] })
      await expect(item).toBeVisible()
      await item.focus()
      await page.keyboard.press("Enter")
      await expect(page).toHaveURL(new RegExp(`/${other}/$`))
    })
  }

  test(`the ${locale} search narrows the listings and survives a reload`, async ({
    page,
  }) => {
    await page.goto(`${locale}/`)
    await hydrated(page)
    const rows = page.locator("tbody tr")
    const title = (await rows.first().getByRole("link").textContent()) ?? ""
    const search = page.getByRole("searchbox", {
      name: t(locale, "filter.search"),
    })

    await search.fill(title)
    await expect(page).toHaveURL(/\?q=/)
    // Every row left holds each word searched for, in the title, host, or conference that the row shows.
    const fold = (text: string) => text.normalize("NFKC").toLowerCase()
    await expect(async () => {
      const shown = (await rows.allTextContents()).map(fold)
      expect(shown.length).toBeGreaterThan(0)
      for (const word of fold(title).split(/\s+/).filter(Boolean))
        for (const row of shown) expect(row).toContain(word)
    }).toPass()
    const count = await rows.count()
    await page.reload()
    await hydrated(page)
    await expect(search).toHaveValue(title)
    await expect(rows).toHaveCount(count)
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze()
    expect(results.violations).toEqual([])

    await search.fill("zz no such listing zz")
    await expect(page.getByText(t(locale, "home.noMatch"))).toBeVisible()
    await expect(rows).toHaveCount(0)
    await page.getByRole("button", { name: t(locale, "filter.clear") }).click()
    await expect(search).toHaveValue("")
    await expect(page).toHaveURL(new RegExp(`/${locale}/$`))
  })

  test(`the ${locale} kind chips filter by keyboard`, async ({ page }) => {
    await page.goto(`${locale}/`)
    await hydrated(page)
    const group = page.getByRole("toolbar", { name: t(locale, "filter.kind") })
    // The chips follow the search box in the tab order, with one tab stop for the group. A kind with nothing open
    // has its chip disabled, so the test presses whichever chip the keyboard reaches.
    await page
      .getByRole("searchbox", { name: t(locale, "filter.search") })
      .focus()
    await page.keyboard.press("Tab")
    const chip = group.locator(":focus")
    await expect(chip).toHaveCount(1)
    await page.keyboard.press("Space")
    await expect(chip).toHaveAttribute("aria-pressed", "true")
    await expect(page).toHaveURL(/\?kind=(challenge|cfp)$/)
    await page.keyboard.press("Space")
    await expect(chip).toHaveAttribute("aria-pressed", "false")
    await expect(page).toHaveURL(new RegExp(`/${locale}/$`))
  })

  for (const view of ["table", "calendar"] as const) {
    test(`the ${locale} home's ${view} meets WCAG 2.2 AA`, async ({ page }) => {
      await page.goto(`${locale}/`)
      await hydrated(page)
      await page.getByRole("tab", { name: t(locale, `view.${view}`) }).click()
      if (view === "calendar") {
        // Next month, which is fuller than the rest of this one.
        const next = page.getByRole("button", {
          name: t(locale, "calendar.next"),
        })
        if (await next.isEnabled()) await next.click()
      }
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze()
      expect(results.violations).toEqual([])
    })
  }
}

test("an unknown path shows the site's own 404 page", async ({ page }) => {
  const response = await page.goto("no-such-page/")
  expect(response?.status()).toBe(404)
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: t(defaultLocale, "notFound.heading"),
    })
  ).toBeVisible()
})
