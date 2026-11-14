// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const mockRefetch = vi.fn()

vi.mock("@/hooks/useRenewals", () => ({
  useRenewalsHorizon: () => ({
    data: undefined,
    isLoading: false,
    isError: true,
    refetch: mockRefetch,
  }),
}))

import { Route } from "./renewals.index"

afterEach(() => {
  cleanup()
  mockRefetch.mockClear()
})

describe("RenewalsDeskPage error handling", () => {
  it("renders QueryErrorBanner on query failure and retries on click", () => {
    const Component = Route.options.component!
    render(<Component />)

    const alert = screen.getByRole("alert")
    expect(alert.textContent).toContain("Failed to load renewals pipeline")

    const retryButton = screen.getByRole("button", { name: /retry/i })
    fireEvent.click(retryButton)
    expect(mockRefetch).toHaveBeenCalledTimes(1)
  })
})
