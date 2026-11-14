import { expect, test } from "@playwright/test"

test.describe("Client Hub & Policy Detail (/clients/$clientId/*)", () => {
  async function navigateToFirstClientOverview(
    page: import("@playwright/test").Page,
  ) {
    await page.goto("/clients")
    const firstClientLink = page.locator("tbody tr td a").first()
    await expect(firstClientLink).toBeVisible()
    const clientName = (await firstClientLink.textContent()).trim()
    await firstClientLink.click()
    await expect(page).toHaveURL(/\/clients\/[^/]+\/overview$/)
    return { clientName, clientUrl: page.url().replace(/\/overview$/, "") }
  }

  test("zero horizontal overflow at 390x844 mobile and 1440x900 desktop across all Client Hub routes and Policy Detail", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const { clientUrl } = await navigateToFirstClientOverview(page)

    const routes = [
      `${clientUrl}/overview`,
      `${clientUrl}/policies`,
      `${clientUrl}/invoices`,
      `${clientUrl}/documents`,
    ]

    for (const url of routes) {
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto(url)
      await page.waitForLoadState("networkidle")
      const desktopOk = await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      )
      expect(desktopOk, `Desktop overflow on ${url}`).toBe(true)

      await page.setViewportSize({ width: 390, height: 844 })
      const mobileOk = await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      )
      expect(mobileOk, `Mobile overflow on ${url}`).toBe(true)
    }

    // Navigate to first policy detail from /policies
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${clientUrl}/policies`)
    const policyLink = page.locator("a[href*='/policies/']").first()
    if ((await policyLink.count()) > 0) {
      await policyLink.click()
      await expect(page).toHaveURL(/\/clients\/[^/]+\/policies\/[^/]+$/)
      await page.waitForLoadState("networkidle")

      const desktopPolicyOk = await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      )
      expect(desktopPolicyOk, "Desktop overflow on Policy Detail").toBe(true)

      await page.setViewportSize({ width: 390, height: 844 })
      const mobilePolicyOk = await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      )
      expect(mobilePolicyOk, "Mobile overflow on Policy Detail").toBe(true)
    }
  })

  test("/overview breadcrumbs do not duplicate the client name and use KES/GLOSSARY copy", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const { clientName } = await navigateToFirstClientOverview(page)

    const breadcrumbNav = page.getByRole("navigation", { name: "breadcrumb" })
    await expect(breadcrumbNav).toBeVisible()
    const breadcrumbText = await breadcrumbNav.textContent()
    const occurrences = breadcrumbText.split(clientName).length - 1
    expect(occurrences).toBe(1)

    // Currency & GLOSSARY invariants: no Ksh/Kshs.
    const bodyText = await page.locator("main").textContent()
    expect(bodyText).not.toMatch(/\bKshs?\.?\b/i)
  })

  test("/policies/$policyId renders without stacked double tab bars and provides a working back link", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const { clientName, clientUrl } = await navigateToFirstClientOverview(page)

    await page.goto(`${clientUrl}/policies`)
    const policyLink = page.locator("a[href*='/policies/']").first()
    test.skip((await policyLink.count()) === 0, "No policies for first client")

    await policyLink.click()
    await expect(page).toHaveURL(/\/clients\/[^/]+\/policies\/[^/]+$/)

    // Only 1 tablist (Policy Detail's 4 tabs), not 2 stacked tablists
    await expect(page.getByRole("tablist")).toHaveCount(1)

    // Compact back link to client's policies
    const backLink = page.getByRole("link", {
      name: new RegExp(`Back to ${clientName} Policies`, "i"),
    })
    await expect(backLink).toBeVisible()
    await backLink.click()
    await expect(page).toHaveURL(new RegExp(`${clientUrl}/policies$`))
  })

  test("Issue #186: Back to Clients bar, underline tabs, compact Overview summary strip, and Documents heading at 1440x900 and 390x844", async ({
    page,
  }) => {
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport)
      const { clientUrl } = await navigateToFirstClientOverview(page)

      // 1. Back to Clients link bar above hub header
      const backToClients = page.getByRole("link", { name: /Back to Clients/i })
      await expect(backToClients).toBeVisible()

      // 2. Underline tabs (data-variant="line")
      const tabList = page.locator('[role="tablist"][data-variant="line"]')
      await expect(tabList).toBeVisible()

      // 3. Overview omits duplicate Client Type badge and View All Policies / View Ledger buttons
      await expect(page.getByText(/View All Policies/i)).toHaveCount(0)
      await expect(page.getByText(/View Ledger/i)).toHaveCount(0)
      await expect(page.getByText(/^(Corporate|Individual) Client$/i)).toHaveCount(0)

      // 4. Unified 4-metric Summary Strip with formatCurrency(...) KES formatting
      const summaryStrip = page.getByTestId("overview-summary-strip")
      await expect(summaryStrip).toBeVisible()
      await expect(summaryStrip.getByText("Policies In Force")).toBeVisible()
      await expect(summaryStrip.getByText("Outstanding Balance")).toBeVisible()
      await expect(summaryStrip.getByText("Invoiced Premium")).toBeVisible()
      await expect(summaryStrip.getByText("Cleared Collections")).toBeVisible()

      const stripText = (await summaryStrip.textContent()) ?? ""
      expect(stripText).toMatch(/KES\s+[\d,]+\.\d{2}/)
      expect(stripText).not.toMatch(/\bKshs?\.?\b/i)

      // 5. Documents heading uses standard foreground color (not text-primary)
      await page.goto(`${clientUrl}/documents`)
      const docsHeading = page.getByRole("heading", {
        name: "KYC & Legal Documents",
      })
      await expect(docsHeading).toBeVisible()
      await expect(docsHeading).not.toHaveClass(/text-primary/)
    }
  })
})
