import type { ColumnDef } from "@tanstack/react-table"
import { useMemo, useState } from "react"
import type { PaymentAllocationPublic } from "@/client"
import { DataTable } from "@/components/Common/DataTable"
import { QueryErrorBanner } from "@/components/Common/QueryErrorBanner"
import {
  LedgerReversalDialog,
  type LedgerReversalTarget,
} from "@/components/Financials/LedgerReversalDialog"
import {
  formatStatusLabel,
  RowReverseMenu,
} from "@/components/Financials/ledgerUtils"
import PendingItems from "@/components/Pending/PendingItems"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { usePaymentAllocations } from "@/hooks/usePayments"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/utils"

function getAllocationColumns(opts: {
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

export function AllocationsTab({ searchTerm }: { searchTerm: string }) {
  const {
    data: allocationsData,
    isLoading,
    isError,
    refetch,
  } = usePaymentAllocations(undefined, undefined, 0, 200)

  const [reversalTarget, setReversalTarget] =
    useState<LedgerReversalTarget | null>(null)

  const allocations = allocationsData?.data || []

  const filteredAllocations = useMemo(() => {
    if (!searchTerm.trim()) return allocations
    const term = searchTerm.toLowerCase()
    return allocations.filter((a) => {
      return (
        a.invoice_id.toLowerCase().includes(term) ||
        a.payment_record_id.toLowerCase().includes(term) ||
        (a.reversal_reason || "").toLowerCase().includes(term)
      )
    })
  }, [allocations, searchTerm])

  const columns = useMemo(
    () => getAllocationColumns({ onReverse: setReversalTarget }),
    [],
  )

  if (isLoading) return <PendingItems />

  if (isError) {
    return (
      <QueryErrorBanner
        message="Failed to load allocations. Please try again."
        onRetry={() => void refetch()}
      />
    )
  }

  return (
    <>
      <Card>
        <CardContent className="p-4">
          <div className="hidden md:block">
            <DataTable
              columns={columns}
              data={filteredAllocations}
              hideSearch
            />
          </div>
          <div
            className="flex flex-col gap-3 md:hidden"
            data-testid="allocations-mobile-cards"
          >
            {filteredAllocations.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-6">
                No allocations found.
              </p>
            ) : (
              filteredAllocations.map((a) => {
                const isReversed = a.status?.toLowerCase() === "reversed"
                return (
                  <div
                    key={a.id}
                    className="rounded-lg border p-3 space-y-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-mono text-muted-foreground">
                        {a.allocated_at
                          ? new Date(a.allocated_at).toLocaleDateString()
                          : "—"}
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-bold px-1.5 py-0 shrink-0",
                          isReversed
                            ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20"
                            : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
                        )}
                      >
                        {formatStatusLabel(a.status)}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-mono text-[11px] text-muted-foreground">
                        Pay {a.payment_record_id.substring(0, 8)} → Inv{" "}
                        {a.invoice_id.substring(0, 8)}
                      </div>
                      <div className="text-right font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                        +{formatCurrency(a.amount)}
                      </div>
                    </div>
                    {!isReversed && (
                      <div className="flex justify-end pt-1 border-t">
                        <RowReverseMenu
                          onReverse={() =>
                            setReversalTarget({
                              type: "allocation",
                              id: a.id,
                              title: `Allocation ${a.id.substring(0, 8)} (${formatCurrency(a.amount)})`,
                            })
                          }
                        />
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>

      <LedgerReversalDialog
        target={reversalTarget}
        onOpenChange={(open) => !open && setReversalTarget(null)}
      />
    </>
  )
}
