export interface UnpaidInvoiceLike {
  id: string
  invoice_number?: string
  balance_due?: string | number | null
}

export function toCents(
  value: string | number | null | undefined,
): number | null {
  if (value === null || value === undefined) return null
  const str = String(value).trim()
  if (str === "") return null
  const match = /^([+-])?(?:(\d+)(?:\.(\d*))?|\.(\d+))$/.exec(str)
  if (!match) return null
  const sign = match[1] === "-" ? -1 : 1
  const whole = Number(match[2] ?? "0")
  const fracStr = match[3] ?? match[4] ?? ""
  const frac = fracStr.padEnd(2, "0").slice(0, 2)
  return sign * (whole * 100 + Number(frac))
}

export function formatCentsAsDecimal(cents: number): string {
  return (cents / 100).toFixed(2)
}

export function findExactMatchingUnpaidInvoice<T extends UnpaidInvoiceLike>(
  unpaidInvoices: ReadonlyArray<T>,
  amount: string | number | null | undefined,
): T | undefined {
  const targetCents = toCents(amount)
  if (targetCents === null || targetCents <= 0) return undefined
  return unpaidInvoices.find((inv) => toCents(inv.balance_due) === targetCents)
}

export type PaymentValidationResult =
  | { ok: true; amountCents: number; referenceNumber: string }
  | { ok: false; error: string }

export function validatePaymentSubmission(input: {
  clientId: string
  amount: string | number
  referenceNumber: string
}): PaymentValidationResult {
  if (!input.clientId) {
    return { ok: false, error: "Please select a client." }
  }
  const amountCents = toCents(input.amount)
  if (amountCents === null || amountCents <= 0) {
    return {
      ok: false,
      error: "Please enter a valid positive payment amount.",
    }
  }
  const trimmedRef = input.referenceNumber.trim()
  if (!trimmedRef) {
    return { ok: false, error: "Payment reference number is required." }
  }
  return {
    ok: true,
    amountCents,
    referenceNumber: trimmedRef,
  }
}

export function buildInitialAllocations(params: {
  allocateToInvoice: boolean
  targetInvoiceId: string
  amountCents: number
  unpaidInvoices: ReadonlyArray<UnpaidInvoiceLike>
}): Array<{ invoice_id: string; amount: string }> | undefined {
  if (!params.allocateToInvoice || !params.targetInvoiceId) {
    return undefined
  }
  const targetInvoice = params.unpaidInvoices.find(
    (inv) => inv.id === params.targetInvoiceId,
  )
  const balanceCents = toCents(targetInvoice?.balance_due)
  const cappedCents =
    balanceCents !== null && balanceCents > 0
      ? Math.min(params.amountCents, balanceCents)
      : params.amountCents

  return [
    {
      invoice_id: params.targetInvoiceId,
      amount: formatCentsAsDecimal(cappedCents),
    },
  ]
}
