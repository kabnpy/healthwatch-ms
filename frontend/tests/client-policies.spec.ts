import { expect, test } from "@playwright/test"

test.describe("Client Policies Tab (/clients/$clientId/policies)", () => {
  async function navigateToFirstClientPolicies(
    page: import("@playwright/test").Page,
  ) {
    await page.goto("/clients")
    const firstClientLink = page.locator("tbody tr td a").first()
    await expect(firstClientLink).toBeVisible()
    await firstClientLink.click()
    await expect(page).toHaveURL(/\/clients\/[^/]+\/overview$/)
    const clientUrl = page.url().replace(/\/overview$/, "")
    await page.goto(`${clientUrl}/policies`)
    await page.waitForLoadState("networkidle")
    return clientUrl
  }

  test("renders DataTable only (no Cards/Table toggle), status filter All | Active | Historical, and + New Policy", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await navigateToFirstClientPolicies(page)

    // Cards View / Table View toggle must be absent
    await expect(page.getByRole("button", { name: "Cards View" })).toHaveCount(
      0,
    )
    await expect(page.getByRole("button", { name: "Table View" })).toHaveCount(
      0,
    )

    // + New Policy primary CTA is visible
    await expect(
      page.getByRole("button", { name: /New Policy/i }),
    ).toBeVisible()

    // DataTable is rendered
    await expect(page.locator("table")).toBeVisible()

    // Status filter buttons: All | Active | Historical
    const allBtn = page.getByRole("button", { name: /^All/i })
    const activeBtn = page.getByRole("button", { name: /^Active/i })
    const historicalBtn = page.getByRole("button", { name: /^Historical/i })

    await expect(allBtn).toBeVisible()
    await expect(activeBtn).toBeVisible()
    await expect(historicalBtn).toBeVisible()

    const allRows = await page.locator("tbody tr").count()
    expect(allRows).toBeGreaterThan(0)

    // Filter by Active
    await activeBtn.click()
    const activeRows = await page.locator("tbody tr").count()
    expect(activeRows).toBeLessThanOrEqual(allRows)

    // Filter by Historical
    await historicalBtn.click()
    const historicalRows = await page.locator("tbody tr").count()
    expect(historicalRows).toBeLessThanOrEqual(allRows)

    // Filter back to All
    await allBtn.click()
    await expect(page.locator("tbody tr")).toHaveCount(allRows)
  })

  test("shows Incept First Policy empty state when client has no policies", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    // Intercept policies API to return empty list
    await page.route("**/api/v1/policies/**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: [], count: 0 }),
        })
      } else {
        await route.continue()
      }
    })

    await navigateToFirstClientPolicies(page)

    await expect(
      page.getByRole("button", { name: "Incept First Policy" }),
    ).toBeVisible()
  })

  test("zero horizontal overflow on desktop (1440x900) and mobile (390x844)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await navigateToFirstClientPolicies(page)

    const desktopOk = await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    )
    expect(desktopOk, "Desktop horizontal overflow on /policies").toBe(true)

    await page.setViewportSize({ width: 390, height: 844 })
    const mobileOk = await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    )
    expect(mobileOk, "Mobile horizontal overflow on /policies").toBe(true)
  })
})
