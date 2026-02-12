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
