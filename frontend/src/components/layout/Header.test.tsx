// @vitest-environment jsdom
import { render } from "@testing-library/react"
import type React from "react"
import { describe, expect, it, vi } from "vitest"
import { SidebarProvider } from "@/components/ui/sidebar"
import { Header } from "./Header"

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
}))

vi.mock("@/hooks/useBreadcrumbs", () => ({
  useBreadcrumbs: () => [
    { label: "Home", href: "/", isCurrent: false },
    { label: "Clients", href: "/clients", isCurrent: true },
  ],
}))

vi.mock("@/components/Common/CommandMenu", () => ({
  CommandMenu: () => <div data-testid="command-menu" />,
}))

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}))

describe("Header", () => {
  it("renders vertical separator after SidebarTrigger and right-aligns CommandMenu", () => {
    const { container, getByTestId } = render(
      <SidebarProvider>
        <Header />
      </SidebarProvider>,
    )

    const separator = container.querySelector('[data-orientation="vertical"]')
    expect(separator).not.toBeNull()

    const commandMenuWrapper = getByTestId("command-menu").parentElement
    expect(commandMenuWrapper?.className).toContain("ml-auto")
    expect(commandMenuWrapper?.className).not.toContain("justify-center")
  })

  it("matches dashboard-01 non-sticky transparent header so SidebarInset rounded corners stay clean", () => {
    const { container } = render(
      <SidebarProvider>
        <Header />
      </SidebarProvider>,
    )

    const header = container.querySelector("header")
    expect(header?.className).toContain("h-12")
    expect(header?.className).toContain("px-4")
    expect(header?.className).toContain("lg:px-6")
    expect(header?.className).toContain("border-b")
    expect(header?.className).not.toContain("sticky")
    expect(header?.className).not.toContain("bg-background/95")
    expect(header?.className).not.toContain("backdrop-blur-sm")

    const separator = container.querySelector('[data-orientation="vertical"]')
    expect(separator?.className).toContain("self-center")
  })
})
