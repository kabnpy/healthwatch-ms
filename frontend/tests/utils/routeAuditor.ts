import { expect, type Page } from "@playwright/test"

/**
 * Attaches page listeners to detect uncaught page errors, console errors,
 * and failed API responses (HTTP 4xx/5xx).
 */
export function setupRouteAuditor(page: Page) {
  const consoleErrors: string[] = []
  const pageErrors: Error[] = []
  const failedResponses: { url: string; status: number }[] = []

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text()
      // Ignore known benign third-party or browser-specific noise if necessary
      if (!text.includes("Download the React DevTools")) {
        consoleErrors.push(text)
      }
    }
  })

  page.on("pageerror", (err) => {
    pageErrors.push(err)
  })

  page.on("response", (res) => {
    const url = res.url()
    // Monitor API calls only
    if (url.includes("/api/v1/") && res.status() >= 400) {
      failedResponses.push({ url, status: res.status() })
    }
  })

  return {
    async assertCleanNavigation(expectedHeading?: RegExp | string) {
      // 1. Ensure error boundaries or 404 views are not rendered
      await expect(page.locator('[data-testid="not-found"]')).toHaveCount(0)
      await expect(page.locator('[data-testid="error-component"]')).toHaveCount(
        0,
      )
      await expect(
        page.getByText("Something went wrong. Please try again."),
      ).toHaveCount(0)

      // 2. If an expected heading is provided, verify it is visible
      if (expectedHeading) {
        if (typeof expectedHeading === "string") {
          await expect(
            page
              .getByRole("heading", { name: expectedHeading, exact: false })
              .first(),
          ).toBeVisible({ timeout: 10000 })
        } else {
          await expect(
            page.getByRole("heading", { name: expectedHeading }).first(),
          ).toBeVisible({ timeout: 10000 })
        }
      }

      // 3. Verify no unhandled page errors occurred
      expect(
        pageErrors,
        `Page threw unhandled exceptions: ${pageErrors.map((e) => e.message).join("; ")}`,
      ).toHaveLength(0)

      // 4. Verify no failed API calls occurred during route loading
      expect(
        failedResponses,
        `Route triggered failed API calls: ${failedResponses.map((r) => `${r.status} ${r.url}`).join("; ")}`,
      ).toHaveLength(0)
    },
    getConsoleErrors: () => consoleErrors,
    getFailedResponses: () => failedResponses,
  }
}
