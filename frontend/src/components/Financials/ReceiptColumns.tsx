import type { ColumnDef } from "@tanstack/react-table"
import { Copy, Eye, MoreHorizontal, ReceiptText } from "lucide-react"
import { toast } from "sonner"

import type { ReceiptPublic } from "@/client"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { StatusIndicator } from "../Common/StatusIndicator"

export const getReceiptColumns = (
  onAllocate: (receipt: ReceiptPublic) => void,
  onViewHistory: (receipt: ReceiptPublic) => void,
  onVoid: (receipt: ReceiptPublic) => void,
  onView: (receipt: ReceiptPublic) => void,
): ColumnDef<ReceiptPublic>[] => [
  {
    accessorKey: "receipt_number",
    header: "Receipt #",
    cell: ({ row }) => (
      <button
        type="button"
        onClick={() => onView(row.original)}
        className="flex flex-col gap-1 text-left hover:underline text-primary"
      >
        <span className="font-mono font-medium">
          {row.original.receipt_number}
        </span>
        <StatusIndicator
          isActive={row.original.status === "Active"}
          label={row.original.status}
        />
      </button>
    ),
  },

  {
    accessorKey: "date_received",
    header: "Date",
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-bold text-sm">
          KES{" "}
          {Number(row.original.amount).toLocaleString(undefined, {
            minimumFractionDigits: 2,
          })}
        </span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-tighter">
          Unallocated: KES{" "}
          {Number(
            (row.original as any).unallocated_amount || 0,
          ).toLocaleString()}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "mode",
    header: "Method",
  },
  {
    accessorKey: "reference",
    header: "Reference",
    cell: ({ row }) => (
      <span className="text-muted-foreground text-xs">
        {row.original.reference}
      </span>
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const receipt = row.original

      return (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => {
                navigator.clipboard.writeText(receipt.id)
                toast.success("Receipt ID copied to clipboard")
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onView(receipt)}>
              <Eye className="mr-2 h-4 w-4" />
              View Receipt
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onAllocate(receipt)}
              disabled={(receipt as any).unallocated_amount <= 0}
            >
              <ReceiptText className="mr-2 h-4 w-4" />
              Allocate to Invoice
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onViewHistory(receipt)}>
              <MoreHorizontal className="mr-2 h-4 w-4" />
              View Allocation History
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onVoid(receipt)}
              disabled={receipt.status === "Voided"}
              className="text-destructive focus:text-destructive"
            >
              <ReceiptText className="mr-2 h-4 w-4" />
              Void Receipt
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
