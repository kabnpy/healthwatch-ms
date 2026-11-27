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

const useCommandMenuDataMock = vi.fn((_open: boolean) => ({
  clients: [],
  policies: [],
  invoices: [],
  payments: [],
  expiringPolicies: [],
}))

vi.mock("@/hooks/useCommandMenuData", () => ({
  useCommandMenuData: (open: boolean) => useCommandMenuDataMock(open),
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

    const input = screen.getByPlaceholderText(
      "Type a command or search clients, policies, renewals...",
    )
    expect(input).toBeTruthy()
    const dialog = input.closest('[data-slot="dialog-content"]')
    expect(dialog?.className).toContain("sm:max-w-xl")
  })
})
