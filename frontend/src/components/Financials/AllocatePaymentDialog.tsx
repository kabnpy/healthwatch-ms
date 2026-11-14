import type React from "react"
import { useEffect, useMemo, useState } from "react"
import type { InvoicePublic, PaymentRecordPublic } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import useCustomToast from "@/hooks/useCustomToast"
import { useAllocatePayment } from "@/hooks/usePayments"

export interface AllocatePaymentDialogProps {
  record: PaymentRecordPublic | null
  invoices: InvoicePublic[]
  onOpenChange: (open: boolean) => void
}

function toCents(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const str = String(value).trim()
  if (str === "") return null
  const num = Number(str)
  if (!Number.isFinite(num)) return null
  return Math.round(num * 100)
}

function formatKesFromCents(cents: number): string {
  return (cents / 100).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function AllocatePaymentDialog({
  record,
  invoices,
  onOpenChange,
}: AllocatePaymentDialogProps) {
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const allocateMutation = useAllocatePayment()

  const [targetInvoiceId, setTargetInvoiceId] = useState("")
  const [amount, setAmount] = useState("")

  useEffect(() => {
    if (record) {
      setTargetInvoiceId("")
      setAmount(String(record.unallocated_amount || record.amount))
    }
  }, [record])

  const availableInvoices = useMemo(() => {
    if (!record) return []
    return invoices.filter(
      (inv) =>
        inv.client_id === record.client_id && Number(inv.balance_due || 0) > 0,
    )
  }, [invoices, record])

  const selectedInvoice = useMemo(
    () => availableInvoices.find((inv) => inv.id === targetInvoiceId) ?? null,
    [availableInvoices, targetInvoiceId],
  )

  const unallocatedCents = record
    ? (toCents(record.unallocated_amount || record.amount) ?? 0)
    : 0
  const invoiceBalanceCents = selectedInvoice
    ? (toCents(selectedInvoice.balance_due || 0) ?? 0)
    : null
  const amountCents = toCents(amount)

  const validationError = useMemo(() => {
    if (amountCents === null || amountCents <= 0) {
      return "Please enter a valid positive allocation amount."
    }
    if (amountCents > unallocatedCents) {
      return "Allocation amount cannot exceed available unallocated funds."
    }
    if (invoiceBalanceCents !== null && amountCents > invoiceBalanceCents) {
      return "Allocation amount cannot exceed invoice balance due."
    }
    return null
  }, [amountCents, unallocatedCents, invoiceBalanceCents])

  const effectiveAmountCents =
    amountCents !== null && amountCents > 0 ? amountCents : 0
  const remainingUnallocatedCents = unallocatedCents - effectiveAmountCents
  const remainingInvoiceCents =
    invoiceBalanceCents !== null
      ? invoiceBalanceCents - effectiveAmountCents
      : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!record || !targetInvoiceId) {
      showErrorToast("Please select an invoice to allocate to.")
      return
    }
    if (validationError || amountCents === null) {
      showErrorToast(
        validationError || "Please enter a valid positive allocation amount.",
      )
      return
    }

    try {
      await allocateMutation.mutateAsync({
        id: record.id,
        data: {
          payment_record_id: record.id,
          invoice_id: targetInvoiceId,
          amount: (amountCents / 100).toFixed(2) as any,
        },
      })
      onOpenChange(false)
      showSuccessToast("Payment funds allocated successfully.")
    } catch (err: any) {
      showErrorToast(err?.detail || err?.message || "Failed to allocate funds.")
    }
  }

  return (
    <Dialog open={!!record} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-base font-bold">
            Allocate Payment to Invoice
          </DialogTitle>
          <DialogDescription className="text-xs">
            Apply cleared unallocated funds to extinguish an open client
            balance.
          </DialogDescription>
        </DialogHeader>

        {record && (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="rounded-lg border p-3 bg-muted/20 text-xs space-y-1 font-mono">
              <div>
                <span className="text-muted-foreground">Payment Ref: </span>
                <span className="font-bold">
                  {record.reference_number || "NO-REF"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">
                  Available to Allocate:{" "}
                </span>
                <span className="font-bold text-amber-600">
                  KES{" "}
                  {Number(
                    record.unallocated_amount || record.amount,
                  ).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Select Open Invoice *
              </Label>
              {availableInvoices.length === 0 ? (
                <p className="text-xs text-rose-600 italic">
                  No open invoices with balance due found for this client.
                </p>
              ) : (
                <Select
                  value={targetInvoiceId}
                  onValueChange={(val) => {
                    setTargetInvoiceId(val)
                    const inv = availableInvoices.find((i) => i.id === val)
                    if (inv) {
                      const maxAvail = Number(
                        record.unallocated_amount || record.amount,
                      )
                      const due = Number(inv.balance_due || 0)
                      setAmount(String(Math.min(maxAvail, due)))
                    }
                  }}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Choose open invoice..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableInvoices.map((inv) => (
                      <SelectItem
                        key={inv.id}
                        value={inv.id}
                        className="text-xs"
                      >
                        <span className="font-mono font-bold mr-2">
                          {inv.invoice_number}
                        </span>
                        &bull; Due: KES{" "}
                        {Number(inv.balance_due).toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Allocation Amount (KES) *
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="font-mono text-xs tabular-nums text-right font-bold"
                aria-invalid={!!validationError}
                required
              />
              {validationError && (
                <p role="alert" className="text-xs text-rose-600 font-medium">
                  {validationError}
                </p>
              )}
            </div>

            <div
              data-testid="allocation-preview"
              className="rounded-lg border p-3 bg-muted/20 text-xs space-y-1.5 font-mono"
            >
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  Remaining Unallocated:
                </span>
                <span
                  className={
                    remainingUnallocatedCents < 0
                      ? "font-bold text-rose-600 tabular-nums"
                      : "font-bold tabular-nums"
                  }
                >
                  KES {formatKesFromCents(remainingUnallocatedCents)}
                </span>
              </div>
              {remainingInvoiceCents !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Remaining Invoice Balance:
                  </span>
                  <span
                    className={
                      remainingInvoiceCents < 0
                        ? "font-bold text-rose-600 tabular-nums"
                        : "font-bold tabular-nums"
                    }
                  >
                    KES {formatKesFromCents(remainingInvoiceCents)}
                  </span>
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={
                  allocateMutation.isPending ||
                  !targetInvoiceId ||
                  availableInvoices.length === 0 ||
                  !!validationError
                }
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
              >
                {allocateMutation.isPending
                  ? "Allocating..."
                  : "Post Allocation"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
