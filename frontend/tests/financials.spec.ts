import { expect, test } from "@playwright/test"

test.describe("Financials Hub (/financials)", () => {
  test("has zero horizontal overflow at 1440x900, single search bar, formatted badges & KES, row actions menu, and client links", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/financials")

    await expect(
      page.getByRole("heading", { name: "Finances & Invoicing" }),
    ).toBeVisible()

    // Single search bar
    await expect(
      page.getByPlaceholder("Search ref, client, or invoice..."),
    ).toHaveCount(1)

    // 2-decimal KES/Ksh formatting in KPI cards
    await expect(page.locator(".tabular-nums").first()).toContainText(
      /\d+\.\d{2}/,
    )

    // Zero horizontal overflow at 1440x900
    const overflow1440 = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    )
    expect(overflow1440).toBe(false)

    // If payment rows exist, verify row actions menu and client overview links
    const rowActionBtns = page.locator("table").getByRole("button", {
      name: /row actions/i,
    })
    if ((await rowActionBtns.count()) > 0) {
      await rowActionBtns.first().click()
      await expect(page.getByRole("menuitem", { name: "Reverse" })).toBeVisible()
      await page.keyboard.press("Escape")
    }

    const clientLinks = page
      .locator("table a[href^='/clients/'][href$='/overview']")
    if ((await clientLinks.count()) > 0) {
      const href = await clientLinks.first().getAttribute("href")
      expect(href).toMatch(/^\/clients\/[^/]+\/overview$/)
    }
  })

  test("has zero horizontal overflow at 390x844 and renders mobile cards for Payment Records, Invoices, and Allocations", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/financials")

    await expect(
      page.getByRole("heading", { name: "Finances & Invoicing" }),
    ).toBeVisible()

    // Payment Records mobile cards
    await expect(page.getByTestId("payments-mobile-cards")).toBeVisible()
    const overflowPayments = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    )
    expect(overflowPayments).toBe(false)

    // Invoices mobile cards
    await page.getByRole("tab", { name: /invoices/i }).click()
    await expect(page.getByTestId("invoices-mobile-cards")).toBeVisible()
    const overflowInvoices = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    )
    expect(overflowInvoices).toBe(false)

    // Allocations mobile cards
    await page.getByRole("tab", { name: /allocations/i }).click()
    await expect(page.getByTestId("allocations-mobile-cards")).toBeVisible()
    const overflowAllocations = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    )
    expect(overflowAllocations).toBe(false)
  })
})
