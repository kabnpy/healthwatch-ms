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

    await options.first().click()
    await modal.getByRole("button", { name: /Next/i }).click()

    // 5. Enter Asset Details (Step 2)
    // We expect fields like Reg. No, Make, Year, Value Kshs.
    await modal.getByLabel(/Reg. No/i).fill("KCM 123X")
    await modal.getByLabel(/Make/i).fill("Toyota Prado")
    await modal.getByLabel(/Year/i).fill("2020")
    await modal.getByLabel(/Value Kshs./i).fill("5000000")

    await modal.getByRole("button", { name: /Next/i }).click()

    // 6. Step 3: Financials
    // Sum Insured should display 5,000,000
    await expect(modal.getByText("KES 5,000,000")).toBeVisible()

    // Authoritative math should kick in
    await expect(modal.getByText(/AUTHORITATIVE MATH/i)).toBeVisible()

    // Net Premium should be 150,000 (3% of 5M)
    await expect(modal.getByText("150,000.00")).toBeVisible()

    await modal.getByRole("button", { name: /Next/i }).click()

    // 7. Step 4: Review
    await expect(modal.getByText("AUTHORITATIVE")).toBeVisible()
    await expect(modal.getByText("150,000.00")).toBeVisible()

    // 8. Issue Policy
    await modal.getByRole("button", { name: /Issue Policy/i }).click()

    // Success toast
    await expect(page.getByText(/Policy Issued/i)).toBeVisible()

    // 9. Verify Risk Note View
    await page.waitForSelector("h1:has-text('Risk Note')")
    await expect(page.getByText("NET PREMIUM")).toBeVisible()
    // Should see the 150,000 in the table
    await expect(page.locator("table").getByText("150,000.00")).toBeVisible()
  })
})
