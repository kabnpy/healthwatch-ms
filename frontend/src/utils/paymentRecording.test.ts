import { describe, expect, it } from "vitest"
import {
  buildInitialAllocations,
  findExactMatchingUnpaidInvoice,
  formatCentsAsDecimal,
  toCents,
  validatePaymentSubmission,
} from "./paymentRecording"

describe("toCents", () => {
  it("parses decimal strings and numbers into integer cents", () => {
    expect(toCents("1500.00")).toBe(150000)
    expect(toCents(1500.5)).toBe(150050)
    expect(toCents("0.01")).toBe(1)
    expect(toCents(".50")).toBe(50)
    expect(toCents("")).toBeNull()
    expect(toCents(null)).toBeNull()
    expect(toCents(undefined)).toBeNull()
    expect(toCents("abc")).toBeNull()
  })
})

describe("formatCentsAsDecimal", () => {
  it("formats integer cents as a 2-decimal string", () => {
    expect(formatCentsAsDecimal(150000)).toBe("1500.00")
    expect(formatCentsAsDecimal(1)).toBe("0.01")
    expect(formatCentsAsDecimal(150050)).toBe("1500.50")
  })
})

describe("findExactMatchingUnpaidInvoice", () => {
  const invoices = [
    { id: "inv-1", invoice_number: "INV-001", balance_due: "1500.00" },
    { id: "inv-2", invoice_number: "INV-002", balance_due: "2500.50" },
    { id: "inv-3", invoice_number: "INV-003", balance_due: "100.01" },
  ]

  it("matches an unpaid invoice with exact integer-cents balance_due", () => {
    expect(findExactMatchingUnpaidInvoice(invoices, 2500.5)?.id).toBe("inv-2")
    expect(findExactMatchingUnpaidInvoice(invoices, "1500.00")?.id).toBe(
      "inv-1",
    )
  })

  it("does not match when amounts differ by 1 cent (no floating-point epsilon)", () => {
    expect(findExactMatchingUnpaidInvoice(invoices, "100.00")).toBeUndefined()
    expect(findExactMatchingUnpaidInvoice(invoices, 100.02)).toBeUndefined()
  })

  it("returns undefined for non-positive or invalid amounts", () => {
    expect(findExactMatchingUnpaidInvoice(invoices, 0)).toBeUndefined()
    expect(findExactMatchingUnpaidInvoice(invoices, -1500)).toBeUndefined()
    expect(findExactMatchingUnpaidInvoice(invoices, null)).toBeUndefined()
  })
})

describe("validatePaymentSubmission", () => {
  it("returns ok with amountCents and trimmed referenceNumber for valid input", () => {
    expect(
      validatePaymentSubmission({
        clientId: "client-1",
        amount: "1500.25",
        referenceNumber: "  MPESA123  ",
      }),
    ).toEqual({
      ok: true,
      amountCents: 150025,
      referenceNumber: "MPESA123",
    })
  })

  it("rejects missing clientId", () => {
    expect(
      validatePaymentSubmission({
        clientId: "",
        amount: "1500.00",
        referenceNumber: "MPESA123",
      }),
    ).toEqual({
      ok: false,
      error: "Please select a client.",
    })
  })

  it("rejects non-positive or invalid amounts", () => {
    expect(
      validatePaymentSubmission({
        clientId: "client-1",
        amount: "0",
        referenceNumber: "MPESA123",
      }),
    ).toEqual({
      ok: false,
      error: "Please enter a valid positive payment amount.",
    })
    expect(
      validatePaymentSubmission({
        clientId: "client-1",
        amount: "-10.00",
        referenceNumber: "MPESA123",
      }),
    ).toEqual({
      ok: false,
      error: "Please enter a valid positive payment amount.",
    })
    expect(
      validatePaymentSubmission({
        clientId: "client-1",
        amount: "abc",
        referenceNumber: "MPESA123",
      }),
    ).toEqual({
      ok: false,
      error: "Please enter a valid positive payment amount.",
    })
  })

  it("rejects blank referenceNumber", () => {
    expect(
      validatePaymentSubmission({
        clientId: "client-1",
        amount: "1500.00",
        referenceNumber: "   ",
      }),
    ).toEqual({
      ok: false,
      error: "Payment reference number is required.",
    })
  })
})

describe("buildInitialAllocations", () => {
  const unpaidInvoices = [
    { id: "inv-1", balance_due: "1500.00" },
    { id: "inv-2", balance_due: "750.25" },
  ]

  it("returns undefined when allocation is disabled or targetInvoiceId is empty", () => {
    expect(
      buildInitialAllocations({
        allocateToInvoice: false,
        targetInvoiceId: "inv-1",
        amountCents: 150000,
        unpaidInvoices,
      }),
    ).toBeUndefined()

    expect(
      buildInitialAllocations({
        allocateToInvoice: true,
        targetInvoiceId: "",
        amountCents: 150000,
        unpaidInvoices,
      }),
    ).toBeUndefined()
  })

  it("caps initial allocation to the invoice balance_due in integer cents", () => {
    expect(
      buildInitialAllocations({
        allocateToInvoice: true,
        targetInvoiceId: "inv-2",
        amountCents: 100000,
        unpaidInvoices,
      }),
    ).toEqual([{ invoice_id: "inv-2", amount: "750.25" }])
  })

  it("uses the payment amount when it is less than or equal to balance_due", () => {
    expect(
      buildInitialAllocations({
        allocateToInvoice: true,
        targetInvoiceId: "inv-1",
        amountCents: 50000,
        unpaidInvoices,
      }),
    ).toEqual([{ invoice_id: "inv-1", amount: "500.00" }])
  })
})
