// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const mockRefetchPolicies = vi.fn()
const mockRefetchClients = vi.fn()
const mockRefetchRenewals = vi.fn()
const mockRefetchSummary = vi.fn()

vi.mock("@/hooks/useAuth", () => ({
  default: () => ({
    user: { full_name: "Test User", email: "test@example.com" },
  }),
}))

vi.mock("@/hooks/usePolicies", () => ({
  usePolicies: () => ({
    data: undefined,
    isLoading: false,
    isError: true,
    refetch: mockRefetchPolicies,
  }),
}))

vi.mock("@/hooks/useClients", () => ({
  useClients: () => ({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: mockRefetchClients,
  }),
}))

vi.mock("@/hooks/useRenewals", () => ({
  useRenewals: () => ({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: mockRefetchRenewals,
  }),
}))

vi.mock("@/hooks/useFinancials", () => ({
  useFinancialSummary: () => ({
    summary: undefined,
    isLoading: false,
    isError: false,
    refetch: mockRefetchSummary,
  }),
}))

import { Route } from "./index"

afterEach(() => {
  cleanup()
  mockRefetchPolicies.mockClear()
  mockRefetchClients.mockClear()
  mockRefetchRenewals.mockClear()
  mockRefetchSummary.mockClear()
})

describe("AgencyDashboard error handling", () => {
  it("renders QueryErrorBanner on query failure and retries failed queries on click", () => {
    const Component = Route.options.component!
    render(<Component />)

    const alert = screen.getByRole("alert")
    expect(alert.textContent).toContain("Failed to load dashboard data")

    const retryButton = screen.getByRole("button", { name: /retry/i })
    fireEvent.click(retryButton)
    expect(mockRefetchPolicies).toHaveBeenCalledTimes(1)
  })
})
