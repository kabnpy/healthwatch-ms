// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { QueryErrorBanner } from "./QueryErrorBanner"

afterEach(cleanup)

describe("QueryErrorBanner", () => {
  it("renders an accessible alert with the provided message and invokes onRetry when clicked", () => {
    const onRetry = vi.fn()
    render(
      <QueryErrorBanner
        message="Failed to load renewals pipeline."
        onRetry={onRetry}
      />,
    )

    const alert = screen.getByRole("alert")
    expect(alert).toBeTruthy()
    expect(alert.textContent).toContain("Failed to load renewals pipeline.")

    const retryButton = screen.getByRole("button", { name: /retry/i })
    fireEvent.click(retryButton)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it("renders a default message when none is provided and omits Retry when onRetry is not passed", () => {
    render(<QueryErrorBanner />)

    const alert = screen.getByRole("alert")
    expect(alert.textContent).toContain("Failed to load data")
    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull()
  })
})
