import { expect, type Page, test } from "@playwright/test"

async function openFirstPrintableRiskNote(page: Page): Promise<string> {
  await page.goto("/policies")
  await page.waitForSelector("table")

  const policyLink = page
    .locator('table tbody tr a[href*="/policies/"]')
    .first()
  await expect(policyLink).toBeVisible()
  await policyLink.click()
  await page.waitForURL(/\/policies\/.+/)

  const printLink = page.locator('a[href*="/print/risk-notes/"]').first()
  if (await printLink.isVisible()) {
    const href = await printLink.getAttribute("href")
    if (href) {
      await page.goto(href)
      await page.waitForURL(/\/print\/risk-notes\/.+/)
      return href
    }
  }

  // Fallback: extract policy/risk-note route from History tab if available
  const historyTab = page.getByRole("tab", { name: "History" })
  if (await historyTab.isVisible()) {
    await historyTab.click()
    await page.waitForSelector("table")
    const historyPrintLink = page
      .locator('a[href*="/print/risk-notes/"]')
      .first()
    if (await historyPrintLink.isVisible()) {
      const href = await historyPrintLink.getAttribute("href")
      if (href) {
        await page.goto(href)
        await page.waitForURL(/\/print\/risk-notes\/.+/)
        return href
      }
    }
  }

  throw new Error("No printable risk note link found in seeded policies")
}

test.describe("Printable Risk Note Viewer (/print/risk-notes/$id)", () => {
  test("verifies dark-mode toolbar contrast, 390px mobile wrapping, auto-fit iframe height, Back link, and PHCF", async ({
    page,
  }) => {
    test.setTimeout(60000)
    await page.setViewportSize({ width: 1440, height: 900 })
    await openFirstPrintableRiskNote(page)

    const iframe = page.locator('iframe[title="Canonical Document Schedule"]')
    await expect(iframe).toBeVisible()

    // 1. Desktop auto-fit iframe height & Authorized Signatory visibility
    const docFrame = page.frameLocator(
      'iframe[title="Canonical Document Schedule"]',
    )
    await expect(docFrame.getByText("Authorized Signatory")).toBeVisible()

    const iframeBox = await iframe.boundingBox()
    expect(iframeBox).not.toBeNull()
    expect(iframeBox!.height).toBeGreaterThanOrEqual(950)

    // 2. PHCF uppercase in Premium & Statutory Levies
    await expect(
      docFrame.getByText("PHCF", { exact: false }).first(),
    ).toBeVisible()
    await expect(docFrame.getByText("Phcf", { exact: true })).toHaveCount(0)

    // 3. Dark-mode toolbar contrast while A4 paper stays white
    await page.evaluate(() => {
      document.documentElement.classList.add("dark")
    })

    const refreshBtn = page.getByRole("button", { name: /Refresh/i })
    const printBtn = page.getByRole("button", { name: /Print/i })
    const popOutBtn = page.getByRole("button", { name: /Pop Out/i })
    const officialPdfBtn = page.getByRole("button", { name: /Official PDF/i })

    for (const btn of [refreshBtn, printBtn, popOutBtn, officialPdfBtn]) {
      await expect(btn).toBeVisible()
      const colors = await btn.evaluate((el) => {
        const style = window.getComputedStyle(el)
        return {
          color: style.color,
          backgroundColor: style.backgroundColor,
        }
      })
      expect(colors.color).not.toBe(colors.backgroundColor)
    }

    const paperBg = await iframe.evaluate((el) => {
      const paper = el.parentElement
      return paper ? window.getComputedStyle(paper).backgroundColor : ""
    })
    expect(paperBg).toBe("rgb(255, 255, 255)")

    // 4. 390x844 mobile toolbar wrapping without horizontal overflow
    await page.setViewportSize({ width: 390, height: 844 })
    const hasOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    )
    expect(hasOverflow).toBe(false)

    for (const btn of [refreshBtn, printBtn, popOutBtn, officialPdfBtn]) {
      await expect(btn).toBeVisible()
      const box = await btn.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(390)
    }

    // 5. print:hidden ← Back action
    const backBtn = page.getByRole("button", { name: /← Back/i })
    await expect(backBtn).toBeVisible()
    await expect(backBtn.locator("..")).toHaveClass(/print:hidden/)
    await backBtn.click()
    await page.waitForURL(/\/(policies|clients)/)
  })
})
