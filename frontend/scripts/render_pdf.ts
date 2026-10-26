import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { chromium } from "@playwright/test"

async function main() {
  const args = process.argv.slice(2)
  let inputPath = ""
  let outputPath = ""

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--input" || args[i] === "-i") && args[i + 1]) {
      inputPath = args[i + 1]
      i++
    } else if ((args[i] === "--output" || args[i] === "-o") && args[i + 1]) {
      outputPath = args[i + 1]
      i++
    }
  }

  if (!inputPath || !outputPath) {
    console.error(
      "Usage: bun run render_pdf.ts --input <html_file> --output <pdf_file>",
    )
    process.exit(1)
  }

  const resolvedInput = resolve(inputPath)
  const resolvedOutput = resolve(outputPath)

  if (!existsSync(resolvedInput)) {
    console.error(`Input file not found: ${resolvedInput}`)
    process.exit(1)
  }

  const htmlContent = readFileSync(resolvedInput, "utf-8")

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  })

  try {
    const page = await browser.newPage()
    await page.setContent(htmlContent, { waitUntil: "networkidle" })
    await page.pdf({
      path: resolvedOutput,
      format: "A4",
      printBackground: true,
      margin: {
        top: "10mm",
        right: "12mm",
        bottom: "10mm",
        left: "12mm",
      },
    })
    console.log(`Successfully generated PDF: ${resolvedOutput}`)
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error("PDF generation failed:", err)
  process.exit(1)
})
