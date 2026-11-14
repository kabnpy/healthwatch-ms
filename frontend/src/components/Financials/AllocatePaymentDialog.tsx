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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!record || !targetInvoiceId) {
      showErrorToast("Please select an invoice to allocate to.")
      return
    }
    const parsed = parseFloat(amount)
    if (Number.isNaN(parsed) || parsed <= 0) {
      showErrorToast("Please enter a valid positive allocation amount.")
      return
    }

    try {
      await allocateMutation.mutateAsync({
        id: record.id,
        data: {
          payment_record_id: record.id,
          invoice_id: targetInvoiceId,
          amount: parsed.toFixed(2) as any,
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
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="font-mono text-xs tabular-nums text-right font-bold"
                required
              />
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
                  availableInvoices.length === 0
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
