import {
  CreditCard,
  FilePlus,
  FileText,
  Plus,
  Receipt,
  RotateCcw,
  ShieldAlert,
} from "lucide-react"
import { Suspense, useMemo, useState } from "react"
import type { PaymentRecordPublic } from "@/client"
import { DataTable } from "@/components/Common/DataTable"
import { DocumentViewerModal } from "@/components/Common/DocumentViewerModal"
import { EmptyState } from "@/components/Common/EmptyState"
import { DocumentViewer } from "@/components/Documents/DocumentViewer"
import { ClientStatementView } from "@/components/Financials/ClientStatementView"
import { InvoicesSkeleton } from "@/components/Financials/InvoicesSkeleton"
import { InvoiceWizard } from "@/components/Financials/InvoiceWizard"
import { RecordPaymentModal } from "@/components/Financials/RecordPaymentModal"
import { getColumns as getInvoiceColumns } from "@/components/Invoices/columns"
import { Badge } from "@/components/ui/badge"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useInvoices } from "@/hooks/useFinancials"
import {
  useAllocatePayment,
  usePaymentRecords,
  useReversePaymentRecord,
} from "@/hooks/usePayments"
import { formatCurrency } from "@/utils"

interface ClientInvoicesProps {
  clientId: string
}

export function ClientInvoices({ clientId }: ClientInvoicesProps) {
  const { data: invoicesData, isLoading: isLoadingInvoices } =
    useInvoices(clientId)
  const { data: paymentsData, isLoading: isLoadingPayments } =
    usePaymentRecords(clientId)
  const allocateMutation = useAllocatePayment()
  const reversalMutation = useReversePaymentRecord()

  const invoices = invoicesData?.data || []
  const paymentRecords = paymentsData?.data || []

  // Modals state
  const [viewerOpen, setViewerOpen] = useState(false)
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false)
  const [isInvoiceWizardOpen, setIsInvoiceWizardOpen] = useState(false)

  // Allocation modal state
  const [allocationModalOpen, setAllocationModalOpen] = useState(false)
  const [selectedRecordForAllocation, setSelectedRecordForAllocation] =
    useState<PaymentRecordPublic | null>(null)
  const [targetInvoiceId, setTargetInvoiceId] = useState<string>("")
  const [allocationAmount, setAllocationAmount] = useState<string>("")

  // Reversal modal state
  const [reversalModalOpen, setReversalModalOpen] = useState(false)
  const [selectedRecordForReversal, setSelectedRecordForReversal] =
    useState<PaymentRecordPublic | null>(null)
  const [reversalReason, setReversalReason] = useState<string>("")

  const openInvoices = useMemo(
    () => invoices.filter((inv) => Number(inv.balance_due || 0) > 0),
    [invoices],
  )

  const handleOpenAllocation = (record: PaymentRecordPublic) => {
    setSelectedRecordForAllocation(record)
    const unallocated = Number(record.unallocated_amount || 0)
    if (openInvoices.length > 0) {
      const firstInv = openInvoices[0]
      setTargetInvoiceId(firstInv.id)
      const maxAllocatable = Math.min(
        unallocated,
        Number(firstInv.balance_due || 0),
      )
      setAllocationAmount(String(maxAllocatable))
    } else {
      setTargetInvoiceId("")
      setAllocationAmount(String(unallocated))
    }
    setAllocationModalOpen(true)
  }

  const handleConfirmAllocation = async () => {
    if (!selectedRecordForAllocation || !targetInvoiceId || !allocationAmount)
      return
    const amountNum = Number.parseFloat(allocationAmount)
    if (Number.isNaN(amountNum) || amountNum <= 0) return

    try {
      await allocateMutation.mutateAsync({
        id: selectedRecordForAllocation.id,
        data: {
          payment_record_id: selectedRecordForAllocation.id,
          invoice_id: targetInvoiceId,
          amount: amountNum,
        },
      })
      setAllocationModalOpen(false)
      setSelectedRecordForAllocation(null)
    } catch (_err) {
      // toast is handled in mutation
    }
  }

  const handleConfirmReversal = async () => {
    if (!selectedRecordForReversal || !reversalReason.trim()) return

    try {
      await reversalMutation.mutateAsync({
        id: selectedRecordForReversal.id,
        data: {
          reversal_reason: reversalReason.trim(),
        },
      })
      setReversalModalOpen(false)
      setSelectedRecordForReversal(null)
      setReversalReason("")
    } catch (_err) {
      // toast is handled in mutation
    }
  }

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
        <TabsList>
          <TabsTrigger value="invoices">
            Invoices ({invoices.length})
          </TabsTrigger>
          <TabsTrigger value="payments">
            Payment Records ({paymentRecords.length})
          </TabsTrigger>
          <TabsTrigger value="statement">Account Statement</TabsTrigger>
        </TabsList>

        {/* TAB 1: INVOICES */}
        <TabsContent value="invoices" className="pt-4">
          {invoices.length === 0 ? (
            <EmptyState
              title="No invoices found"
              description="There are no invoices for this client yet. Use the wizard to generate one from issued risk notes."
              icon={FileText}
              action={{
                label: "Generate Invoice",
                onClick: () => setIsInvoiceWizardOpen(true),
                icon: FilePlus,
              }}
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
                                  onClick={() => handleOpenAllocation(rec)}
                                  className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/5"
                                >
                                  Allocate Funds
                                </Button>
                              )}
                              {!isReversed && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedRecordForReversal(rec)
                                    setReversalReason("")
                                    setReversalModalOpen(true)
                                  }}
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

      {/* ALLOCATION DIALOG */}
      <Dialog open={allocationModalOpen} onOpenChange={setAllocationModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Allocate Cleared Payment Funds</DialogTitle>
            <DialogDescription className="text-xs">
              Apply unallocated credit funds from reference{" "}
              <span className="font-mono font-semibold text-foreground">
                {selectedRecordForAllocation?.reference_number || "—"}
              </span>{" "}
              against open debtor invoices.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="p-3 rounded-lg border bg-muted/30 flex justify-between items-center">
              <span className="text-muted-foreground">
                Available Credit Pool
              </span>
              <span className="font-mono tabular-nums text-sm font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(
                  selectedRecordForAllocation?.unallocated_amount,
                )}
              </span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Target Debtor Invoice
              </Label>
              {openInvoices.length === 0 ? (
                <p className="text-xs text-amber-600 font-medium">
                  No open invoices with positive balances found for this client.
                </p>
              ) : (
                <Select
                  value={targetInvoiceId}
                  onValueChange={(val) => {
                    setTargetInvoiceId(val)
                    const inv = openInvoices.find((i) => i.id === val)
                    if (inv && selectedRecordForAllocation) {
                      const maxPossible = Math.min(
                        Number(
                          selectedRecordForAllocation.unallocated_amount || 0,
                        ),
                        Number(inv.balance_due || 0),
                      )
                      setAllocationAmount(String(maxPossible))
                    }
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select Invoice" />
                  </SelectTrigger>
                  <SelectContent>
                    {openInvoices.map((inv) => (
                      <SelectItem key={inv.id} value={inv.id}>
                        {inv.invoice_number} • Due:{" "}
                        {formatCurrency(inv.balance_due)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Allocation Amount (KES)
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max={Number(
                  selectedRecordForAllocation?.unallocated_amount || 0,
                )}
                value={allocationAmount}
                onChange={(e) => setAllocationAmount(e.target.value)}
                className="font-mono text-sm h-9"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAllocationModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmAllocation}
              disabled={
                allocateMutation.isPending ||
                !targetInvoiceId ||
                !allocationAmount ||
                Number(allocationAmount) <= 0
              }
              className="bg-primary text-primary-foreground font-medium"
            >
              {allocateMutation.isPending
                ? "Allocating..."
                : "Apply Allocation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* REVERSAL DIALOG */}
      <Dialog open={reversalModalOpen} onOpenChange={setReversalModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="size-5" />
              <DialogTitle>Authorized Payment Reversal</DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Reverse payment record{" "}
              <span className="font-mono font-semibold text-foreground">
                {selectedRecordForReversal?.reference_number || "—"}
              </span>
              . This creates an append-only audit reversal and reinstates
              balances on all allocated invoices.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Audit Justification / Reversal Reason *
              </Label>
              <Textarea
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                placeholder="e.g. Bank chargeback, cheque dishonor, or Paybill duplicate correction..."
                rows={3}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReversalModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmReversal}
              disabled={reversalMutation.isPending || !reversalReason.trim()}
            >
              {reversalMutation.isPending ? "Reversing..." : "Confirm Reversal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* INVOICE WIZARD */}
      <InvoiceWizard
        clientId={clientId}
        isOpen={isInvoiceWizardOpen}
        onClose={() => setIsInvoiceWizardOpen(false)}
      />

      {/* DOCUMENT VIEWER MODAL */}
      {selectedDocId && (
        <DocumentViewerModal
          isOpen={viewerOpen}
          onClose={() => {
            setViewerOpen(false)
            setSelectedDocId(null)
          }}
          title="Invoice Details"
        >
          <Suspense fallback={<InvoicesSkeleton />}>
            <DocumentViewer id={selectedDocId} type="invoice" />
          </Suspense>
        </DocumentViewerModal>
      )}
    </div>
  )
}
