import { expect, test } from "@playwright/test"

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const

const COLOR_SCHEMES = ["light", "dark"] as const

test.describe("App Shell (dashboard-01 alignment #190)", () => {
  for (const scheme of COLOR_SCHEMES) {
    for (const viewport of VIEWPORTS) {
      test(`renders inset sidebar, right-aligned CommandMenu, no AgencyStatusBadge, and zero horizontal overflow in ${scheme} mode at ${viewport.width}x${viewport.height}`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme: scheme })
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        })
        await page.goto("/")

        // Verify zero horizontal overflow
        const hasHorizontalOverflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth
        })
        expect(hasHorizontalOverflow).toBe(false)

        // Verify no AgencyStatusBadge
        await expect(
          page.locator('[data-testid="agency-status-badge"]'),
        ).toHaveCount(0)
        await expect(page.getByText(/Operational/i)).toHaveCount(0)

        // Verify inset sidebar on desktop
        if (viewport.name === "desktop") {
          const insetSidebar = page.locator('[data-variant="inset"]')
          await expect(insetSidebar).toBeVisible()
        }

        // Verify right-aligned CommandMenu in header
        const header = page.locator("header")
        await expect(header).toBeVisible()
        const commandMenuButton = header
          .locator("button")
          .filter({ hasText: /Search/i })
          .first()
        await expect(commandMenuButton).toBeVisible()

        const box = await commandMenuButton.boundingBox()
        expect(box).not.toBeNull()
        if (box) {
          // Right-aligned: its center should be in the right half of the viewport
          expect(box.x + box.width / 2).toBeGreaterThan(viewport.width / 2)
        }
      })
    }
  }
})
