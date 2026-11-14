import { Link } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal } from "lucide-react"
import type {
  InvoicePublic,
  PaymentAllocationPublic,
  PaymentRecordPublic,
} from "@/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/utils"
import type { LedgerReversalTarget } from "./LedgerReversalDialog"

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

export function getPaymentColumns(opts: {
  clientMap: Map<string, string>
  onAllocate: (payment: PaymentRecordPublic) => void
  onReverse: (target: LedgerReversalTarget) => void
}): ColumnDef<PaymentRecordPublic>[] {
  return [
    {
      accessorKey: "payment_date",
      header: "Date",
      cell: ({ row }) => (
        <span className="font-mono text-muted-foreground whitespace-nowrap">
          {row.original.payment_date}
        </span>
      ),
    },
    {
      accessorKey: "reference_number",
      header: "Reference",
      cell: ({ row }) => (
        <span className="font-mono font-bold whitespace-nowrap">
          {row.original.reference_number || "NO-REF"}
        </span>
      ),
    },
    {
      id: "client_name",
      header: "Client",
      accessorFn: (row) => opts.clientMap.get(row.client_id) || "Client",
      cell: ({ row, getValue }) => (
        <Link
          to="/clients/$clientId/overview"
          params={{ clientId: row.original.client_id }}
          className="font-medium text-primary hover:underline block max-w-[180px] truncate"
        >
          {getValue<string>()}
        </Link>
      ),
    },
    {
      accessorKey: "payment_method",
      header: "Channel",
      cell: ({ row }) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-muted border">
          {formatPaymentChannel(row.original.payment_method)}
        </span>
      ),
    },
    {
      accessorKey: "amount",
      header: () => <div className="text-right">Amount</div>,
      cell: ({ row }) => (
        <div className="text-right font-mono tabular-nums font-bold text-foreground whitespace-nowrap">
          {formatCurrency(row.original.amount)}
        </div>
      ),
    },
    {
      accessorKey: "unallocated_amount",
      header: () => <div className="text-right">Unallocated</div>,
      cell: ({ row }) => {
        const unalloc = Number(row.original.unallocated_amount || 0)
        return (
          <div className="text-right font-mono tabular-nums">
            {unalloc > 0 ? (
              <span className="text-amber-600 dark:text-amber-400 font-bold">
                {formatCurrency(unalloc)}
              </span>
            ) : (
              <span className="text-muted-foreground">KES 0.00</span>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "status",
      header: () => <div className="text-center">Status</div>,
      cell: ({ row }) => {
        const isReversed = row.original.status?.toLowerCase() === "reversed"
        return (
          <div className="text-center">
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-bold px-1.5 py-0",
                isReversed
                  ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20"
                  : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
              )}
            >
              {formatStatusLabel(row.original.status || "active")}
            </Badge>
          </div>
        )
      },
    },
    {
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const p = row.original
        const unalloc = Number(p.unallocated_amount || 0)
        const isReversed = p.status?.toLowerCase() === "reversed"
        return (
          <div className="flex items-center justify-end gap-1.5">
            {!isReversed && unalloc > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => opts.onAllocate(p)}
                className="h-7 text-[11px] px-2 cursor-pointer"
              >
                Allocate
              </Button>
            )}
            {!isReversed && (
              <RowReverseMenu
                onReverse={() =>
                  opts.onReverse({
                    type: "payment",
                    id: p.id,
                    title: `Payment ${p.reference_number || p.id.substring(0, 8)}`,
                  })
                }
              />
            )}
          </div>
        )
      },
    },
  ]
}

export function getInvoiceColumns(opts: {
  clientMap: Map<string, string>
}): ColumnDef<InvoicePublic>[] {
  return [
    {
      accessorKey: "invoice_number",
      header: "Invoice Number",
      cell: ({ row }) => (
        <span className="font-mono font-bold text-primary">
          {row.original.invoice_number}
        </span>
      ),
    },
    {
      id: "client_name",
      header: "Client",
      accessorFn: (row) => opts.clientMap.get(row.client_id) || "Client",
      cell: ({ row, getValue }) => (
        <Link
          to="/clients/$clientId/overview"
          params={{ clientId: row.original.client_id }}
          className="font-medium text-primary hover:underline block max-w-[180px] truncate"
        >
          {getValue<string>()}
        </Link>
      ),
    },
    {
      accessorKey: "date_issued",
      header: "Issue Date",
      cell: ({ row }) => (
        <span className="font-mono text-muted-foreground">
          {row.original.date_issued}
        </span>
      ),
    },
    {
      accessorKey: "due_date",
      header: "Due Date",
      cell: ({ row }) => (
        <span className="font-mono text-muted-foreground">
          {row.original.due_date || "—"}
        </span>
      ),
    },
    {
      accessorKey: "total_amount",
      header: () => <div className="text-right">Total Invoiced</div>,
      cell: ({ row }) => (
        <div className="text-right font-mono tabular-nums font-semibold">
          {formatCurrency(row.original.total_amount)}
        </div>
      ),
    },
    {
      accessorKey: "balance_due",
      header: () => <div className="text-right">Balance Due</div>,
      cell: ({ row }) => {
        const balDue = Number(row.original.balance_due || 0)
        return (
          <div className="text-right font-mono tabular-nums font-bold">
            {balDue > 0 ? (
              <span className="text-rose-600 dark:text-rose-400">
                {formatCurrency(balDue)}
              </span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400">
                Settled
              </span>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "status",
      header: () => <div className="text-center">Status</div>,
      cell: ({ row }) => {
        const balDue = Number(row.original.balance_due || 0)
        return (
          <div className="text-center">
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-bold px-1.5 py-0",
                balDue === 0
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
              )}
            >
              {formatStatusLabel(row.original.status)}
            </Badge>
          </div>
        )
      },
    },
    {
      id: "action",
      header: () => <div className="text-right">Action</div>,
      cell: ({ row }) => (
        <div className="text-right">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px] px-2.5"
            render={
              <Link
                to="/clients/$clientId/invoices"
                params={{ clientId: row.original.client_id }}
              >
                View File &rarr;
              </Link>
            }
          />
        </div>
      ),
    },
  ]
}

export function getAllocationColumns(opts: {
  onReverse: (target: LedgerReversalTarget) => void
}): ColumnDef<PaymentAllocationPublic>[] {
  return [
    {
      accessorKey: "allocated_at",
      header: "Allocated At",
      cell: ({ row }) => (
        <span className="font-mono text-muted-foreground">
          {row.original.allocated_at
            ? new Date(row.original.allocated_at).toLocaleDateString()
            : "—"}
        </span>
      ),
    },
    {
      accessorKey: "payment_record_id",
      header: "Payment Record ID",
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {row.original.payment_record_id.substring(0, 8)}...
        </span>
      ),
    },
    {
      accessorKey: "invoice_id",
      header: "Target Invoice ID",
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {row.original.invoice_id.substring(0, 8)}...
        </span>
      ),
    },
    {
      accessorKey: "amount",
      header: () => <div className="text-right">Amount Allocated</div>,
      cell: ({ row }) => (
        <div className="text-right font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
          +{formatCurrency(row.original.amount)}
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: () => <div className="text-center">Status</div>,
      cell: ({ row }) => {
        const isReversed = row.original.status?.toLowerCase() === "reversed"
        return (
          <div className="text-center">
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-bold px-1.5 py-0",
                isReversed
                  ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20"
                  : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
              )}
            >
              {formatStatusLabel(row.original.status)}
            </Badge>
          </div>
        )
      },
    },
    {
      accessorKey: "reversal_reason",
      header: "Audit / Reversal Notes",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs max-w-xs truncate block">
          {row.original.reversal_reason || "Standard payment allocation"}
        </span>
      ),
    },
    {
      id: "action",
      header: () => <div className="text-right">Action</div>,
      cell: ({ row }) => {
        const a = row.original
        const isReversed = a.status?.toLowerCase() === "reversed"
        return (
          <div className="flex justify-end">
            {!isReversed && (
              <RowReverseMenu
                onReverse={() =>
                  opts.onReverse({
                    type: "allocation",
                    id: a.id,
                    title: `Allocation ${a.id.substring(0, 8)} (${formatCurrency(a.amount)})`,
                  })
                }
              />
            )}
          </div>
        )
      },
    },
  ]
}
