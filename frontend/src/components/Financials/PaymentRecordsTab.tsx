import { Link } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import { useMemo, useState } from "react"
import type { PaymentRecordPublic } from "@/client"
import { DataTable } from "@/components/Common/DataTable"
import { QueryErrorBanner } from "@/components/Common/QueryErrorBanner"
import { AllocatePaymentDialog } from "@/components/Financials/AllocatePaymentDialog"
import {
  LedgerReversalDialog,
  type LedgerReversalTarget,
} from "@/components/Financials/LedgerReversalDialog"
import {
  formatPaymentChannel,
  formatStatusLabel,
  RowReverseMenu,
} from "@/components/Financials/ledgerUtils"
import PendingItems from "@/components/Pending/PendingItems"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useInvoices } from "@/hooks/useFinancials"
import { usePaymentRecords } from "@/hooks/usePayments"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/utils"

function getPaymentColumns(opts: {
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
          to="/clients/$clientId/policies"
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
        if (isReversed) return null
        return (
          <div className="flex items-center justify-end gap-1.5">
            {unalloc > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => opts.onAllocate(p)}
                className="h-7 text-[11px] px-2 cursor-pointer"
              >
                Allocate
              </Button>
            )}
            <RowReverseMenu
              onReverse={() =>
                opts.onReverse({
                  type: "payment",
                  id: p.id,
                  title: `Payment ${p.reference_number || p.id.substring(0, 8)}`,
                })
              }
            />
          </div>
        )
      },
    },
  ]
}

function AllocatePaymentDialogWithInvoices({
  record,
  onOpenChange,
}: {
  record: PaymentRecordPublic
  onOpenChange: (open: boolean) => void
}) {
  const { data: invoicesData } = useInvoices(undefined, 0, 200)
  return (
    <AllocatePaymentDialog
      record={record}
      invoices={invoicesData?.data || []}
      onOpenChange={onOpenChange}
    />
  )
}

export function PaymentRecordsTab({
  searchTerm,
  clientMap,
}: {
  searchTerm: string
  clientMap: Map<string, string>
}) {
  const {
    data: paymentsData,
    isLoading,
    isError,
    refetch,
  } = usePaymentRecords(undefined, 0, 200)

  const [selectedRecordForAlloc, setSelectedRecordForAlloc] =
    useState<PaymentRecordPublic | null>(null)
  const [reversalTarget, setReversalTarget] =
    useState<LedgerReversalTarget | null>(null)

  const payments = paymentsData?.data || []

  const filteredPayments = useMemo(() => {
    if (!searchTerm.trim()) return payments
    const term = searchTerm.toLowerCase()
    return payments.filter((p) => {
      const clientName = clientMap.get(p.client_id)?.toLowerCase() || ""
      const ref = (p.reference_number || "").toLowerCase()
      const method = (p.payment_method || "").toLowerCase()
      const payer = (p.payer_name || "").toLowerCase()
      return (
        clientName.includes(term) ||
        ref.includes(term) ||
        method.includes(term) ||
        payer.includes(term)
      )
    })
  }, [payments, searchTerm, clientMap])

  const columns = useMemo(
    () =>
      getPaymentColumns({
        clientMap,
        onAllocate: setSelectedRecordForAlloc,
        onReverse: setReversalTarget,
      }),
    [clientMap],
  )

  if (isLoading) return <PendingItems />

  if (isError) {
    return (
      <QueryErrorBanner
        message="Failed to load payment records. Please try again."
        onRetry={() => void refetch()}
      />
    )
  }

  return (
    <>
      <Card>
        <CardContent className="p-4">
          <div className="hidden md:block">
            <DataTable columns={columns} data={filteredPayments} hideSearch />
          </div>
          <div
            className="flex flex-col gap-3 md:hidden"
            data-testid="payments-mobile-cards"
          >
            {filteredPayments.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-6">
                No payment records found.
              </p>
            ) : (
              filteredPayments.map((p) => {
                const unalloc = Number(p.unallocated_amount || 0)
                const isReversed = p.status?.toLowerCase() === "reversed"
                return (
                  <div
                    key={p.id}
                    className="rounded-lg border p-3 space-y-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          to="/clients/$clientId/policies"
                          params={{ clientId: p.client_id }}
                          className="font-semibold text-primary hover:underline block truncate"
                        >
                          {clientMap.get(p.client_id) || "Client"}
                        </Link>
                        <div className="font-mono text-muted-foreground mt-0.5">
                          {p.reference_number || "NO-REF"} · {p.payment_date}
                        </div>
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
                        {formatStatusLabel(p.status || "active")}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-muted border">
                        {formatPaymentChannel(p.payment_method)}
                      </span>
                      <div className="text-right font-mono tabular-nums">
                        <div className="font-bold">
                          {formatCurrency(p.amount)}
                        </div>
                        {unalloc > 0 && (
                          <div className="text-amber-600 dark:text-amber-400">
                            Unalloc: {formatCurrency(unalloc)}
                          </div>
                        )}
                      </div>
                    </div>
                    {!isReversed && (
                      <div className="flex items-center justify-end gap-1.5 pt-1 border-t">
                        {unalloc > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedRecordForAlloc(p)}
                            className="h-7 text-[11px] px-2 cursor-pointer"
                          >
                            Allocate
                          </Button>
                        )}
                        <RowReverseMenu
                          onReverse={() =>
                            setReversalTarget({
                              type: "payment",
                              id: p.id,
                              title: `Payment ${p.reference_number || p.id.substring(0, 8)}`,
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

      {selectedRecordForAlloc && (
        <AllocatePaymentDialogWithInvoices
          record={selectedRecordForAlloc}
          onOpenChange={(open) => !open && setSelectedRecordForAlloc(null)}
        />
      )}

      <LedgerReversalDialog
        target={reversalTarget}
        onOpenChange={(open) => !open && setReversalTarget(null)}
      />
    </>
  )
}
