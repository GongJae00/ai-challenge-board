import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

import { defaultLocale, locales, otherLocale } from "../src/i18n/locales"
import { t } from "../src/i18n/messages"

// Paths carry no leading slash so that they resolve under baseURL's /ai-challenge-board/.
test("the root redirects to the Korean home", async ({ page }) => {
  await page.goto("")
  await expect(page).toHaveURL(/\/ai-challenge-board\/ko\/$/)
})

for (const locale of locales) {
  const other = otherLocale(locale)

  test(`the ${locale} home renders and links to ${other}`, async ({ page }) => {
    const errors: string[] = []
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text())
    })
    page.on("pageerror", (error) => errors.push(error.message))

    await page.goto(`${locale}/`)
    await expect(page.locator("html")).toHaveAttribute("lang", locale)
    await expect(
      page.getByRole("heading", { level: 1, name: t(locale, "home.heading") })
    ).toBeVisible()

    // The switcher must be reachable by keyboard, wherever it sits in the tab order.
    const switcher = page.getByRole("link", {
      name: t(locale, "nav.otherLanguage"),
    })
    await expect(async () => {
      await page.keyboard.press("Tab")
      await expect(switcher).toBeFocused({ timeout: 100 })
    }).toPass({ timeout: 5000 })
    await page.keyboard.press("Enter")
    await expect(page).toHaveURL(new RegExp(`/${other}/$`))

    expect(errors).toEqual([])
  })

  test(`the ${locale} home meets WCAG 2.2 AA`, async ({ page }) => {
    await page.goto(`${locale}/`)
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze()
    expect(results.violations).toEqual([])
  })
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
