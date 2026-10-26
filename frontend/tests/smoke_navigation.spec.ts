import { test } from "@playwright/test"
import { setupRouteAuditor } from "./utils/routeAuditor"

test.describe("Smoke: Application Navigation & Route Health", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000)
    await page.goto("/")
  })

  const routes = [
    {
      name: "Dashboard",
      path: "/",
      heading: /Agency Command Deck|Dashboard|HealthWatch/i,
    },
    { name: "Clients Hub", path: "/clients", heading: /Clients/i },
    { name: "Policies Hub", path: "/policies", heading: /Policies Hub/i },
    { name: "Renewals Desk", path: "/renewals", heading: /Renewals Desk/i },
    { name: "Financials Ledger", path: "/financials", heading: /Financials/i },
    {
      name: "Catalog Products",
      path: "/catalog/products",
      heading: /Catalog|Products/i,
    },
    {
      name: "Catalog Insurers",
      path: "/catalog/insurers",
      heading: /Insurance Carriers|Insurers|Catalog/i,
    },
    { name: "Admin Users", path: "/admin", heading: /Users/i },
    { name: "User Settings", path: "/settings", heading: /User Settings/i },
  ]

  for (const r of routes) {
    test(`Navigate to ${r.name} (${r.path}) without errors`, async ({
      page,
    }) => {
      const auditor = setupRouteAuditor(page)

      await page.goto(r.path)
      await page.waitForLoadState("networkidle")

      await auditor.assertCleanNavigation(r.heading)
    })
  }

  test("Sidebar clicks navigate cleanly across top-level views", async ({
    page,
  }) => {
    const auditor = setupRouteAuditor(page)

    // Clients
    await page.getByRole("link", { name: "Clients" }).first().click()
    await page.waitForURL(/\/clients/)
    await auditor.assertCleanNavigation(/Clients/i)

    // Policies
    await page.getByRole("link", { name: "Policies" }).first().click()
    await page.waitForURL(/\/policies/)
    await auditor.assertCleanNavigation(/Policies Hub/i)

    // Renewals
    await page.getByRole("link", { name: "Renewals" }).first().click()
    await page.waitForURL(/\/renewals/)
    await auditor.assertCleanNavigation(/Renewals Desk/i)

    // Financials
    await page.getByRole("link", { name: "Financials" }).first().click()
    await page.waitForURL(/\/financials/)
    await auditor.assertCleanNavigation(/Financials/i)
  })
})
