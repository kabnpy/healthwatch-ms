// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ProductForm } from "@/components/Products/ProductForm"

afterEach(cleanup)

vi.mock("@/hooks/useCatalog", () => ({
  useInsurers: () => ({
    data: {
      data: [{ id: "11111111-1111-1111-1111-111111111111", name: "Jubilee Insurance" }],
    },
  }),
}))

describe("ProductForm", () => {
  it("displays the owning Insurer name instead of raw UUID when initialData is provided", () => {
    const queryClient = new QueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <ProductForm
          onSubmit={vi.fn()}
          initialData={{
            id: "22222222-2222-2222-2222-222222222222",
            insurer_id: "11111111-1111-1111-1111-111111111111",
            name: "Motor Comprehensive",
            class_of_insurance: "Motor Private",
            default_commission_rate: 10,
            product_details: {},
            insurer: {
              id: "11111111-1111-1111-1111-111111111111",
              name: "Jubilee Insurance",
            } as any,
          }}
        />
      </QueryClientProvider>,
    )

    expect(screen.getByText("Jubilee Insurance")).toBeTruthy()
    expect(
      screen.queryByText("11111111-1111-1111-1111-111111111111"),
    ).toBeNull()
  })

  it("omits the duplicate Save Product button when useContext is true", () => {
    const queryClient = new QueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <ProductForm
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
          useContext={true}
        />
      </QueryClientProvider>,
    )

    expect(
      screen.queryByRole("button", { name: /save product/i }),
    ).toBeNull()
  })
})
