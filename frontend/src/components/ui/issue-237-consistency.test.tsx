// @vitest-environment jsdom
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const SRC_ROOT = resolve(__dirname, "../..")

function readSrc(relPath: string): string {
  return readFileSync(resolve(SRC_ROOT, relPath), "utf-8")
}

describe("Issue #237: List tables, empty states, and dark-mode surfaces", () => {
  it("uses MoreHorizontal instead of EllipsisVertical in all table row action menus", () => {
    const actionMenus = [
      "components/Admin/UserActionsMenu.tsx",
      "components/Insurers/InsurerActionsMenu.tsx",
      "components/Products/ProductActionsMenu.tsx",
    ]
    for (const file of actionMenus) {
      const content = readSrc(file)
      expect(content).not.toContain("EllipsisVertical")
      expect(content).toContain("MoreHorizontal")
    }
  })

  it("uses semantic tokens on Sidebar User avatar instead of bg-zinc-600 text-white", () => {
    const content = readSrc("components/Sidebar/User.tsx")
    expect(content).not.toContain("bg-zinc-600")
    expect(content).not.toContain("text-white")
    expect(content).toMatch(/bg-(muted|primary)/)
  })

  it("uses EmptyState on Clients, Insurers, Products, and Insurer Detail", () => {
    const listRoutes = [
      "routes/_layout/clients.index.tsx",
      "routes/_layout/catalog.insurers.index.tsx",
      "routes/_layout/catalog.products.index.tsx",
      "routes/_layout/catalog.insurers.$insurerId.tsx",
    ]
    for (const file of listRoutes) {
      const content = readSrc(file)
      expect(content).toContain("EmptyState")
    }
  })

  it("removes redundant outer bordered card wrapper around Financials data table", () => {
    const content = readSrc("routes/_layout/financials.index.tsx")
    expect(content).not.toContain("rounded-lg border bg-card")
  })

  it("replaces light-only hardcoded surfaces in PolicyDashboardSkeleton, SchemaBuilder, RiskNoteTable, FileViewer, and StepFinancials", () => {
    const skeleton = readSrc("components/Policies/Dashboard/PolicyDashboardSkeleton.tsx")
    expect(skeleton).not.toContain("bg-white")

    const schemaBuilder = readSrc("components/Products/SchemaBuilder.tsx")
    expect(schemaBuilder).not.toContain("bg-white")
    expect(schemaBuilder).not.toContain("text-black")
    expect(schemaBuilder).not.toContain("text-slate-900")

    const riskNoteTable = readSrc("components/Products/RiskNoteTable.tsx")
    expect(riskNoteTable).not.toContain("text-black")
    expect(riskNoteTable).not.toContain("bg-slate-50")

    const stepFinancials = readSrc("components/Insurance/Wizard/StepFinancials.tsx")
    expect(stepFinancials).not.toContain("bg-slate-900 text-white")

    const fileViewer = readSrc("components/Documents/FileViewer.tsx")
    expect(fileViewer).not.toContain("text-slate-900")
    expect(fileViewer).not.toContain("bg-slate-50")
  })
})
