import { describe, expect, it } from "vitest"
import { parsePaymentConfirmation } from "./paymentParser"

describe("parsePaymentConfirmation", () => {
  it("parses standard Safaricom M-Pesa receipt SMS", () => {
    const raw =
      "RKA91H2K8M Confirmed. Ksh48,500.00 received from JOHN DOE 0712345678 on 18/10/26 at 2:45 PM. New M-PESA balance is Ksh150,000.00. Transaction cost, Ksh0.00."

    const result = parsePaymentConfirmation(raw)
    expect(result).not.toBeNull()
    expect(result?.reference).toBe("RKA91H2K8M")
    expect(result?.amount).toBe(48500)
    expect(result?.payerName).toBe("JOHN DOE")
    expect(result?.payerPhone).toBe("0712345678")
    expect(result?.paymentDate).toBe("2026-10-18")
    expect(result?.paymentMethod).toBe("mpesa")
  })

  it("parses M-Pesa notification with 4-digit year", () => {
    const raw =
      "QGH7392819 Confirmed. You have received Ksh 113,046.00 from MARY WANJIKU on 15/10/2026 at 11:15 AM."

    const result = parsePaymentConfirmation(raw)
    expect(result).not.toBeNull()
    expect(result?.reference).toBe("QGH7392819")
    expect(result?.amount).toBe(113046)
    expect(result?.payerName).toBe("MARY WANJIKU")
    expect(result?.paymentDate).toBe("2026-10-15")
    expect(result?.paymentMethod).toBe("mpesa")
  })

  it("parses Bank RTGS/EFT confirmation string", () => {
    const raw =
      "EFT Ref: NCBA/RTGS/2026/90124 Amount: KES 145,000.00 Payer: Rift Valley Hauliers Ltd Date: 2026-10-18"

    const result = parsePaymentConfirmation(raw)
    expect(result).not.toBeNull()
    expect(result?.reference).toBe("NCBA/RTGS/2026/90124")
    expect(result?.amount).toBe(145000)
    expect(result?.paymentDate).toBe("2026-10-18")
    expect(result?.paymentMethod).toBe("bank_transfer")
  })

  it("returns null on arbitrary unrecognized text", () => {
    const raw =
      "Meeting with underwriter tomorrow at 10 AM regarding motor terms."
    expect(parsePaymentConfirmation(raw)).toBeNull()
  })
})
