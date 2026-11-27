// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { PageHeader } from "./PageHeader"

describe("PageHeader", () => {
  it("renders title with standardized h1 scale and bottom divider", () => {
    const { container } = render(<PageHeader title="Agency Dashboard" />)

    const heading = screen.getByRole("heading", {
      level: 1,
      name: "Agency Dashboard",
    })
    expect(heading.className).toContain("text-3xl")
    expect(heading.className).toContain("font-extrabold")
    expect(heading.className).toContain("tracking-tight")
    const root = container.firstElementChild as HTMLElement
    expect(root.className).toContain("border-b")
    expect(root.className).toContain("pb-5")
  })

  it("renders optional eyebrow, subtitle, and actions", () => {
    render(
      <PageHeader
        eyebrow="Agency Operations"
        title="Clients"
        subtitle="Manage client profiles and policies"
        actions={<button type="button">Add Client</button>}
      />,
    )

    const eyebrow = screen.getByText("Agency Operations")
    expect(eyebrow.className).toContain("uppercase")
    expect(eyebrow.className).toContain("tracking-widest")
    const subtitle = screen.getByText("Manage client profiles and policies")
    expect(subtitle.className).toContain("text-sm")
    expect(subtitle.className).toContain("text-muted-foreground")
    expect(screen.getByRole("button", { name: "Add Client" })).toBeDefined()
  })
})
