import { expect, test } from "@playwright/test"

const ACTION_BUTTON_SELECTOR =
  "table tbody tr button:has-text('Start Renewal'), table tbody tr button:has-text('Log Insurer Terms'), table tbody tr button:has-text('Prepare Invitation'), table tbody tr button:has-text('Follow Up'), table tbody tr button:has-text('Revise Terms'), table tbody tr button:has-text('Complete Renewal')"

test.describe("RenewalTransitionSheet", () => {
  test("desktop 1440x900: renders at >= 520px width with zero horizontal clipping", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/renewals")
    await expect(
      page.getByRole("heading", { name: "Policy Renewals" }),
    ).toBeVisible()
    await page.waitForLoadState("networkidle")

    const actionButtons = page.locator(ACTION_BUTTON_SELECTOR)
    const count = await actionButtons.count()
    test.skip(
      count === 0,
      "No renewal rows available to open RenewalTransitionSheet",
    )

    await actionButtons.first().click()
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()

    const box = await dialog.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeGreaterThanOrEqual(520)

    const clipped = await dialog.evaluate((el) => {
      return el.scrollWidth > el.clientWidth + 1
    })
    expect(clipped).toBe(false)

    // Domain copy & jargon removal
    const text = await dialog.innerText()
    expect(text).not.toMatch(/OCC v\d+/i)
    expect(text).not.toContain("(FIXED-POINT)")
    expect(text).not.toContain("(Fixed-Point)")
    expect(text).not.toContain("DOC KEY")
    expect(text).not.toContain("Doc Key")
    expect(text).not.toContain("Carrier")
    expect(text).not.toContain("Ksh")

    await expect(dialog.getByText("Renewal Terms & Premium")).toBeVisible()
    await expect(dialog.getByText("Insurer Reference")).toBeVisible()
    await expect(dialog.getByText(/Expires:\s*\d{4}-\d{2}-\d{2}/)).toBeVisible()
  })

  test("mobile 390x844: renders at 100% width (<= 390px) with zero horizontal clipping", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/renewals")
    await expect(
      page.getByRole("heading", { name: "Policy Renewals" }),
    ).toBeVisible()
    await page.waitForLoadState("networkidle")

    const mobileCards = page.getByTestId("renewal-mobile-card")
    const count = await mobileCards.count()
    test.skip(
      count === 0,
      "No mobile renewal cards available to open RenewalTransitionSheet",
    )

    const actionBtn = mobileCards.first().getByRole("button").first()
    await actionBtn.click()

    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()

    const box = await dialog.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeGreaterThanOrEqual(380)
    expect(box!.width).toBeLessThanOrEqual(390)

    const clipped = await dialog.evaluate((el) => {
      return el.scrollWidth > el.clientWidth + 1
    })
    expect(clipped).toBe(false)

    // Domain copy & jargon removal
    const text = await dialog.innerText()
    expect(text).not.toMatch(/OCC v\d+/i)
    expect(text).not.toContain("(FIXED-POINT)")
    expect(text).not.toContain("(Fixed-Point)")
    expect(text).not.toContain("DOC KEY")
    expect(text).not.toContain("Doc Key")
    expect(text).not.toContain("Carrier")
    expect(text).not.toContain("Ksh")

    await expect(dialog.getByText("Renewal Terms & Premium")).toBeVisible()
    await expect(dialog.getByText("Insurer Reference")).toBeVisible()
    await expect(dialog.getByText(/Expires:\s*\d{4}-\d{2}-\d{2}/)).toBeVisible()
  })
})
