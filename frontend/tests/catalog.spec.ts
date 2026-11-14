import { expect, test } from "@playwright/test"

test.describe("Catalog (/catalog)", () => {
  test("renders unified Catalog header, Insurers table without ID column, and navigates to insurer detail", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/catalog/insurers")

    await expect(
      page.getByRole("heading", { name: "Catalog", exact: true }),
    ).toBeVisible()

    // Zero occurrences of "Carrier"
    await expect(page.locator("body")).not.toContainText("Carrier")

    // Active tab CTA for Insurers
    await expect(
      page.getByRole("button", { name: /Add Insurer/i }),
    ).toBeVisible()

    // No raw UUID ID column header
    await expect(
      page.getByRole("columnheader", { name: "ID", exact: true }),
    ).toHaveCount(0)

    // Zero horizontal overflow at 1440x900
    const desktopOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    )
    expect(desktopOverflow).toBe(true)

    // Clicking an Insurer name navigates to /catalog/insurers/$insurerId
    const firstInsurerLink = page.locator("tbody tr td a").first()
    await expect(firstInsurerLink).toBeVisible()
    await firstInsurerLink.click()
    await expect(page).toHaveURL(/\/catalog\/insurers\/[^/]+$/)
  })

  test("renders Products table with Insurer column, tabular-nums on Comm. %, no ID column, and navigates to product detail", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/catalog/products")

    await expect(
      page.getByRole("heading", { name: "Catalog", exact: true }),
    ).toBeVisible()

    // Zero occurrences of "Carrier"
    await expect(page.locator("body")).not.toContainText("Carrier")

    // Active tab CTA for Products
    await expect(
      page.getByRole("button", { name: /Add Product/i }),
    ).toBeVisible()

    // No raw UUID ID column header
    await expect(
      page.getByRole("columnheader", { name: "ID", exact: true }),
    ).toHaveCount(0)

    // Insurer column header is visible
    await expect(
      page.getByRole("columnheader", { name: "Insurer", exact: true }),
    ).toBeVisible()

    // tabular-nums on Comm. % cell
    await expect(page.locator("table .tabular-nums").first()).toBeVisible()

    // Zero horizontal overflow at 1440x900
    const desktopOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    )
    expect(desktopOverflow).toBe(true)

    // Clicking a Product name navigates to /catalog/products/$productId
    const firstProductLink = page.locator("tbody tr td a").first()
    await expect(firstProductLink).toBeVisible()
    await firstProductLink.click()
    await expect(page).toHaveURL(/\/catalog\/products\/[^/]+$/)
  })

  test("renders mobile cards with zero horizontal overflow at 390x844", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })

    await page.goto("/catalog/insurers")
    await expect(
      page.getByRole("heading", { name: "Catalog", exact: true }),
    ).toBeVisible()
    await expect(page.locator("table")).toBeHidden()
    const insurersMobileOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    )
    expect(insurersMobileOverflow).toBe(true)

    await page.goto("/catalog/products")
    await expect(
      page.getByRole("heading", { name: "Catalog", exact: true }),
    ).toBeVisible()
    await expect(page.locator("table")).toBeHidden()
    const productsMobileOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    )
    expect(productsMobileOverflow).toBe(true)
  })

  test("suppresses parent Catalog chrome on detail routes, omits Insurer column on InsurerDetail, and has zero overflow on desktop and mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/catalog/insurers")
    await page.locator("tbody tr td a").first().click()
    await expect(page).toHaveURL(/\/catalog\/insurers\/[^/]+$/)

    // Parent Catalog chrome is suppressed
    await expect(page.getByText("Catalog", { exact: true })).toHaveCount(0)
    await expect(page.getByRole("tab", { name: "Insurers" })).toHaveCount(0)
    await expect(page.getByRole("tab", { name: "Products" })).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: /Add Insurer/i }),
    ).toHaveCount(0)

    // Back to Insurers leads cleanly
    await expect(
      page.getByRole("link", { name: /Back to Insurers/i }),
    ).toBeVisible()

    // Insurance Products table omits redundant Insurer column
    await expect(
      page.getByRole("columnheader", { name: "Insurer", exact: true }),
    ).toHaveCount(0)

    // Zero horizontal overflow at 1440x900 desktop
    const insurerDesktopOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    )
    expect(insurerDesktopOverflow).toBe(true)

    // Zero horizontal overflow at 390x844 mobile
    await page.setViewportSize({ width: 390, height: 844 })
    const insurerMobileOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    )
    expect(insurerMobileOverflow).toBe(true)
  })

  test("Product Detail uses bg-card in dark mode, displays Insurer name, single Save CTA, and has zero overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/catalog/products")

    const firstProductLink = page.locator("tbody tr td a").first()
    await expect(firstProductLink).toBeVisible()
    await firstProductLink.click()
    await expect(page).toHaveURL(/\/catalog\/products\/[^/]+$/)

    // Enable dark mode
    await page.evaluate(() => {
      document.documentElement.classList.add("dark")
    })

    // General Settings container uses bg-card, not hardcoded bg-white
    const generalSettingsForm = page.locator("form").first()
    await expect(generalSettingsForm).toBeVisible()
    const hasBgWhite = await page.locator(".bg-white").count()
    expect(hasBgWhite).toBe(0)

    // Single Save Changes CTA (no duplicate Save Product button)
    await expect(
      page.getByRole("button", { name: "Save Changes" }),
    ).toHaveCount(1)
    await expect(
      page.getByRole("button", { name: "Save Product" }),
    ).toHaveCount(0)

    // Insurer field displays a name rather than a raw UUID
    const insurerTrigger = page
      .locator('[data-slot="select-trigger"]')
      .first()
    const insurerText = (await insurerTrigger.textContent())?.trim() || ""
    expect(insurerText).not.toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )

    // Zero horizontal overflow at 1440x900 desktop
    const desktopOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    )
    expect(desktopOverflow).toBe(true)

    // Zero horizontal overflow at 390x844 mobile
    await page.setViewportSize({ width: 390, height: 844 })
    const mobileOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    )
    expect(mobileOverflow).toBe(true)

    // Product detail route also suppresses parent Catalog chrome
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/catalog/products")
    await page.locator("tbody tr td a").first().click()
    await expect(page).toHaveURL(/\/catalog\/products\/[^/]+$/)

    await expect(page.getByText("Catalog", { exact: true })).toHaveCount(0)
    await expect(page.getByRole("tab", { name: "Insurers" })).toHaveCount(0)
    await expect(page.getByRole("tab", { name: "Products" })).toHaveCount(0)
    await expect(
      page.getByRole("link", { name: /Back to Products/i }),
    ).toBeVisible()
  })
})
