import { expect, test } from "@playwright/test"

const HUBS = [
  { name: "Catalog", path: "/catalog/insurers" },
  { name: "Settings", path: "/settings" },
  { name: "Financials", path: "/financials" },
  { name: "Renewals", path: "/renewals" },
] as const

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const

test.describe("Underline Tabs Standardization (#189)", () => {
  for (const hub of HUBS) {
    for (const viewport of VIEWPORTS) {
      test(`${hub.name} (${hub.path}) uses data-variant="line" with zero horizontal overflow at ${viewport.width}x${viewport.height}`, async ({
        page,
      }) => {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        })
        await page.goto(hub.path)

        const tabsList = page.locator('[data-slot="tabs-list"]').first()
        await expect(tabsList).toBeVisible()
        await expect(tabsList).toHaveAttribute("data-variant", "line")

        const hasHorizontalOverflow = await page.evaluate(() => {
          return (
            document.documentElement.scrollWidth >
            document.documentElement.clientWidth
          )
        })
        expect(hasHorizontalOverflow).toBe(false)
      })
    }
  }
})
