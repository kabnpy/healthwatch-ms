// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { RenewalTransitionSheet } from "./RenewalTransitionSheet"

const mockTransitionMutateAsync = vi.fn()
const mockUpdateMutateAsync = vi.fn()
const mockUsePolicyClaimsAdvocacySummary = vi.fn()

vi.mock("@/hooks/useRenewals", () => ({
  useCreateRenewal: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useTransitionRenewal: () => ({
    mutateAsync: mockTransitionMutateAsync,
    isPending: false,
  }),
  useUpdateRenewal: () => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  }),
}))

vi.mock("@/hooks/useClaims", () => ({
  usePolicyClaimsAdvocacySummary: (policyId?: string) =>
    mockUsePolicyClaimsAdvocacySummary(policyId),
}))

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SheetHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SheetTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  SheetDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  SheetFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}))

vi.mock("@/components/Insurance/AdvisoryRatingCalculator", () => ({
  AdvisoryRatingCalculator: () => null,
}))

vi.mock("@/hooks/usePolicies", () => ({
  usePolicy: () => ({ data: undefined }),
}))

vi.mock("@/hooks/useCustomToast", () => ({
  default: () => ({
    showSuccessToast: vi.fn(),
    showErrorToast: vi.fn(),
  }),
}))

describe("RenewalTransitionSheet", () => {
  const renewal = {
    id: "ren-1",
    policy_id: "pol-1",
    client_id: "cli-1",
    status: "awaiting_carrier" as const,
    renewal_date: "2026-12-31",
    version: 3,
    proposed_premium: "180000.00",
    agreed_premium: null,
    carrier_document_key: null,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  }

  const policy = {
    id: "pol-1",
    policy_number: "POL-TRX-09",
    client_id: "cli-1",
    status: "ACTIVE" as const,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  }

  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockTransitionMutateAsync.mockResolvedValue({})
    mockUpdateMutateAsync.mockResolvedValue({})
    mockUsePolicyClaimsAdvocacySummary.mockReturnValue({
      data: {
        policy_id: "pol-1",
        total_earned_premium: "200000.00",
        total_settled: "45000.00",
        total_open_reserves: "0.00",
        total_incurred_claims: "45000.00",
        loss_ratio_percent: "22.50",
        claims_count: 1,
        active_claims_count: 0,
        closed_or_declined_count: 0,
        advocacy_rating: "EXCELLENT",
        advocacy_note:
          "Strong candidate for renewal discount and carrier concessions.",
      },
    })
  })

  it("renders advocacy_rating, total_settled, and advocacy_note from generated summary", () => {
    render(
      <RenewalTransitionSheet
        renewal={renewal as any}
        policy={policy as any}
        isOpen={true}
        onOpenChange={vi.fn()}
      />,
    )

    expect(screen.getByText(/EXCELLENT/i)).toBeTruthy()
    expect(screen.getAllByText(/45,000/).length).toBeGreaterThanOrEqual(1)
    expect(
      screen.getByText(
        "Strong candidate for renewal discount and carrier concessions.",
      ),
    ).toBeTruthy()
  })

  it("sends version: renewal.version on stage transitions and financial updates", async () => {
    render(
      <RenewalTransitionSheet
        renewal={renewal as any}
        policy={policy as any}
        isOpen={true}
        onOpenChange={vi.fn()}
      />,
    )

    const saveBtn = screen.getByRole("button", {
      name: /save schedule changes/i,
    })
    fireEvent.click(saveBtn)

    expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "ren-1",
        data: expect.objectContaining({
          expected_version: 3,
        }),
      }),
    )

    const transitionBtn = screen.getByRole("button", {
      name: /mark carrier terms received/i,
    })
    fireEvent.click(transitionBtn)

    expect(mockTransitionMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "ren-1",
        data: expect.objectContaining({
          expected_version: 3,
        }),
      }),
    )
  })
})
