import {
  CreditCard,
  FilePlus,
  FileText,
  Plus,
  Receipt,
  RotateCcw,
} from "lucide-react"
import { useMemo, useState } from "react"
import type { PaymentRecordPublic } from "@/client"
import { DataTable } from "@/components/Common/DataTable"
import { EmptyState } from "@/components/Common/EmptyState"
import { DocumentPreviewDrawer } from "@/components/Documents/DocumentPreviewDrawer"
import { AllocatePaymentDialog } from "@/components/Financials/AllocatePaymentDialog"
import { ClientStatementView } from "@/components/Financials/ClientStatementView"
import { InvoicesSkeleton } from "@/components/Financials/InvoicesSkeleton"
import { InvoiceWizard } from "@/components/Financials/InvoiceWizard"
import {
  LedgerReversalDialog,
  type LedgerReversalTarget,
} from "@/components/Financials/LedgerReversalDialog"
import { RecordPaymentModal } from "@/components/Financials/RecordPaymentModal"
import { getColumns as getInvoiceColumns } from "@/components/Invoices/columns"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useInvoices } from "@/hooks/useFinancials"
import { usePaymentRecords } from "@/hooks/usePayments"
import { formatCurrency } from "@/utils"

interface ClientInvoicesProps {
  clientId: string
}

export function ClientInvoices({ clientId }: ClientInvoicesProps) {
  const { data: invoicesData, isLoading: isLoadingInvoices } =
    useInvoices(clientId)
  const { data: paymentsData, isLoading: isLoadingPayments } =
    usePaymentRecords(clientId)

  const invoices = invoicesData?.data || []
  const paymentRecords = paymentsData?.data || []

  // Modals state
  const [viewerOpen, setViewerOpen] = useState(false)
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false)
  const [isInvoiceWizardOpen, setIsInvoiceWizardOpen] = useState(false)
  const [allocatingRecord, setAllocatingRecord] =
    useState<PaymentRecordPublic | null>(null)
  const [reversalTarget, setReversalTarget] =
    useState<LedgerReversalTarget | null>(null)

  const invoiceColumns = useMemo(
    () =>
      getInvoiceColumns(
        (invoice) => {
          setSelectedDocId(invoice.id)
          setViewerOpen(true)
        },
        () => {},
      ),
    [],
  )

  if (isLoadingInvoices || isLoadingPayments) {
    return <InvoicesSkeleton />
  }

  return (
    <div className="space-y-6 pt-4">
      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Client Invoicing & Payment Ledger
          </h2>
          <p className="text-xs text-muted-foreground">
            Debtor invoices, cleared funds cashiering, and non-destructive
            allocations.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2 h-9 text-xs"
            onClick={() => setIsInvoiceWizardOpen(true)}
          >
            <FilePlus className="size-4" />
            Generate Invoice
          </Button>
          <Button
            className="gap-2 h-9 text-xs bg-primary text-primary-foreground font-medium"
            onClick={() => setIsRecordPaymentOpen(true)}
          >
            <CreditCard className="size-4" />
            Record Cleared Payment
          </Button>
        </div>
      </div>

      <Tabs defaultValue="invoices" className="w-full">
        <TabsList
          variant="line"
          className="w-full max-w-full overflow-x-auto justify-start border-b"
        >
          <TabsTrigger value="invoices">
            Invoices ({invoices.length})
          </TabsTrigger>
          <TabsTrigger value="payments">
            Payment Records ({paymentRecords.length})
          </TabsTrigger>
          <TabsTrigger value="statement">Statement</TabsTrigger>
        </TabsList>

        {/* TAB 1: INVOICES */}
        <TabsContent value="invoices" className="pt-4">
          {invoices.length === 0 ? (
            <EmptyState
              title="No invoices found"
              description="There are no invoices for this client yet. Use the wizard to generate one from issued risk notes."
              icon={FileText}
            />
          ) : (
            <DataTable
              columns={invoiceColumns}
              data={invoices}
              searchPlaceholder="Search invoices..."
            />
          )}
        </TabsContent>

        {/* TAB 2: PAYMENT RECORDS */}
        <TabsContent value="payments" className="pt-4 space-y-4">
          {paymentRecords.length === 0 ? (
            <EmptyState
              title="No payment records found"
              description="No cleared deposits have been recorded for this client yet."
              icon={Receipt}
              action={{
                label: "Record Cleared Payment",
                onClick: () => setIsRecordPaymentOpen(true),
                icon: Plus,
              }}
            />
          ) : (
            <div className="border rounded-lg bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-muted/50 border-b font-medium text-muted-foreground uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">Payment Reference</th>
                      <th className="py-2.5 px-3">Method</th>
                      <th className="py-2.5 px-3">Date Received</th>
                      <th className="py-2.5 px-3 text-right">Gross Amount</th>
                      <th className="py-2.5 px-3 text-right">
                        Unallocated Funds
                      </th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paymentRecords.map((rec) => {
                      const unalloc = Number(rec.unallocated_amount || 0)
                      const isReversed = rec.status === "reversed"

                      return (
                        <tr
                          key={rec.id}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="py-2 px-3 font-mono text-xs font-semibold text-foreground">
                            {rec.reference_number || "—"}
                          </td>
                          <td className="py-2 px-3">
                            <Badge
                              variant="outline"
                              className="text-[10px] uppercase font-mono"
                            >
                              {rec.payment_method?.replace(/_/g, " ")}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-muted-foreground">
                            {rec.payment_date || "—"}
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums text-right font-medium">
                            {formatCurrency(rec.amount)}
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums text-right">
                            {unalloc > 0 ? (
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                {formatCurrency(unalloc)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">
                                KES 0.00
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <Badge
                              variant="outline"
                              className={
                                isReversed
                                  ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20"
                                  : unalloc > 0
                                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                                    : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                              }
                            >
                              {isReversed
                                ? "Reversed"
                                : unalloc > 0
                                  ? "Partially Allocated"
                                  : "Fully Allocated"}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {unalloc > 0 && !isReversed && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setAllocatingRecord(rec)}
                                  className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/5"
                                >
                                  Allocate Funds
                                </Button>
                              )}
                              {!isReversed && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setReversalTarget({
                                      type: "payment",
                                      id: rec.id,
                                      title: `Payment ${rec.reference_number || rec.id}`,
                                    })
                                  }
                                  className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                                >
                                  <RotateCcw className="size-3 mr-1" />
                                  Reverse
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* TAB 3: ACCOUNT STATEMENT & RUNNING LEDGER */}
        <TabsContent value="statement" className="pt-4">
          <ClientStatementView clientId={clientId} />
        </TabsContent>
      </Tabs>

      {/* RECORD PAYMENT MODAL */}
      <RecordPaymentModal
        open={isRecordPaymentOpen}
        onOpenChange={setIsRecordPaymentOpen}
        initialClientId={clientId}
      />

      <AllocatePaymentDialog
        record={allocatingRecord}
        invoices={invoices}
        onOpenChange={(open) => {
          if (!open) setAllocatingRecord(null)
        }}
      />

      <LedgerReversalDialog
        target={reversalTarget}
        onOpenChange={(open) => {
          if (!open) setReversalTarget(null)
        }}
      />

      {/* INVOICE WIZARD */}
      <InvoiceWizard
        clientId={clientId}
        isOpen={isInvoiceWizardOpen}
        onClose={() => setIsInvoiceWizardOpen(false)}
      />

      {/* DOCUMENT PREVIEW DRAWER */}
      <DocumentPreviewDrawer
        isOpen={viewerOpen}
        onOpenChange={(open) => {
          setViewerOpen(open)
          if (!open) setSelectedDocId(null)
        }}
        target={
          selectedDocId
            ? {
                kind: "invoice",
                invoiceId: selectedDocId,
              }
            : null
        }
      />
    </div>
  )
}
