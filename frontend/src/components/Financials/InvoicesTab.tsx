import { Link } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import { useMemo } from "react"
import type { InvoicePublic } from "@/client"
import { DataTable } from "@/components/Common/DataTable"
import { QueryErrorBanner } from "@/components/Common/QueryErrorBanner"
import { formatStatusLabel } from "@/components/Financials/ledgerUtils"
import PendingItems from "@/components/Pending/PendingItems"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useInvoices } from "@/hooks/useFinancials"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/utils"

function getInvoiceColumns(opts: {
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
          to="/clients/$clientId/policies"
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

export function InvoicesTab({
  searchTerm,
  clientMap,
}: {
  searchTerm: string
  clientMap: Map<string, string>
}) {
  const {
    data: invoicesData,
    isLoading,
    isError,
    refetch,
  } = useInvoices(undefined, 0, 200)

  const invoices = invoicesData?.data || []

  const filteredInvoices = useMemo(() => {
    if (!searchTerm.trim()) return invoices
    const term = searchTerm.toLowerCase()
    return invoices.filter((i) => {
      const clientName = clientMap.get(i.client_id)?.toLowerCase() || ""
      const invNo = i.invoice_number.toLowerCase()
      return clientName.includes(term) || invNo.includes(term)
    })
  }, [invoices, searchTerm, clientMap])

  const columns = useMemo(() => getInvoiceColumns({ clientMap }), [clientMap])

  if (isLoading) return <PendingItems />

  if (isError) {
    return (
      <QueryErrorBanner
        message="Failed to load invoices. Please try again."
        onRetry={() => void refetch()}
      />
    )
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="hidden md:block">
          <DataTable columns={columns} data={filteredInvoices} hideSearch />
        </div>
        <div
          className="flex flex-col gap-3 md:hidden"
          data-testid="invoices-mobile-cards"
        >
          {filteredInvoices.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-6">
              No invoices found.
            </p>
          ) : (
            filteredInvoices.map((inv) => {
              const balDue = Number(inv.balance_due || 0)
              return (
                <div
                  key={inv.id}
                  className="rounded-lg border p-3 space-y-2 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        to="/clients/$clientId/policies"
                        params={{ clientId: inv.client_id }}
                        className="font-semibold text-primary hover:underline block truncate"
                      >
                        {clientMap.get(inv.client_id) || "Client"}
                      </Link>
                      <div className="font-mono font-bold mt-0.5">
                        {inv.invoice_number}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-bold px-1.5 py-0 shrink-0",
                        balDue === 0
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
                      )}
                    >
                      {formatStatusLabel(inv.status)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2 font-mono tabular-nums">
                    <span className="text-muted-foreground">
                      Due: {inv.due_date || "—"}
                    </span>
                    <div className="text-right">
                      <div className="font-semibold">
                        {formatCurrency(inv.total_amount)}
                      </div>
                      <div
                        className={cn(
                          "font-bold",
                          balDue > 0
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-emerald-600 dark:text-emerald-400",
                        )}
                      >
                        {balDue > 0
                          ? `Bal: ${formatCurrency(balDue)}`
                          : "Settled"}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end pt-1 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] px-2.5"
                      render={
                        <Link
                          to="/clients/$clientId/invoices"
                          params={{ clientId: inv.client_id }}
                        >
                          View File &rarr;
                        </Link>
                      }
                    />
                  </div>
                </div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}
