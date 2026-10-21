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
