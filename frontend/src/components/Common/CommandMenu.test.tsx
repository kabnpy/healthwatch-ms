// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { CommandMenu } from "./CommandMenu"

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.scrollIntoView = vi.fn()
})

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}))

vi.mock("@/hooks/useClients", () => ({
  useClients: () => ({ data: { data: [] } }),
}))

vi.mock("@/hooks/usePolicies", () => ({
  usePolicies: () => ({ data: { data: [] } }),
}))

vi.mock("@/hooks/useFinancials", () => ({
  useInvoices: () => ({ data: { data: [] } }),
}))

vi.mock("@/hooks/usePayments", () => ({
  usePaymentRecords: () => ({ data: { data: [] } }),
}))

vi.mock("@/components/Insurance/AdvisoryRatingCalculator", () => ({
  AdvisoryRatingCalculator: () => null,
}))

describe("CommandMenu", () => {
  it("opens global command palette dialog when search trigger button is clicked", () => {
    render(<CommandMenu />)

    const trigger = screen.getByRole("button", {
      name: /search clients, policies, renewals/i,
    })
    expect(trigger.className).toContain("h-8")

    fireEvent.click(trigger)

    expect(
      screen.getByPlaceholderText(
        "Type a command or search clients, policies, renewals...",
      ),
    ).toBeTruthy()
  })
})
