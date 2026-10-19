/**
 * Payment Parser Utility
 * Extracts structured financial metadata from raw payment confirmation text,
 * primarily Safaricom M-Pesa messages and bank RTGS/EFT confirmation advice.
 */

import type { PaymentMethod } from "@/client"

export interface ParsedPayment {
  reference: string
  amount: number | null
  payerName: string | null
  payerPhone: string | null
  paymentDate: string | null // YYYY-MM-DD
  paymentMethod: PaymentMethod
  rawText: string
}

/**
 * Clean numeric string and convert to number
 */
function cleanAmount(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").trim()
  const parsed = Number.parseFloat(cleaned)
  return Number.isNaN(parsed) ? null : parsed
}

/**
 * Format DD/MM/YY or DD/MM/YYYY to YYYY-MM-DD
 */
function normalizeDate(rawDate: string): string | null {
  try {
    const parts = rawDate.split(/[/.-]/)
    if (parts.length === 3) {
      const day = Number.parseInt(parts[0], 10)
      const month = Number.parseInt(parts[1], 10)
      let year = Number.parseInt(parts[2], 10)

      if (year < 100) {
        year += 2000
      }

      if (day > 0 && day <= 31 && month > 0 && month <= 12) {
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      }
    }
  } catch {
    // Ignore date parse errors
  }
  return null
}

export function parsePaymentConfirmation(text: string): ParsedPayment | null {
  if (!text || typeof text !== "string") return null
  const trimmed = text.trim()
  if (trimmed.length < 10) return null

  // 1. Match Safaricom M-Pesa Standard Receipt format:
  // e.g. "RKA91H2K8M Confirmed. Ksh48,500.00 received from JOHN DOE 0712345678 on 18/10/26 at 2:45 PM"
  // or "RKA91H2K8M Confirmed. You have received Ksh 48,500.00 from JOHN DOE 254712345678 on 18/10/2026"
  const mpesaRefMatch = trimmed.match(/^([A-Z0-9]{10})\s+Confirmed\./i)
  if (mpesaRefMatch) {
    const reference = mpesaRefMatch[1].toUpperCase()

    // Amount: Ksh48,500.00 or Ksh 48,500.00
    const amountMatch = trimmed.match(/Ksh\.?\s*([0-9,]+(?:\.[0-9]{2})?)/i)
    const amount = amountMatch ? cleanAmount(amountMatch[1]) : null

    // Date: on 18/10/26 or on 18/10/2026
    const dateMatch = trimmed.match(/\bon\s+(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/i)
    const paymentDate = dateMatch
      ? normalizeDate(dateMatch[1])
      : new Date().toISOString().split("T")[0]

    // Phone: 07XXXXXXXX or 2547XXXXXXXX or +2547XXXXXXXX
    const phoneMatch = trimmed.match(/\b(?:\+?254|0)(7\d{8}|1\d{8})\b/)
    const payerPhone = phoneMatch ? phoneMatch[0] : null

    // Payer Name: between "received from" / "from" and phone/date
    let payerName: string | null = null
    const fromMatch = trimmed.match(
      /(?:received\s+from|from)\s+([A-Z\s'.]+?)(?=\s+(?:\+?254|07|01|\bon\b))/i,
    )
    if (fromMatch) {
      payerName = fromMatch[1].trim()
    } else {
      // Fallback: look after "from" up to "on"
      const fallbackFrom = trimmed.match(
        /(?:received\s+from|from)\s+([A-Z\s'.]+?)(?=\s+on\s+)/i,
      )
      if (fallbackFrom) {
        payerName = fallbackFrom[1]
          .replace(/\b(?:\+?254|0)(7\d{8}|1\d{8})\b/, "")
          .trim()
      }
    }

    return {
      reference,
      amount,
      payerName: payerName || null,
      payerPhone,
      paymentDate: paymentDate || new Date().toISOString().split("T")[0],
      paymentMethod: "mpesa",
      rawText: trimmed,
    }
  }

  // 2. Match Bank RTGS / EFT format:
  // e.g. "EFT Ref: NCBA/RTGS/2026/90124 Amount: KES 145,000.00 Payer: Rift Valley Hauliers Ltd Date: 2026-10-18"
  const bankRefMatch = trimmed.match(
    /(?:EFT Ref|RTGS Ref|Ref|Reference)[:\s]+([A-Za-z0-9/-]+)/i,
  )
  const bankAmountMatch = trimmed.match(
    /(?:KES|KSH|Amount)[:\s]+([0-9,]+(?:\.[0-9]{2})?)/i,
  )

  if (bankRefMatch && bankAmountMatch) {
    const rawDateMatch = trimmed.match(
      /(?:Date[:\s]+)?(\d{4}-\d{2}-\d{2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/,
    )
    const rawDate = rawDateMatch ? rawDateMatch[1] : null
    const paymentDate = rawDate
      ? rawDate.includes("-") && rawDate.length === 10
        ? rawDate
        : normalizeDate(rawDate)
      : new Date().toISOString().split("T")[0]

    const payerMatch = trimmed.match(
      /Payer[:\s]+([A-Za-z0-9\s'.]+?)(?=(?:\s+Date|\s+Amount|$))/i,
    )

    return {
      reference: bankRefMatch[1].trim(),
      amount: cleanAmount(bankAmountMatch[1]),
      payerName: payerMatch ? payerMatch[1].trim() : null,
      payerPhone: null,
      paymentDate: paymentDate || new Date().toISOString().split("T")[0],
      paymentMethod: "bank_transfer",
      rawText: trimmed,
    }
  }

  return null
}
