// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { DashboardSummaryResponse } from "@/client"

const mockRefetchDashboard = vi.fn()
const mockRefetchSummary = vi.fn()

let mockDashboardState: {
  data: DashboardSummaryResponse | undefined
  isLoading: boolean
  isError: boolean
  refetch: typeof mockRefetchDashboard
} = {
  data: undefined,
  isLoading: false,
  isError: true,
  refetch: mockRefetchDashboard,
}

let mockFinancialSummaryState: {
  summary: { totalInvoiced: number; totalPaid: number } | undefined
  isLoading: boolean
  isError: boolean
  refetch: typeof mockRefetchSummary
} = {
  summary: { totalInvoiced: 0, totalPaid: 0 },
  isLoading: false,
  isError: false,
  refetch: mockRefetchSummary,
}

vi.mock("@/hooks/useAuth", () => ({
  default: () => ({
    user: { full_name: "Test User", email: "test@example.com" },
  }),
}))

vi.mock("@/hooks/useDashboard", () => ({
  useDashboardSummary: () => mockDashboardState,
}))

vi.mock("@/hooks/useFinancials", () => ({
  useFinancialSummary: () => mockFinancialSummaryState,
}))

vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-router")>(
    "@tanstack/react-router",
  )
  return {
    ...actual,
    Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
  }
})

vi.mock("@/components/Clients/AddClient", () => ({
  AddClient: () => <button type="button">Add Client</button>,
}))

vi.mock("@/components/Renewals/RenewalTransitionSheet", () => ({
  RenewalTransitionSheet: ({ isOpen, policy, clientName }: any) =>
    isOpen ? (
      <div data-testid="renewal-transition-sheet">
        {policy?.policy_number} - {clientName}
      </div>
    ) : null,
}))

import { Route } from "./index"

afterEach(() => {
  cleanup()
  mockRefetchDashboard.mockClear()
  mockRefetchSummary.mockClear()
  mockDashboardState = {
    data: undefined,
    isLoading: false,
    isError: true,
    refetch: mockRefetchDashboard,
  }
  mockFinancialSummaryState = {
    summary: { totalInvoiced: 0, totalPaid: 0 },
    isLoading: false,
    isError: false,
    refetch: mockRefetchSummary,
  }
})

describe("AgencyDashboard error handling", () => {
  it("renders QueryErrorBanner on query failure and retries failed queries on click", () => {
    const Component = Route.options.component!
    render(<Component />)

    const alert = screen.getByRole("alert")
    expect(alert.textContent).toContain("Failed to load dashboard data")

    const retryButton = screen.getByRole("button", { name: /retry/i })
    fireEvent.click(retryButton)
    expect(mockRefetchDashboard).toHaveBeenCalledTimes(1)
  })
})

describe("AgencyDashboard summary seam & shared renewal workflow", () => {
  it("renders portfolio counts, expiring policies, and in-flight renewals from useDashboardSummary", () => {
    mockDashboardState = {
      data: {
        active_count: 250,
        lapsed_count: 12,
        expiring_30: [
          {
            policy: {
              id: "pol-1",
              policy_number: "POL-250",
              client_id: "cli-1",
              product_id: "prod-1",
              status: "active",
              product: {
                id: "prod-1",
                name: "Motor Private",
                class_of_insurance: "Motor Private",
                insurer_id: "ins-1",
              },
            } as any,
            days_left: 5,
            client_name: "Acme Corp",
          },
        ],
        in_flight_renewals_count: 14,
        in_flight_renewals: [
          {
            renewal: {
              id: "ren-1",
              policy_id: "pol-2",
              status: "carrier_received",
              proposed_premium: "45000",
            } as any,
            policy: {
              id: "pol-2",
              policy_number: "POL-251",
              client_id: "cli-2",
              product_id: "prod-2",
              status: "active",
              product: {
                id: "prod-2",
                name: "Domestic Package",
                class_of_insurance: "Domestic Package",
                insurer_id: "ins-2",
              },
            } as any,
            client_name: "Beta Ltd",
          },
        ],
      },
      isLoading: false,
      isError: false,
      refetch: mockRefetchDashboard,
    }
    mockFinancialSummaryState = {
      summary: { totalInvoiced: 125000, totalPaid: 80000 },
      isLoading: false,
      isError: false,
      refetch: mockRefetchSummary,
    }

    const Component = Route.options.component!
    render(<Component />)

    expect(screen.getByText("250")).toBeTruthy()
    expect(screen.getByText("14")).toBeTruthy()
    expect(screen.getByText("POL-250")).toBeTruthy()
    expect(screen.getByText("5d left")).toBeTruthy()
    expect(screen.getByText(/Acme Corp/)).toBeTruthy()

    // Shared renewalWorkflow labels for carrier_received
    expect(screen.getByText("Terms Received")).toBeTruthy()
    const actionBtn = screen.getByRole("button", {
      name: /Prepare Invitation/i,
    })
    fireEvent.click(actionBtn)

    const sheet = screen.getByTestId("renewal-transition-sheet")
    expect(sheet.textContent).toContain("POL-251 - Beta Ltd")
  })
})
