import { expect, test } from "@playwright/test"

test.describe("Clients Directory (/clients)", () => {
  test("displays Active Policies column with tabular-nums, filters by Client Type, and navigates to overview", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/clients")

    await expect(
      page.getByRole("heading", { name: "Clients", exact: true }),
    ).toBeVisible()

    // Active Policies column header is visible
    await expect(
      page.getByRole("columnheader", { name: "Active Policies" }),
    ).toBeVisible()

    // At least one tabular-nums cell is rendered in the table
    await expect(page.locator("table .tabular-nums").first()).toBeVisible()

    // Client Type filter group is visible
    const filterGroup = page.getByRole("group", { name: "Client Type" })
    await expect(filterGroup).toBeVisible()

    // Filter by Individual
    await filterGroup.getByRole("button", { name: "Individual" }).click()
    const individualRows = page.locator("tbody tr")
    const individualCount = await individualRows.count()
    for (let i = 0; i < individualCount; i++) {
      await expect(individualRows.nth(i)).toContainText("Individual")
    }

    // Filter by Corporate
    await filterGroup.getByRole("button", { name: "Corporate" }).click()
    const corporateRows = page.locator("tbody tr")
    const corporateCount = await corporateRows.count()
    for (let i = 0; i < corporateCount; i++) {
      await expect(corporateRows.nth(i)).toContainText("Corporate")
    }

    // Reset to All
    await filterGroup.getByRole("button", { name: "All" }).click()

    // Zero horizontal overflow at 1440x900
    const desktopOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    )
    expect(desktopOverflow).toBe(true)

    // Clicking a client name navigates to /clients/$clientId/overview
    const firstClientLink = page.locator("tbody tr td a").first()
    await expect(firstClientLink).toBeVisible()
    await firstClientLink.click()
    await expect(page).toHaveURL(/\/clients\/[^/]+\/overview$/)
  })

  test("renders mobile cards with zero horizontal overflow at 390x844", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/clients")

    await expect(
      page.getByRole("heading", { name: "Clients", exact: true }),
    ).toBeVisible()

    // Desktop table is hidden on mobile
    await expect(page.locator("table")).toBeHidden()

    // Mobile cards are rendered with Active Policies count
    await expect(page.getByText("Active Policies:").first()).toBeVisible()

    // Zero horizontal overflow at 390x844
    const mobileOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    )
    expect(mobileOverflow).toBe(true)
  })
})
