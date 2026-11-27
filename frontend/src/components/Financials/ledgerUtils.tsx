import { MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function RowReverseMenu({ onReverse }: { onReverse: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="icon"
            variant="ghost"
            aria-label="Row actions"
            className="h-7 w-7 cursor-pointer"
          />
        }
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={onReverse}
          className="text-rose-600 focus:text-rose-700 cursor-pointer"
        >
          Reverse
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const PAYMENT_CHANNEL_LABELS: Record<string, string> = {
  MPESA: "M-Pesa",
  BANK_TRANSFER: "Bank Transfer",
  CHEQUE: "Cheque",
  IPF: "IPF",
  CASH: "Cash",
}

export function formatPaymentChannel(
  method: string | null | undefined,
): string {
  if (!method) return "—"
  const upper = method.toUpperCase()
  if (PAYMENT_CHANNEL_LABELS[upper]) return PAYMENT_CHANNEL_LABELS[upper]
  return method
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function formatStatusLabel(status: string | null | undefined): string {
  if (!status) return "Active"
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
