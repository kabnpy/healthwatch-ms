// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { StepFinancials } from "./StepFinancials"

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const mockMutate = vi.fn()

vi.mock("@/hooks/usePolicies", () => ({
  useProducts: () => ({
    data: {
      data: [
        {
          id: "prod-1",
          name: "Motor Private Comprehensive",
          class_of_insurance: "Motor Private",
          pricing_rules: {},
        },
      ],
    },
  }),
  useQuote: () => ({
    mutate: mockMutate,
    isPending: false,
    data: {
      net_premium: "100000",
      total_premium: "100490",
      levies: { itl: "200", phcf: "250", stamp_duty: "40" },
      calculation_detail: {
        is_high_end: true,
        basic_rate: 0.035,
      },
    },
  }),
}))

describe("StepFinancials", () => {
  it("drives isHighEnd from calculation_detail.is_high_end even when sum_insured is below 3000000", () => {
    render(
      <StepFinancials
        productId="prod-1"
        sum_insured={1500000}
        onSumInsuredChange={vi.fn()}
        defaultValues={{}}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    expect(screen.getAllByText(/\(INCLUDED\)/i).length).toBeGreaterThan(0)
  })
})
