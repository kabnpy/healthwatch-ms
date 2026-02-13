import { expect, test } from "@playwright/test"

test("Clients page is accessible and shows correct title", async ({ page }) => {
  await page.goto("/clients")
  await expect(page.getByRole("heading", { name: "Clients" })).toBeVisible()
  await expect(page.getByText("Manage your client database")).toBeVisible()
})

test("Add Client button is visible", async ({ page }) => {
  await page.goto("/clients")
  await expect(page.getByRole("button", { name: "Add Client" })).toBeVisible()
})

test("Can navigate to client detail page", async ({ page }) => {
  await page.goto("/clients")

  // Create a test client first to ensure one exists
  await page.getByRole("button", { name: "Add Client" }).click()
  const randomSuffix = Math.floor(Math.random() * 10000)
  const clientName = `Test Client ${randomSuffix}`
  const clientEmail = `test-${randomSuffix}@example.com`

  await page.getByLabel("Name").fill(clientName)
  await page.getByLabel("Email").fill(clientEmail)
  await page.getByRole("button", { name: "Save" }).click()

  // Wait for client to appear and click View Details
  await expect(page.getByText(clientName)).toBeVisible()
  await page.getByRole("button", { name: "Open menu" }).first().click()
  await page.getByRole("menuitem", { name: "View Details" }).click()

  // Check if we are on the detail page
  await expect(page).toHaveURL(/\/clients\/[0-9a-f-]+/)
  await expect(page.getByRole("heading", { name: clientName })).toBeVisible()
  await expect(page.getByText(clientEmail)).toBeVisible()
})

test("Can manage policies for a client", async ({ page }) => {
  await page.goto("/clients")

  // Navigate to first client details
  await page.getByRole("button", { name: "Open menu" }).first().click()
  await page.getByRole("menuitem", { name: "View Details" }).click()

  // Check policies section
  await expect(page.getByRole("heading", { name: "Policies" })).toBeVisible()

  // Add a policy
  await page.getByRole("button", { name: "Add Policy" }).click()
  const policyNumber = `POL-${Math.floor(Math.random() * 100000)}`
  await page.getByLabel("Policy Number").fill(policyNumber)
  await page.getByLabel("Type").selectOption("HEALTH")
  await page.getByLabel("Provider").fill("Test Provider")
  await page.getByLabel("Start Date").fill("2024-01-01")
  await page.getByRole("button", { name: "Save Policy" }).click()

  // Verify policy is listed
  await expect(page.getByText(policyNumber)).toBeVisible()
})
