// @vitest-environment jsdom
import fs from "node:fs"
import path from "node:path"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { FileUploadZone } from "./FileUploadZone"

function collectTsxFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === "ui") continue
      files.push(...collectTsxFiles(fullPath))
    } else if (
      entry.isFile() &&
      entry.name.endsWith(".tsx") &&
      !entry.name.endsWith(".test.tsx")
    ) {
      files.push(fullPath)
    }
  }
  return files
}

describe("Icon button accessibility", () => {
  it("FileUploadZone clear button has an accessible name", () => {
    const file = new File(["hello"], "test.pdf", { type: "application/pdf" })
    render(<FileUploadZone selectedFile={file} onFileSelect={vi.fn()} />)
    expect(
      screen.getByRole("button", { name: /remove selected file/i }),
    ).toBeTruthy()
  })

  it('every size="icon" button in src/ has an aria-label or sr-only text', () => {
    const srcDir = path.resolve(__dirname, "../..")
    const files = collectTsxFiles(srcDir)
    const violations: string[] = []

    for (const file of files) {
      const content = fs.readFileSync(file, "utf8")
      const lines = content.split("\n")
      lines.forEach((line, idx) => {
        if (!line.includes('size="icon"')) return
        // Check a window of lines around the Button opening tag and its children
        const windowStart = Math.max(0, idx - 5)
        const windowEnd = Math.min(lines.length, idx + 8)
        const snippet = lines.slice(windowStart, windowEnd).join("\n")
        if (!snippet.includes("aria-label") && !snippet.includes("sr-only")) {
          violations.push(`${path.relative(srcDir, file)}:${idx + 1}`)
        }
      })
    }

    expect(violations).toEqual([])
  })
})
