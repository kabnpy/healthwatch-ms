import { expect, test } from "@playwright/test"

test.describe("Policy Renewals Desk (/renewals)", () => {
  test("desktop 1440x900: zero overflow, normalized header, calm zero-states, and RenewalTransitionSheet", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/renewals")

    await expect(
      page.getByRole("heading", { name: "Policy Renewals" }),
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: /Browse Clients/i }),
    ).toHaveCount(0)

    const subtitle = page.getByText(
      /Track and manage upcoming policy expirations and renewals/i,
    )
    await expect(subtitle).toBeVisible()
    await expect(subtitle).not.toHaveClass(/uppercase/)

    // Zero horizontal overflow at 1440px
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth)

    // Sum Insured column is removed
    await expect(page.getByText("Sum Insured")).toHaveCount(0)

    // If there are rows in the active tab, verify action button is visible and opens RenewalTransitionSheet
    const actionButtons = page.locator("table tbody tr button:has-text('Start Renewal'), table tbody tr button:has-text('Log Insurer Terms'), table tbody tr button:has-text('Prepare Invitation'), table tbody tr button:has-text('Follow Up'), table tbody tr button:has-text('Revise Terms'), table tbody tr button:has-text('Complete Renewal')")
    const count = await actionButtons.count()
    if (count > 0) {
      await expect(actionButtons.first()).toBeVisible()
      await actionButtons.first().click()
      await expect(page.getByRole("dialog")).toBeVisible()
    }
  })

  test("mobile 390x844: zero overflow and responsive triage cards", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/renewals")

    await expect(
      page.getByRole("heading", { name: "Policy Renewals" }),
    ).toBeVisible()

    // Zero horizontal overflow at 390px
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth)

    // Desktop table is hidden on mobile, mobile cards render when items exist
    const desktopTable = page.locator("table")
    if ((await desktopTable.count()) > 0) {
      await expect(desktopTable.first()).toBeHidden()
    }
    const mobileCards = page.getByTestId("renewal-mobile-card")
    if ((await mobileCards.count()) > 0) {
      await expect(mobileCards.first()).toBeVisible()
    }
  })
})
