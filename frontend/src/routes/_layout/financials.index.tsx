import { createFileRoute, Link } from "@tanstack/react-router"
import {
  AlertCircle,
  CheckCircle2,
  Plus,
  Receipt,
  Search,
  Wallet,
} from "lucide-react"
import { useMemo, useState } from "react"
import type { PaymentRecordPublic } from "@/client"
import { DataTable } from "@/components/Common/DataTable"
import { QueryErrorBanner } from "@/components/Common/QueryErrorBanner"
import { AllocatePaymentDialog } from "@/components/Financials/AllocatePaymentDialog"
import { ClientStatementView } from "@/components/Financials/ClientStatementView"
import {
  formatPaymentChannel,
  formatStatusLabel,
  getAllocationColumns,
  getInvoiceColumns,
  getPaymentColumns,
  RowReverseMenu,
} from "@/components/Financials/financialsColumns"
import { Badge } from "@/components/ui/badge"
import {
  LedgerReversalDialog,
  type LedgerReversalTarget,
} from "@/components/Financials/LedgerReversalDialog"
import { RecordPaymentModal } from "@/components/Financials/RecordPaymentModal"
import PendingItems from "@/components/Pending/PendingItems"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useClients } from "@/hooks/useClients"
import { useFinancialSummary, useInvoices } from "@/hooks/useFinancials"
import { usePaymentAllocations, usePaymentRecords } from "@/hooks/usePayments"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/utils"

export const Route = createFileRoute("/_layout/financials/")({
  component: FinancialsHub,
  head: () => ({
    meta: [
      {
        title: "Financials Hub - HealthWatch MS",
      },
    ],
  }),
})

function FinancialsHub() {
  const {
    summary,
    isLoading: isSummaryLoading,
    isError: isSummaryError,
    refetch: refetchSummary,
  } = useFinancialSummary()
  const { data: clientsData } = useClients(0, 500)
  const {
    data: invoicesData,
    isLoading: isInvoicesLoading,
    isError: isInvoicesError,
    refetch: refetchInvoices,
  } = useInvoices(undefined, 0, 200)
  const {
    data: paymentsData,
    isLoading: isPaymentsLoading,
    isError: isPaymentsError,
    refetch: refetchPayments,
  } = usePaymentRecords(undefined, 0, 200)
  const {
    data: allocationsData,
    isLoading: isAllocationsLoading,
    isError: isAllocationsError,
    refetch: refetchAllocations,
  } = usePaymentAllocations(undefined, undefined, 0, 200)

  // State
  const [activeTab, setActiveTab] = useState<
    "payments" | "invoices" | "allocations" | "statements"
  >("payments")
  const [searchTerm, setSearchTerm] = useState("")
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false)
  const [selectedStatementClientId, setSelectedStatementClientId] =
    useState<string>("")

  // Sub-dialogs
  const [selectedRecordForAlloc, setSelectedRecordForAlloc] =
    useState<PaymentRecordPublic | null>(null)
  const [reversalTarget, setReversalTarget] =
    useState<LedgerReversalTarget | null>(null)

  const clientMap = useMemo(() => {
    const map = new Map<string, string>()
    clientsData?.data?.forEach((c) => {
      map.set(c.id, c.name)
    })
    return map
  }, [clientsData])

  const clients = useMemo(() => clientsData?.data || [], [clientsData])
  const payments = paymentsData?.data || []
  const invoices = invoicesData?.data || []
  const allocations = allocationsData?.data || []

  const statementClientId = selectedStatementClientId || (clients[0]?.id ?? "")
  const selectedClient = useMemo(
    () => clients.find((c) => c.id === statementClientId),
    [clients, statementClientId],
  )

  // Server-computed unallocated pool
  const totalUnallocated = summary?.totalUnallocated ?? 0

  // Filtered lists
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

  const filteredInvoices = useMemo(() => {
    if (!searchTerm.trim()) return invoices
    const term = searchTerm.toLowerCase()
    return invoices.filter((i) => {
      const clientName = clientMap.get(i.client_id)?.toLowerCase() || ""
      const invNo = i.invoice_number.toLowerCase()
      return clientName.includes(term) || invNo.includes(term)
    })
  }, [invoices, searchTerm, clientMap])

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

  const handleOpenAllocate = (record: PaymentRecordPublic) => {
    setSelectedRecordForAlloc(record)
  }

  if (
    isSummaryLoading ||
    isInvoicesLoading ||
    isPaymentsLoading ||
    isAllocationsLoading
  ) {
    return <PendingItems />
  }

  if (
    isSummaryError ||
    isInvoicesError ||
    isPaymentsError ||
    isAllocationsError
  ) {
    const handleRetry = () => {
      if (isSummaryError) void refetchSummary()
      if (isInvoicesError) void refetchInvoices()
      if (isPaymentsError) void refetchPayments()
      if (isAllocationsError) void refetchAllocations()
    }
    return (
      <div className="p-6">
        <QueryErrorBanner
          message="Failed to load financial data. Please try again."
          onRetry={handleRetry}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* 1. Header with Accounting Context & Quick Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-blue-500" />
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Agency Finances
            </p>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mt-1">
            Finances & Invoicing
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage payments, invoices, receipt allocations, and client
            statements
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsRecordPaymentOpen(true)}
            className="gap-2 cursor-pointer"
          >
            <Plus className="size-4" />
            Record Payment
          </Button>
        </div>
      </div>

      {/* 2. Operational Metrics Ribbon (Tabular Monospace Numerals) */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1: Total Invoiced Premium */}
        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Total Invoiced
            </CardTitle>
            <Receipt className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono tabular-nums tracking-tight">
              {formatCurrency(summary.totalInvoiced)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across {invoices.length} issued policy invoices
            </p>
          </CardContent>
        </Card>

        {/* Metric 2: Cleared Collections */}
        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Cleared Collections
            </CardTitle>
            <CheckCircle2 className="size-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400">
              {formatCurrency(summary.totalPaid)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Deposited in agency bank & M-Pesa
            </p>
          </CardContent>
        </Card>

        {/* Metric 3: Outstanding Receivables */}
        <Card
          className={cn(
            "transition-colors",
            summary.totalDue > 0
              ? "border-rose-500/40 bg-rose-500/5 hover:border-rose-500/60"
              : "hover:border-primary/50",
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle
              className={cn(
                "text-xs font-bold uppercase tracking-wider",
                summary.totalDue > 0
                  ? "text-rose-700 dark:text-rose-400"
                  : "text-muted-foreground",
              )}
            >
              Outstanding Balance
            </CardTitle>
            <AlertCircle
              className={cn(
                "size-4",
                summary.totalDue > 0 ? "text-rose-600" : "text-muted-foreground",
              )}
            />
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "text-2xl font-bold font-mono tabular-nums tracking-tight",
                summary.totalDue > 0 && "text-rose-600 dark:text-rose-400",
              )}
            >
              {formatCurrency(summary.totalDue)}
            </div>
            <p
              className={cn(
                "text-xs mt-1",
                summary.totalDue > 0
                  ? "text-rose-700/80 dark:text-rose-400/80"
                  : "text-muted-foreground",
              )}
            >
              Open debtor balance awaiting collection
            </p>
          </CardContent>
        </Card>

        {/* Metric 4: Unallocated Client Funds */}
        <Card
          className={cn(
            "transition-colors",
            totalUnallocated > 0
              ? "border-amber-500/40 bg-amber-500/5 hover:border-amber-500/60"
              : "hover:border-primary/50",
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle
              className={cn(
                "text-xs font-bold uppercase tracking-wider",
                totalUnallocated > 0
                  ? "text-amber-700 dark:text-amber-400"
                  : "text-muted-foreground",
              )}
            >
              Unallocated Funds
            </CardTitle>
            <Wallet
              className={cn(
                "size-4",
                totalUnallocated > 0
                  ? "text-amber-600"
                  : "text-muted-foreground",
              )}
            />
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "text-2xl font-bold font-mono tabular-nums tracking-tight",
                totalUnallocated > 0 && "text-amber-600 dark:text-amber-400",
              )}
            >
              {formatCurrency(totalUnallocated)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Cleared funds awaiting invoice allocation
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 3. Search & Tabs Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <Tabs
          value={activeTab}
          onValueChange={(val: any) => setActiveTab(val)}
          className="w-full sm:w-auto"
        >
          <TabsList className="flex flex-wrap h-auto w-full sm:w-auto">
            <TabsTrigger value="payments" className="text-xs font-medium">
              Payment Records ({payments.length})
            </TabsTrigger>
            <TabsTrigger value="invoices" className="text-xs font-medium">
              Invoices ({invoices.length})
            </TabsTrigger>
            <TabsTrigger value="allocations" className="text-xs font-medium">
              Allocations ({allocations.length})
            </TabsTrigger>
            <TabsTrigger value="statements" className="text-xs font-medium">
              Client Statements
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search ref, client, or invoice..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>
      </div>

      {/* 4. Tab Panels */}
      {/* TAB 1: Payment Records */}
      {activeTab === "payments" && (
        <Card>
          <CardContent className="p-4">
            <div className="hidden md:block">
              <DataTable
                columns={getPaymentColumns({
                  clientMap,
                  onAllocate: handleOpenAllocate,
                  onReverse: setReversalTarget,
                })}
                data={filteredPayments}
                hideSearch
              />
            </div>
            <div className="flex flex-col gap-3 md:hidden" data-testid="payments-mobile-cards">
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
                            to="/clients/$clientId/overview"
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
                              onClick={() => handleOpenAllocate(p)}
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
      )}

      {/* TAB 2: Invoices */}
      {activeTab === "invoices" && (
        <Card>
          <CardContent className="p-4">
            <div className="hidden md:block">
              <DataTable
                columns={getInvoiceColumns({ clientMap })}
                data={filteredInvoices}
                hideSearch
              />
            </div>
            <div className="flex flex-col gap-3 md:hidden" data-testid="invoices-mobile-cards">
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
                            to="/clients/$clientId/overview"
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
      )}

      {/* TAB 3: Allocations & Audit Trail */}
      {activeTab === "allocations" && (
        <Card>
          <CardContent className="p-4">
            <div className="hidden md:block">
              <DataTable
                columns={getAllocationColumns({
                  onReverse: setReversalTarget,
                })}
                data={filteredAllocations}
                hideSearch
              />
            </div>
            <div className="flex flex-col gap-3 md:hidden" data-testid="allocations-mobile-cards">
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
      )}

      {/* TAB 4: Reconciled Client Statements */}
      {activeTab === "statements" && (
        <div className="space-y-4">
          <Card className="p-4 bg-muted/20 border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                  Client Account Selection
                </span>
                <p className="text-xs text-muted-foreground">
                  Select a registered client portfolio to inspect their
                  reconciled debt ledger, aged debt buckets, and payment
                  allocations.
                </p>
              </div>

              <div className="w-full sm:w-80">
                <Select
                  value={statementClientId}
                  onValueChange={(val) => {
                    if (val) setSelectedStatementClientId(val)
                  }}
                >
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue placeholder="Choose a client..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        <span className="font-semibold">{c.name}</span>
                        {c.kra_pin && (
                          <span className="font-mono text-muted-foreground ml-2">
                            ({c.kra_pin})
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {statementClientId ? (
            <ClientStatementView
              clientId={statementClientId}
              clientName={selectedClient?.name}
              kraPin={selectedClient?.kra_pin}
            />
          ) : (
            <div className="py-12 border rounded-xl bg-card text-center text-muted-foreground text-xs">
              No clients available to generate statement.
            </div>
          )}
        </div>
      )}

      {/* 5. Sub-Dialog: Direct Allocation to Open Invoice */}
      <AllocatePaymentDialog
        record={selectedRecordForAlloc}
        invoices={invoices}
        onOpenChange={(open) => !open && setSelectedRecordForAlloc(null)}
      />

      {/* 6. Sub-Dialog: Append-Only Reversal with Required Reason */}
      <LedgerReversalDialog
        target={reversalTarget}
        onOpenChange={(open) => !open && setReversalTarget(null)}
      />

      {/* 7. Record Payment Modal */}
      <RecordPaymentModal
        open={isRecordPaymentOpen}
        onOpenChange={setIsRecordPaymentOpen}
      />
    </div>
  )
}
