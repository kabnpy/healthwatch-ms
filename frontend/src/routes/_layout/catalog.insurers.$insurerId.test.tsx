// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (opts: { component: React.ComponentType }) => ({
    options: opts,
    useParams: () => ({ insurerId: "insurer-1" }),
  }),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

vi.mock("@tanstack/react-query", () => ({
  useSuspenseQuery: () => ({
    data: {
      id: "insurer-1",
      name: "Jubilee Insurance",
      email: "info@jubilee.co.ke",
      phone: "+254 700 000000",
    },
  }),
}))

vi.mock("@/queryClient", () => ({
  queryClient: { ensureQueryData: vi.fn() },
}))

vi.mock("@/hooks/useCatalog", () => ({
  useProducts: () => ({
    isLoading: false,
    data: {
      data: [
        {
          id: "prod-1",
          name: "Motor Private",
          class_of_insurance: "Motor",
          default_commission_rate: 12.5,
          insurer_id: "insurer-1",
        },
      ],
    },
  }),
}))

vi.mock("@/components/Products/AddProduct", () => ({
  AddProduct: () => <button type="button">Add Product</button>,
}))

vi.mock("@/components/Products/ProductActionsMenu", () => ({
  ProductActionsMenu: () => null,
}))

import { Route } from "./catalog.insurers.$insurerId"

const InsurerDetailLayout = Route.options.component

describe("InsurerDetailLayout", () => {
  afterEach(() => {
    cleanup()
  })

  it("omits the redundant Insurer column from Insurance Products table", () => {
    render(<InsurerDetailLayout />)

    expect(
      screen.getByRole("columnheader", { name: "Product Name" }),
    ).toBeTruthy()
    expect(screen.getByRole("columnheader", { name: "Class" })).toBeTruthy()
    expect(screen.getByRole("columnheader", { name: "Comm. %" })).toBeTruthy()
    expect(screen.queryByRole("columnheader", { name: "Insurer" })).toBeNull()
  })
})
