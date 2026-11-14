import { describe, expect, it } from "vitest"
import { formatCurrency } from "./utils"

describe("formatCurrency", () => {
  it("formats numbers as KES with 2 decimal places", () => {
    expect(formatCurrency(3500000)).toBe("KES 3,500,000.00")
    expect(formatCurrency(0)).toBe("KES 0.00")
    expect(formatCurrency("1250.5")).toBe("KES 1,250.50")
  })

  it("formats null, undefined, and NaN as KES 0.00", () => {
    expect(formatCurrency(null)).toBe("KES 0.00")
    expect(formatCurrency(undefined)).toBe("KES 0.00")
    expect(formatCurrency("not-a-number")).toBe("KES 0.00")
  })
})
