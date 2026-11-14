// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { Home } from "lucide-react"
import { describe, expect, it, vi } from "vitest"
import { SidebarProvider } from "@/components/ui/sidebar"
import { Main } from "./Main"

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    onClick,
    className,
  }: {
    children: React.ReactNode
    to: string
    onClick?: () => void
    className?: string
  }) => (
    <a href={to} onClick={onClick} className={className}>
      {children}
    </a>
  ),
  useRouterState: () => ({
    location: { pathname: "/" },
  }),
}))

describe("Sidebar Main", () => {
  it("renders active navigation item without border-l-2 side-tab accent", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    render(
      <SidebarProvider>
        <Main items={[{ title: "Dashboard", path: "/", icon: Home }]} />
      </SidebarProvider>,
    )

    const link = screen.getByRole("link", { name: /dashboard/i })
    expect(link.className).not.toContain("border-l-2")
  })
})
