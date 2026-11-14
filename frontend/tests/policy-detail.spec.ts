import { expect, test } from "@playwright/test"

test.describe("Policy Detail (/clients/$clientId/policies/$policyId)", () => {
  async function navigateToFirstPolicyDetail(
    page: import("@playwright/test").Page,
  ) {
    await page.goto("/clients")
    const token = await page.evaluate(() =>
      localStorage.getItem("access_token"),
    )
    const res = await page.request.get(
      "http://localhost:8000/api/v1/policies/?limit=1",
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    )
    expect(res.ok()).toBe(true)
    const body = await res.json()
    const policy = body.data?.[0]
    expect(policy).toBeTruthy()
    await page.goto(`/clients/${policy.client_id}/policies/${policy.id}`)
    await page.waitForLoadState("networkidle")
  }

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    test(`verifies Coverage, History, Activity & Audit Log, and Documents tabs at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      await navigateToFirstPolicyDetail(page)

      // 1. First tab is labeled Coverage, TabsList has data-variant="line", no horizontal overflow
      const tabList = page.getByRole("tablist")
      await expect(tabList).toBeVisible()
      await expect(tabList).toHaveAttribute("data-variant", "line")

      const coverageTab = page.getByRole("tab", { name: "Coverage" })
      await expect(coverageTab).toBeVisible()
      await expect(coverageTab).toHaveAttribute("data-state", "active")

      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      )
      expect(overflow).toBe(false)

      // 2. View Schedule uses outline variant, OFFICIAL POLICY SCHEDULE does not duplicate h1 policy title,
      // and 4 metrics render in one unified Summary Strip
      const viewScheduleBtn = page.getByRole("button", {
        name: /View Schedule/i,
      })
      if (await viewScheduleBtn.isVisible()) {
        await expect(viewScheduleBtn).toHaveClass(/border/)
        await expect(viewScheduleBtn).not.toHaveClass(/bg-primary\b/)
      }

      const h1Title = await page.locator("h1").first().textContent()
      const scheduleStrip = page.getByTestId("policy-schedule-strip")
      if (await scheduleStrip.isVisible()) {
        const stripText = await scheduleStrip.textContent()
        expect(stripText).not.toContain((h1Title ?? "").trim())
      }

      const summaryStrip = page.getByTestId("policy-summary-strip")
      await expect(summaryStrip).toBeVisible()
      await expect(summaryStrip).toHaveClass(/border-border\/80/)
      await expect(summaryStrip).toHaveClass(/bg-card/)
      await expect(summaryStrip).toHaveClass(/shadow-xs/)
      await expect(summaryStrip).toContainText("Sum Insured")
      await expect(summaryStrip).toContainText("Net Premium")
      await expect(summaryStrip).toContainText("Invoice Balance")
      await expect(summaryStrip).toContainText("Policy Expiry")

      // 3. VehicleAssetCard registration plate badge has whitespace-nowrap
      const plateBadge = page.getByTestId("vehicle-plate-badge")
      if (await plateBadge.isVisible()) {
        await expect(plateBadge).toHaveClass(/whitespace-nowrap/)
      }

      // 4. History (Risk Notes) tab renders DataTable directly without outer double-border wrapper
      const historyTab = page.getByRole("tab", { name: /Risk Note Versions/i })
      await historyTab.click()
      await expect(historyTab).toHaveAttribute("data-state", "active")
      await expect(page.getByPlaceholder("Search risk notes...")).toBeVisible()

      // 5. Activity & Audit Log tab
      const auditTab = page.getByRole("tab", { name: /Activity & Audit Log/i })
      await auditTab.click()
      await expect(auditTab).toHaveAttribute("data-state", "active")

      // 6. Documents tab: standard foreground heading & formatted snake_case document types
      const docsTab = page.getByRole("tab", { name: /Documents/i })
      await docsTab.click()
      await expect(docsTab).toHaveAttribute("data-state", "active")

      // Open upload dialog or check preset/label formatting for valuation_report -> Valuation Report
      const uploadBtn = page.getByRole("button", { name: /Upload Document/i })
      if (await uploadBtn.isVisible()) {
        await uploadBtn.click()
        const selectTrigger = page.getByRole("combobox")
        if (await selectTrigger.isVisible()) {
          await selectTrigger.click()
          await expect(
            page.getByRole("option", { name: "Valuation Report" }),
          ).toBeVisible()
          await page.keyboard.press("Escape")
        }
        await page.keyboard.press("Escape")
      }
    })
  }
})
