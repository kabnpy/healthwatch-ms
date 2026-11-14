// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const mockRefetch = vi.fn()
let mockHorizonState: {
  data: any
  isLoading: boolean
  isError: boolean
  refetch: typeof mockRefetch
} = {
  data: undefined,
  isLoading: false,
  isError: true,
  refetch: mockRefetch,
}

vi.mock("@/hooks/useRenewals", () => ({
  useRenewalsHorizon: () => mockHorizonState,
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

vi.mock("@/components/Renewals/RenewalTransitionSheet", () => ({
  RenewalTransitionSheet: ({ isOpen, policy }: any) =>
    isOpen ? (
      <div data-testid="renewal-transition-sheet">{policy?.policy_number}</div>
    ) : null,
}))

import { Route } from "./renewals.index"

afterEach(() => {
  cleanup()
  mockRefetch.mockClear()
})

describe("RenewalsDeskPage error handling", () => {
  it("renders QueryErrorBanner on query failure and retries on click", () => {
    mockHorizonState = {
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: mockRefetch,
    }
    const Component = Route.options.component!
    render(<Component />)

    const alert = screen.getByRole("alert")
    expect(alert.textContent).toContain("Failed to load renewals pipeline")

    const retryButton = screen.getByRole("button", { name: /retry/i })
    fireEvent.click(retryButton)
    expect(mockRefetch).toHaveBeenCalledTimes(1)
  })
})

function makeHorizonItem(overrides: Partial<any> = {}) {
  return {
    policy_id: "pol-1",
    policy_number: "POL-001",
    client_id: "cli-1",
    client_name: "Acme Corp",
    coverage_end: "2026-11-26",
    days_left: 12,
    policy: {
      id: "pol-1",
      policy_number: "POL-001",
      client_id: "cli-1",
      product_id: "prod-1",
      status: "active",
      product: {
        id: "prod-1",
        name: "Motor Private",
        class_of_insurance: "Motor Private",
        insurer_id: "ins-1",
      },
      active_note: null,
      ...overrides.policy,
    },
    renewal: null,
    ...overrides,
  }
}

describe("RenewalsDeskPage data accuracy and terminology", () => {
  it("displays Renewal Horizon countdown and coverage_end from top-level RenewalHorizonItem fields", () => {
    mockHorizonState = {
      data: {
        overdue: [],
        "0_30": [makeHorizonItem({ days_left: 12, coverage_end: "2026-11-26" })],
        "31_60": [],
        "61_90": [],
      },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    }
    const Component = Route.options.component!
    render(<Component />)

    expect(screen.getAllByText("12d left").length).toBeGreaterThan(0)
    expect(screen.getAllByText("(2026-11-26)").length).toBeGreaterThan(0)
  })

  it("deduplicates Cover / Asset when no distinct asset descriptor exists", () => {
    mockHorizonState = {
      data: {
        overdue: [],
        "0_30": [makeHorizonItem()],
        "31_60": [],
        "61_90": [],
      },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    }
    const Component = Route.options.component!
    render(<Component />)

    expect(screen.getAllByText("Motor Private")).toHaveLength(1)
  })

  it("unifies Expiring in <=30 Days and Active Workflows counts with Agency Dashboard semantics", () => {
    mockHorizonState = {
      data: {
        overdue: [],
        "0_30": [
          makeHorizonItem({ policy_id: "pol-1", renewal: null }),
          makeHorizonItem({
            policy_id: "pol-2",
            policy_number: "POL-002",
            renewal: { id: "ren-1", policy_id: "pol-2", status: "awaiting_carrier" },
          }),
        ],
        "31_60": [
          makeHorizonItem({
            policy_id: "pol-3",
            policy_number: "POL-003",
            renewal: { id: "ren-3", policy_id: "pol-3", status: "cancelled" },
          }),
        ],
        "61_90": [
          makeHorizonItem({
            policy_id: "pol-4",
            policy_number: "POL-004",
            renewal: { id: "ren-2", policy_id: "pol-4", status: "client_invited" },
          }),
        ],
      },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    }
    const Component = Route.options.component!
    render(<Component />)

    const expiringTab = screen.getByRole("tab", { name: /Expiring in ≤30 Days/i })
    expect(expiringTab.textContent).toContain("1")

    const activeWorkflowsTab = screen.getByRole("tab", {
      name: /Active Workflows/i,
    })
    expect(activeWorkflowsTab.textContent).toContain("2")
  })

  it("uses Insurer terminology and stage-specific action labels that open RenewalTransitionSheet", () => {
    mockHorizonState = {
      data: {
        overdue: [],
        "0_30": [makeHorizonItem({ policy_id: "pol-1", policy_number: "POL-001", renewal: null })],
        "31_60": [],
        "61_90": [
          makeHorizonItem({
            policy_id: "pol-2",
            policy_number: "POL-002",
            renewal: { id: "ren-1", policy_id: "pol-2", status: "awaiting_carrier" },
          }),
        ],
      },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    }
    const Component = Route.options.component!
    const { container } = render(<Component />)

    expect(container.textContent?.toLowerCase()).not.toContain("carrier")

    const [startBtn] = screen.getAllByRole("button", { name: /Start Renewal/i })
    fireEvent.click(startBtn)
    expect(screen.getByTestId("renewal-transition-sheet").textContent).toContain(
      "POL-001",
    )
  })
})

describe("RenewalsDeskPage layout, calm zero-states, and responsive triage", () => {
  it("normalizes page header with sentence-case subtitle and removes Browse Clients", () => {
    mockHorizonState = {
      data: { overdue: [], "0_30": [], "31_60": [], "61_90": [] },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    }
    const Component = Route.options.component!
    render(<Component />)

    expect(
      screen.getByRole("heading", { name: "Policy Renewals" }),
    ).toBeDefined()
    const subtitle = screen.getByText(
      /Track and manage upcoming policy expirations and renewals/i,
    )
    expect(subtitle.className).not.toContain("uppercase")
    expect(screen.queryByRole("link", { name: /Browse Clients/i })).toBeNull()
  })

  it("renders 0-count KPI cards in calm neutral styling and escalates when count > 0", () => {
    mockHorizonState = {
      data: { overdue: [], "0_30": [], "31_60": [], "61_90": [] },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    }
    const Component = Route.options.component!
    const { container, rerender } = render(<Component />)

    expect(container.innerHTML).not.toContain("border-amber-500/30")
    expect(container.innerHTML).not.toContain("border-rose-500/30")
    expect(container.innerHTML).not.toContain("border-blue-500/30")

    mockHorizonState = {
      data: {
        overdue: [makeHorizonItem({ policy_id: "pol-od", days_left: -3 })],
        "0_30": [makeHorizonItem({ policy_id: "pol-30", days_left: 5 })],
        "31_60": [],
        "61_90": [],
      },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    }
    rerender(<Component />)

    expect(container.innerHTML).toContain("border-amber-500/30")
    expect(container.innerHTML).toContain("border-rose-500/30")
  })

  it("consolidates Policy No and Cover / Asset and removes Sum Insured from the table", () => {
    mockHorizonState = {
      data: {
        overdue: [],
        "0_30": [makeHorizonItem({ policy_id: "pol-1", policy_number: "POL-001" })],
        "31_60": [],
        "61_90": [],
      },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    }
    const Component = Route.options.component!
    render(<Component />)

    expect(screen.queryByText("Sum Insured")).toBeNull()
    expect(screen.getByText("Policy / Cover")).toBeDefined()
    expect(screen.getAllByText("POL-001").length).toBeGreaterThan(0)
  })

  it("renders responsive mobile triage cards with policy, client, horizon, stage, and action", () => {
    mockHorizonState = {
      data: {
        overdue: [],
        "0_30": [
          makeHorizonItem({
            policy_id: "pol-mob",
            policy_number: "POL-MOB-1",
            client_name: "Mobile Client",
            days_left: 5,
            coverage_end: "2026-12-01",
          }),
        ],
        "31_60": [],
        "61_90": [],
      },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    }
    const Component = Route.options.component!
    render(<Component />)

    const card = screen.getByTestId("renewal-mobile-card")
    expect(card.textContent).toContain("POL-MOB-1")
    expect(card.textContent).toContain("Mobile Client")
    expect(card.textContent).toContain("5d left")
    expect(card.textContent).toContain("Not Initiated")
    expect(card.textContent).toContain("Start Renewal")
  })
})
