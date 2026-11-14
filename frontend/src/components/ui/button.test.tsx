// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { Button } from "./button"
import { SidebarProvider, SidebarTrigger } from "./sidebar"

beforeAll(() => {
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
})

describe("Mobile touch targets (< 640px)", () => {
  it("applies >= 44px mobile minimum height to Button variants while preserving desktop compact sizing", () => {
    render(
      <div>
        <Button size="default">Default</Button>
        <Button size="sm">Small</Button>
        <Button size="xs">Extra Small</Button>
        <Button size="icon" aria-label="Icon">
          I
        </Button>
        <Button size="icon-sm" aria-label="Icon Small">
          IS
        </Button>
      </div>,
    )

    const defaultBtn = screen.getByRole("button", { name: "Default" })
    const smBtn = screen.getByRole("button", { name: "Small" })
    const xsBtn = screen.getByRole("button", { name: "Extra Small" })
    const iconBtn = screen.getByRole("button", { name: "Icon" })
    const iconSmBtn = screen.getByRole("button", { name: "Icon Small" })

    for (const btn of [defaultBtn, smBtn, xsBtn]) {
      expect(btn.className).toContain("min-h-11")
      expect(btn.className).toContain("sm:min-h-0")
    }

    for (const btn of [iconBtn, iconSmBtn]) {
      expect(btn.className).toContain("min-h-11")
      expect(btn.className).toContain("min-w-11")
      expect(btn.className).toContain("sm:min-h-0")
      expect(btn.className).toContain("sm:min-w-0")
    }
  })

  it("applies >= 44px mobile tap target to SidebarTrigger while preserving desktop size-7", () => {
    render(
      <SidebarProvider>
        <SidebarTrigger />
      </SidebarProvider>,
    )

    const trigger = screen.getByRole("button", { name: /sidebar/i })
    expect(trigger.className).toContain("size-11")
    expect(trigger.className).toContain("sm:size-7")
  })
})
