import { ShieldAlert } from "lucide-react"
import type React from "react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import useCustomToast from "@/hooks/useCustomToast"
import {
  useReversePaymentAllocation,
  useReversePaymentRecord,
} from "@/hooks/usePayments"

export interface LedgerReversalTarget {
  type: "payment" | "allocation"
  id: string
  title: string
}

export interface LedgerReversalDialogProps {
  target: LedgerReversalTarget | null
  onOpenChange: (open: boolean) => void
}

export function LedgerReversalDialog({
  target,
  onOpenChange,
}: LedgerReversalDialogProps) {
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const reversePaymentMutation = useReversePaymentRecord()
  const reverseAllocMutation = useReversePaymentAllocation()

  const [reason, setReason] = useState("")

  useEffect(() => {
    if (target) {
      setReason("")
    }
  }, [target])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!target || !reason.trim()) {
      showErrorToast("A justification reason is required for ledger reversal.")
      return
    }

    try {
      if (target.type === "payment") {
        await reversePaymentMutation.mutateAsync({
          id: target.id,
          data: { reversal_reason: reason.trim() },
        })
      } else {
        await reverseAllocMutation.mutateAsync({
          id: target.id,
          data: { reversal_reason: reason.trim() },
        })
      }
      setReason("")
      onOpenChange(false)
      showSuccessToast("Reversal successfully recorded in audit ledger.")
    } catch (err: any) {
      showErrorToast(
        err?.detail || err?.message || "Failed to execute reversal.",
      )
    }
  }

  const isPending =
    reversePaymentMutation.isPending || reverseAllocMutation.isPending

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-rose-600" />
            <DialogTitle className="text-base font-bold text-rose-600">
              Authorized Ledger Reversal
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Reversing is an append-only accounting action. It voids this
            financial transaction and restores all linked ledger balances.
          </DialogDescription>
        </DialogHeader>

        {target && (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 text-xs">
              <span className="font-semibold text-rose-700 dark:text-rose-400">
                Target:{" "}
              </span>
              <span className="font-mono font-bold">{target.title}</span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Reversal Justification Reason *
              </Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Client bounce back, duplicate deposit entry, or bank dispute..."
                rows={3}
                className="text-xs"
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
                disabled={!reason.trim() || isPending}
                className="text-xs bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
              >
                {isPending ? "Reversing..." : "Confirm Reversal"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
