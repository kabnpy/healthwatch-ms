import { expect, test } from "@playwright/test"

test.describe("Phase 1: Identity & Layout Foundation", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000)
    await page.goto("/")
  })

  test("Sidebar is present and has correct items", async ({ page }) => {
    const sidebar = page.locator('[data-sidebar="sidebar"]')
    await expect(sidebar).toBeVisible()
    await expect(sidebar.getByText("Dashboard")).toBeVisible()
    await expect(sidebar.getByText("Clients")).toBeVisible()
    await expect(sidebar.getByText("Policies")).toBeVisible()
  })

  test("Breadcrumbs are present in the header", async ({ page }) => {
    const header = page.locator("header")
    await expect(header).toBeVisible()
    const breadcrumbs = header.locator("nav").filter({ hasText: "Home" })
    await expect(breadcrumbs).toBeVisible()
  })

  test("Layered navigation works (Home -> Clients)", async ({ page }) => {
    await page.goto("/clients")
    await expect(
      page.getByRole("heading", { name: "Clients", exact: true }),
    ).toBeVisible()

    const breadcrumbs = page.locator("header nav")
    await expect(breadcrumbs.getByText("Home")).toBeVisible()
    await expect(breadcrumbs.getByText("Clients")).toBeVisible()
  })

  test("Client page has correct breadcrumbs", async ({ page }) => {
    await page.goto("/clients")

    // Wait for table to load
    await page.waitForSelector("table")

    // Click on the first client in the table
    // The name is a link that goes to /policies
    const firstClientLink = page
      .locator("table tbody tr")
      .first()
      .getByRole("link")
      .first()
    const clientName = await firstClientLink.textContent()
    await firstClientLink.click()

    // Verify breadcrumbs: Home / Clients / [Client Name]
    const breadcrumbs = page.locator("header nav")
    await expect(breadcrumbs.getByText("Home")).toBeVisible()
    await expect(breadcrumbs.getByText("Clients")).toBeVisible()

    // The client name should be in the breadcrumbs
    await expect(breadcrumbs.getByText(clientName.trim())).toBeVisible()
  })

  test("Policy page has correct layout and header", async ({ page }) => {
    await page.goto("/clients")
    await page.waitForSelector("table")

    // Click on the first client link (goes to Policies tab)
    await page
      .locator("table tbody tr")
      .first()
      .getByRole("link")
      .first()
      .click()

    await page.waitForURL(/\/clients\/[^/]+\/policies/)

    // Click on the View Policy link for the first policy card
    const digitalFileLink = page
      .getByRole("link", { name: /View Policy|Digital File/i })
      .first()
    if (await digitalFileLink.isVisible()) {
      await digitalFileLink.click()
      await page.waitForURL(/\/clients\/[^/]+\/policies\/[^/]+/)

      // Verify PolicyHeader
      await expect(page.getByRole("button", { name: "Renew" })).toBeVisible()
      await expect(page.getByRole("button", { name: "Endorse" })).toBeVisible()

      // Verify Breadcrumbs: Home / [Policy]
      const breadcrumbs = page.locator("header nav")
      await expect(breadcrumbs.getByText("Home")).toBeVisible()
    }
  })
})
