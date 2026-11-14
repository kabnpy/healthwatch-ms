// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

let mockPathname = "/catalog/insurers"

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (opts: { component: React.ComponentType }) => ({
    options: opts,
  }),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  Outlet: () => <div data-testid="catalog-outlet">Outlet Content</div>,
  useLocation: () => ({ pathname: mockPathname }),
}))

vi.mock("@/components/Insurers/AddInsurer", () => ({
  default: () => <button type="button">Add Insurer</button>,
}))

vi.mock("@/components/Products/AddProduct", () => ({
  AddProduct: () => <button type="button">Add Product</button>,
}))

import { Route } from "./catalog"

const CatalogLayout = Route.options.component

describe("CatalogLayout", () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    mockPathname = "/catalog/insurers"
  })

  it("renders Catalog header, tabs, and Add Insurer on /catalog/insurers", () => {
    mockPathname = "/catalog/insurers"
    render(<CatalogLayout />)

    expect(screen.getByText("Catalog")).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Insurers" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Add Insurer" })).toBeTruthy()
    expect(screen.getByTestId("catalog-outlet")).toBeTruthy()
  })

  it("suppresses Catalog header, tabs, and Add button on /catalog/insurers/$insurerId", () => {
    mockPathname = "/catalog/insurers/insurer-123"
    render(<CatalogLayout />)

    expect(screen.queryByText("Catalog")).toBeNull()
    expect(screen.queryByRole("heading", { name: "Insurers" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Add Insurer" })).toBeNull()
    expect(screen.getByTestId("catalog-outlet")).toBeTruthy()
  })

  it("suppresses Catalog header, tabs, and Add button on /catalog/products/$productId", () => {
    mockPathname = "/catalog/products/product-456"
    render(<CatalogLayout />)

    expect(screen.queryByText("Catalog")).toBeNull()
    expect(screen.queryByRole("heading", { name: "Products" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Add Product" })).toBeNull()
    expect(screen.getByTestId("catalog-outlet")).toBeTruthy()
  })
})
