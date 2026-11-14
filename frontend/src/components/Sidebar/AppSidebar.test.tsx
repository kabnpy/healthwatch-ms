// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import type React from "react"
import { describe, expect, it, vi } from "vitest"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "./AppSidebar"

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    ...props
  }: {
    children: React.ReactNode
    to: string
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useRouterState: () => ({ location: { pathname: "/" } }),
}))

vi.mock("@/hooks/useAuth", () => ({
  default: () => ({
    user: {
      id: "u-1",
      email: "agent@healthwatch.ke",
      full_name: "Agent One",
      is_superuser: false,
    },
    logout: vi.fn(),
  }),
}))

vi.mock("@/components/theme-provider", () => ({
  useTheme: () => ({
    theme: "system",
    setTheme: vi.fn(),
  }),
}))

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}))

describe("AppSidebar", () => {
  it("renders inset variant, compact header, and omits AgencyStatusBadge", () => {
    const { container } = render(
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>,
    )

    const insetSidebar = container.querySelector('[data-variant="inset"]')
    expect(insetSidebar).not.toBeNull()

    const header = container.querySelector('[data-sidebar="header"]')
    expect(header?.className).toContain("py-2")
    expect(header?.className).toContain("pb-3")
    expect(header?.className).not.toContain("py-6")

    const content = container.querySelector('[data-sidebar="content"]')
    expect(content?.className).toContain("pt-2")

    expect(screen.queryByText(/Operational/i)).toBeNull()
  })

  it("wraps SidebarAppearance inside SidebarMenu so no list bullet appears", () => {
    const { container } = render(
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>,
    )

    const themeButton = container.querySelector('[data-testid="theme-button"]')
    expect(themeButton).not.toBeNull()
    const menuItem = themeButton?.closest('[data-sidebar="menu-item"]')
    expect(menuItem?.parentElement?.tagName).toBe("UL")
    expect(menuItem?.parentElement?.getAttribute("data-sidebar")).toBe("menu")
    expect(menuItem?.parentElement?.className).toContain("gap-1")

    const navButton = container.querySelector('[data-sidebar="menu-button"]')
    expect(navButton?.className.split(/\s+/)).not.toContain("font-medium")
  })
})
