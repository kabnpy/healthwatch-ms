import { expect, test } from "@playwright/test"

test.describe("RecordPaymentModal layout, width, and copy", () => {
  test("renders >= 560px wide on 1440x900 desktop with pinned footer and formatted channels", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/financials")

    const recordPaymentBtn = page.getByRole("button", {
      name: /Record Payment/i,
    })
    await expect(recordPaymentBtn).toBeVisible()
    await recordPaymentBtn.click()

    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()

    // Verify GLOSSARY.md aligned copy
    await expect(
      dialog.getByText(
        /Log cleared funds deposited into bank or M-Pesa paybill/i,
      ),
    ).toBeVisible()

    // Verify desktop width >= 560px (max-w-2xl is 672px)
    const dialogBox = await dialog.boundingBox()
    expect(dialogBox).not.toBeNull()
    expect(dialogBox!.width).toBeGreaterThanOrEqual(560)

    // Verify submit button is visible in viewport without clipping
    const submitBtn = dialog.getByRole("button", {
      name: /Record & Post Payment/i,
    })
    await expect(submitBtn).toBeVisible()
    const submitBox = await submitBtn.boundingBox()
    expect(submitBox).not.toBeNull()
    expect(submitBox!.y + submitBox!.height).toBeLessThanOrEqual(900)

    // Verify Payment Channel displays formatted labels
    const channelTrigger = dialog.getByRole("combobox").nth(1)
    await expect(channelTrigger).toContainText("M-Pesa")
    await channelTrigger.click()
    await expect(page.getByRole("option", { name: "M-Pesa" })).toBeVisible()
    await expect(
      page.getByRole("option", { name: "Bank Transfer" }),
    ).toBeVisible()
  })

  test("fits <= 390px on mobile with zero horizontal overflow and pinned footer", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/financials")

    const recordPaymentBtn = page.getByRole("button", {
      name: /Record Payment/i,
    })
    await expect(recordPaymentBtn).toBeVisible()
    await recordPaymentBtn.click()

    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()

    const dialogBox = await dialog.boundingBox()
    expect(dialogBox).not.toBeNull()
    expect(dialogBox!.width).toBeLessThanOrEqual(390)

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
    expect(hasHorizontalOverflow).toBe(false)

    const submitBtn = dialog.getByRole("button", {
      name: /Record & Post Payment/i,
    })
    await expect(submitBtn).toBeVisible()
    const submitBox = await submitBtn.boundingBox()
    expect(submitBox).not.toBeNull()
    expect(submitBox!.y + submitBox!.height).toBeLessThanOrEqual(844)
  })
})
