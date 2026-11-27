// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Badge } from "./badge"
import { Table, TableHead, TableHeader, TableRow } from "./table"
import { Tabs, TabsList, TabsTrigger } from "./tabs"

describe("Badge domain status variants", () => {
  it.each(["active", "pending", "lapsed", "invoiced", "draft"] as const)(
    "renders %s variant backed by --status-%s tokens",
    (variant) => {
      render(<Badge variant={variant}>{variant}</Badge>)
      const badge = screen.getByText(variant)
      expect(badge.className).toContain(`bg-status-${variant}`)
      expect(badge.className).toContain(`text-status-${variant}-foreground`)
      expect(badge.className).toContain(`border-status-${variant}-border`)
    },
  )
})

describe("TableHeader and TableHead", () => {
  it("renders sticky muted TableHeader with backdrop blur", () => {
    const { container } = render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Policy No.</TableHead>
          </TableRow>
        </TableHeader>
      </Table>,
    )
    const thead = container.querySelector('[data-slot="table-header"]')
    expect(thead).not.toBeNull()
    expect(thead?.className).toContain("bg-muted/80")
    expect(thead?.className).toContain("backdrop-blur-xs")

    const th = screen.getByText("Policy No.")
    expect(th.className).toContain("text-[11px]")
    expect(th.className).toContain("uppercase")
    expect(th.className).toContain("tracking-wider")
    expect(th.className).toContain("font-semibold")
    expect(th.className).toContain("text-muted-foreground")
  })
})

describe("TabsList line variant", () => {
  it("supports horizontal scroll on narrow viewports without desktop overflow", () => {
    const { container } = render(
      <Tabs defaultValue="a">
        <TabsList variant="line">
          <TabsTrigger value="a">Tab A</TabsTrigger>
          <TabsTrigger value="b">Tab B</TabsTrigger>
        </TabsList>
      </Tabs>,
    )
    const list = container.querySelector('[data-slot="tabs-list"]')
    expect(list).not.toBeNull()
    expect(list?.className).toContain("max-w-full")
    expect(list?.className).toContain("overflow-x-auto")
    expect(list?.className).toContain("overflow-y-hidden")
    expect(list?.className).toContain("md:overflow-visible")
  })
})
