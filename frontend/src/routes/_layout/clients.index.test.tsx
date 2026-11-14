// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const mockRefetch = vi.fn()

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>()
  return {
    ...actual,
    useQuery: () => ({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: mockRefetch,
    }),
  }
})

import { Route } from "./clients.index"

afterEach(() => {
  cleanup()
  mockRefetch.mockClear()
})

describe("Clients error handling", () => {
  it("renders QueryErrorBanner on query failure and retries on click", () => {
    const Component = Route.options.component!
    const qc = new QueryClient()
    render(
      <QueryClientProvider client={qc}>
        <Component />
      </QueryClientProvider>,
    )

    const alert = screen.getByRole("alert")
    expect(alert.textContent).toContain("Failed to load clients")

    const retryButton = screen.getByRole("button", { name: /retry/i })
    fireEvent.click(retryButton)
    expect(mockRefetch).toHaveBeenCalledTimes(1)
  })
})
