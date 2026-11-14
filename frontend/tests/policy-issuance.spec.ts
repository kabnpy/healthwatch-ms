import { expect, test } from "@playwright/test"

test.describe("Policy Issuance E2E", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000)
    await page.goto("/")
  })

  test("Issue a Motor Private policy and verify authoritative data", async ({
    page,
  }) => {
    test.setTimeout(90000)

    // 1. Go to clients
    await page.goto("/clients")
    await page.waitForSelector("table")

    // 2. Select first client
    const clientLink = page
      .locator('table tbody tr a[href*="/clients/"]')
      .first()
    await clientLink.click()
    await page.waitForURL(/\/clients\/.+/)

    // 3. Open New Policy Wizard
    const newPolicyButton = page.getByRole("button", { name: /New Policy/i })
    await newPolicyButton.click()

    const modal = page.getByRole("dialog")
    await expect(modal).toBeVisible()

    // 4. Select Product (Step 1)
    // Dropdown should only have Motor Private
    const productSelect = modal.getByRole("combobox")
    await productSelect.click()

    // Verify only Motor Private is available
    const options = page.getByRole("option")
    const optionTexts = await options.allInnerTexts()
    for (const text of optionTexts) {
      expect(text.toLowerCase()).toContain("motor private")
    }

    const testPolicyNum = `POL-TEST-${Date.now()}`
    await options.first().click()
    await modal.getByLabel(/Policy Number/i).fill(testPolicyNum)
    await modal.getByRole("button", { name: /Next: Asset Details/i }).click()

    // 5. Enter Asset Details (Step 2: Asset)
    await modal.getByLabel(/Registration number/i).fill("KCM 123X")
    await modal.getByLabel(/Make/i).fill("Toyota Prado")
    await modal.getByLabel(/Year of manufacture/i).fill("2020")
    await modal.getByRole("button", { name: /Next: Financials/i }).click()

    // 6. Step 3: Financials
    await modal.getByLabel(/Sum Insured/i).fill("5000000")
    await modal.getByRole("button", { name: /Next: Review & Issue/i }).click()

    // 7. Step 4: Review & Issue Policy
    await expect(modal.getByText(testPolicyNum)).toBeVisible()
    await modal.getByRole("button", { name: /Issue Policy/i }).click()

    // Success toast
    await expect(page.getByText(/Policy Issued/i)).toBeVisible()
  })

  test("NewPolicyWizard uses Insurer copy, fits desktop/mobile widths, and supports Step 4 Change links", async ({
    page,
  }) => {
    test.setTimeout(90000)

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/clients")
    await page.waitForSelector("table")

    const clientLink = page
      .locator('table tbody tr a[href*="/clients/"]')
      .first()
    await clientLink.click()
    await page.waitForURL(/\/clients\/.+/)

    await page.getByRole("button", { name: /New Policy/i }).click()
    const modal = page.getByRole("dialog")
    await expect(modal).toBeVisible()

    // 1. Desktop width >= 640px
    const desktopBox = await modal.boundingBox()
    expect(desktopBox).not.toBeNull()
    expect(desktopBox!.width).toBeGreaterThanOrEqual(640)

    // 2. Insurer copy (no "insurance company")
    await expect(modal).toContainText(/insurer/i)
    await expect(modal).not.toContainText(/insurance company/i)

    // 3. Mobile width <= 390px with zero horizontal overflow
    await page.setViewportSize({ width: 390, height: 844 })
    const mobileBox = await modal.boundingBox()
    expect(mobileBox).not.toBeNull()
    expect(mobileBox!.width).toBeLessThanOrEqual(390)
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
    expect(hasOverflow).toBe(false)

    // Reset to desktop for wizard navigation
    await page.setViewportSize({ width: 1440, height: 900 })

    // Complete Step 1 (Identity)
    await modal.getByRole("combobox").click()
    await page.getByRole("option").first().click()
    const testPolicyNum = `POL-UX-${Date.now()}`
    await modal.getByLabel(/Policy Number/i).fill(testPolicyNum)
    await modal.getByRole("button", { name: /Next: Asset Details/i }).click()

    // Complete Step 2 (Asset)
    await modal.getByLabel(/Registration number/i).fill("KCM 999Z")
    await modal.getByLabel(/Make/i).fill("Subaru Forester")
    await modal.getByLabel(/Year of manufacture/i).fill("2021")
    await modal.getByRole("button", { name: /Next: Financials/i }).click()

    // Complete Step 3 (Financials)
    await modal.getByLabel(/Sum Insured/i).fill("3500000")
    await modal.getByRole("button", { name: /Next: Review & Issue/i }).click()

    // 4. Step 4 (Review): Change links jump directly to Identity, Asset, Financials
    await modal.getByRole("button", { name: /Change.*Identity/i }).click()
    await expect(
      modal.getByRole("heading", { name: /Policy Identity/i }),
    ).toBeVisible()
    await modal.getByRole("button", { name: /Next: Asset Details/i }).click()
    await modal.getByRole("button", { name: /Next: Financials/i }).click()
    await modal.getByRole("button", { name: /Next: Review & Issue/i }).click()

    await modal.getByRole("button", { name: /Change.*Asset/i }).click()
    await expect(
      modal.getByRole("heading", { name: /Asset Details/i }),
    ).toBeVisible()
    await modal.getByRole("button", { name: /Next: Financials/i }).click()
    await modal.getByRole("button", { name: /Next: Review & Issue/i }).click()

    await modal.getByRole("button", { name: /Change.*Financials/i }).click()
    await expect(modal.getByLabel(/Sum Insured/i)).toBeVisible()
  })
})
