// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { EnhancedPolicy, EnhancedRiskNote } from "@/types/insurance"
import { CoverageMatrixCard } from "./CoverageMatrixCard"

const basePolicy = {
  id: "pol-1",
  policy_number: "MOT-001",
  inception_date: "2026-01-01",
  product: {
    id: "prod-1",
    name: "Motor Private",
    class_of_insurance: "Motor Private",
  },
} as unknown as EnhancedPolicy

describe("CoverageMatrixCard", () => {
  it("preserves 0 stamp_duty without coercing to 40", () => {
    const riskNote = {
      id: "rn-1",
      net_premium: "100000.00",
      total_amount: "100450.00",
      financial_breakdown: {
        taxes: {
          training_levy: 200,
          phcf: 250,
          stamp_duty: 0,
        },
      },
    } as unknown as EnhancedRiskNote

    render(<CoverageMatrixCard policy={basePolicy} riskNote={riskNote} />)

    expect(screen.getByText(/KES 0\.00/)).toBeTruthy()
    expect(screen.queryByText(/KES 40\.00/)).toBeNull()
  })

  it("renders '—' when authoritative tax fields are absent instead of computing client-side levies", () => {
    const riskNote = {
      id: "rn-2",
      net_premium: "100000.00",
      total_amount: "100000.00",
    } as unknown as EnhancedRiskNote

    render(<CoverageMatrixCard policy={basePolicy} riskNote={riskNote} />)

    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(3)
    expect(screen.queryByText(/KES 40\.00/)).toBeNull()
  })
})
