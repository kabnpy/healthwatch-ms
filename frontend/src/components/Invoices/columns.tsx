import type { ColumnDef } from "@tanstack/react-table"
import { Copy, Eye, MoreHorizontal, ReceiptText } from "lucide-react"
import { toast } from "sonner"

import type { InvoicePublic } from "@/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export const getColumns = (
  onView: (invoice: InvoicePublic) => void,
  onViewHistory?: (invoice: InvoicePublic) => void,
): ColumnDef<InvoicePublic>[] => [
  {
    accessorKey: "invoice_number",
    header: "Invoice #",
    cell: ({ row }) => (
      <button
        type="button"
        onClick={() => onView(row.original)}
        className="font-mono font-medium text-primary hover:underline flex items-center gap-2"
      >
        <ReceiptText className="size-3 opacity-50" />
        {row.original.invoice_number}
      </button>
    ),
  },
  {
    accessorKey: "date_issued",
    header: "Date Issued",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.status
      return (
        <Badge
          variant={
            status === "Paid"
              ? "default"
              : status === "Partial"
                ? "secondary"
                : "outline"
          }
        >
          {status}
        </Badge>
      )
    },
  },
  {
    accessorKey: "total_amount",
    header: "Total Amount",
    cell: ({ row }) => (
      <span className="font-bold">
        KES{" "}
        {Number(row.original.total_amount || 0).toLocaleString(undefined, {
          minimumFractionDigits: 2,
        })}
      </span>
    ),
  },
  {
    accessorKey: "balance_due",
    header: "Balance Due",
    cell: ({ row }) => {
      const balance = Number(row.original.balance_due || 0)
      return (
        <span
          className={
            balance > 0 ? "text-destructive font-bold" : "text-green-600"
          }
        >
          KES{" "}
          {balance.toLocaleString(undefined, {
            minimumFractionDigits: 2,
          })}
        </span>
      )
    },
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => {
      const invoice = row.original

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
                navigator.clipboard.writeText(invoice.id)
                toast.success("Invoice ID copied to clipboard")
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onView(invoice)}>
              <Eye className="mr-2 h-4 w-4" />
              View Invoice
            </DropdownMenuItem>
            {onViewHistory && (
              <DropdownMenuItem onClick={() => onViewHistory(invoice)}>
                <ReceiptText className="mr-2 h-4 w-4" />
                View Payment History
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
