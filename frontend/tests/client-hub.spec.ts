import { expect, test } from "@playwright/test"

test.describe("Client Hub & Policy Detail (/clients/$clientId/*)", () => {
  async function navigateToFirstClientHub(
    page: import("@playwright/test").Page,
  ) {
    await page.goto("/clients")
    const firstClientLink = page.locator("tbody tr td a").first()
    await expect(firstClientLink).toBeVisible()
    const clientName = (await firstClientLink.textContent()).trim()
    await firstClientLink.click()
    await expect(page).toHaveURL(/\/clients\/[^/]+\/policies$/)
    return { clientName, clientUrl: page.url().replace(/\/policies$/, "") }
  }

  test("zero horizontal overflow at 390x844 mobile and 1440x900 desktop across all Client Hub routes and Policy Detail", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const { clientUrl } = await navigateToFirstClientHub(page)

    const routes = [
      `${clientUrl}/policies`,
      `${clientUrl}/invoices`,
      `${clientUrl}/activity`,
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

  test("Client Hub header, 1-line metadata, underline tabs, /activity, and /documents", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const { clientName, clientUrl } = await navigateToFirstClientHub(page)

    // Back to Clients link
    await expect(
      page.getByRole("link", { name: /Back to Clients/i }),
    ).toBeVisible()

    // Breadcrumbs do not duplicate client name
    const breadcrumbNav = page.getByRole("navigation", { name: "breadcrumb" })
    await expect(breadcrumbNav).toBeVisible()
    const breadcrumbText = await breadcrumbNav.textContent()
    const occurrences = breadcrumbText.split(clientName).length - 1
    expect(occurrences).toBe(1)

    // Underline tabs: Policies | Invoices | Activity | Documents | Settings (no Overview)
    const tablist = page.getByRole("tablist")
    await expect(tablist).toBeVisible()
    await expect(tablist.getByRole("tab", { name: "Policies" })).toBeVisible()
    await expect(tablist.getByRole("tab", { name: "Invoices" })).toBeVisible()
    await expect(tablist.getByRole("tab", { name: "Activity" })).toBeVisible()
    await expect(tablist.getByRole("tab", { name: "Documents" })).toBeVisible()
    await expect(tablist.getByRole("tab", { name: "Settings" })).toBeVisible()
    await expect(tablist.getByRole("tab", { name: "Overview" })).toHaveCount(0)

    // Currency & GLOSSARY invariants: no Ksh/Kshs.
    const bodyText = await page.locator("main").textContent()
    expect(bodyText).not.toMatch(/\bKshs?\.?\b/i)

    // /activity renders Log Operational Activity without KPI or portfolio cards
    await page.goto(`${clientUrl}/activity`)
    await expect(
      page.getByText("Log Operational Activity", { exact: false }),
    ).toBeVisible()
    await expect(page.getByText("Client Policies Portfolio")).toHaveCount(0)
    await expect(page.getByText("Open balance due")).toHaveCount(0)

    // /documents renders KYC & Legal Documents
    await page.goto(`${clientUrl}/documents`)
    await expect(
      page.getByRole("heading", { name: /KYC & Legal Documents/i }),
    ).toBeVisible()
  })

  test("/policies/$policyId renders without stacked double tab bars and provides a working back link", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const { clientName, clientUrl } = await navigateToFirstClientHub(page)

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

  test("/settings renders grouped sections, responsive Danger Zone, zero overflow, and supports update/delete", async ({
    page,
  }) => {
    const uniqueSuffix = Date.now().toString().slice(-6)
    const testName = `Settings Test Client ${uniqueSuffix}`
    const updatedName = `Updated Settings Client ${uniqueSuffix}`
    const kraPin = `A00${uniqueSuffix}Z`.slice(0, 11).padEnd(11, "1")

    // 1. Create a client via AddClient modal (verifies AddClient modal compatibility)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/clients")
    await page.getByRole("button", { name: /Add Client/i }).click()

    await expect(
      page.getByRole("heading", { name: /Identity & Tax/i }),
    ).toBeVisible()
    await expect(
      page.getByRole("heading", { name: /Contact & Address/i }),
    ).toBeVisible()
    await expect(
      page.getByRole("heading", { name: /Key Contacts/i }),
    ).toBeVisible()

    await page.getByPlaceholder("A00...").fill(kraPin)
    await page.getByPlaceholder("Full Name or Company Name").fill(testName)
    await page.getByPlaceholder("07...").fill("0712345678")
    await page.getByRole("button", { name: /Save Client/i }).click()
    await expect(page.getByText("Client Created")).toBeVisible()

    // 2. Navigate to the new client's /settings page
    await page.getByRole("link", { name: testName }).click()
    await expect(page).toHaveURL(/\/clients\/[^/]+\/policies$/)
    const settingsUrl = page.url().replace(/\/policies$/, "/settings")
    await page.goto(settingsUrl)
    await page.waitForLoadState("networkidle")

    // 3. Verify grouped sections & zero overflow on desktop (1440x900)
    await expect(
      page.getByRole("heading", { name: /Identity & Tax/i }),
    ).toBeVisible()
    await expect(
      page.getByRole("heading", { name: /Contact & Address/i }),
    ).toBeVisible()
    await expect(
      page.getByRole("heading", { name: /Key Contacts/i }),
    ).toBeVisible()

    const desktopOk = await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    )
    expect(desktopOk, "Desktop overflow on /settings").toBe(true)

    // 4. Verify responsive Danger Zone & zero overflow on mobile (390x844)
    await page.setViewportSize({ width: 390, height: 844 })
    const mobileOk = await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    )
    expect(mobileOk, "Mobile overflow on /settings").toBe(true)

    const dangerText = page.getByText("Delete Client Account")
    const deleteBtn = page.getByRole("button", { name: /Delete Client/i })
    const textBox = await dangerText.boundingBox()
    const btnBox = await deleteBtn.boundingBox()
    expect(textBox).not.toBeNull()
    expect(btnBox).not.toBeNull()
    expect(btnBox!.y).toBeGreaterThan(textBox!.y)

    // 5. Update client details
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.getByPlaceholder("Full Name or Company Name").fill(updatedName)
    await page.getByRole("button", { name: /Update Client Details/i }).click()
    await expect(page.getByText("Client updated successfully")).toBeVisible()

    // 6. Delete client via Danger Zone
    await page.getByRole("button", { name: /Delete Client/i }).click()
    await page.getByRole("button", { name: /Delete Permanently/i }).click()
    await expect(page.getByText("Client deleted successfully")).toBeVisible()
    await expect(page).toHaveURL(/\/clients$/)
  })
})
