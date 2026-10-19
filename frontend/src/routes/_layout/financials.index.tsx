import { createFileRoute, Link } from "@tanstack/react-router"
import {
  AlertCircle,
  CheckCircle2,
  Plus,
  Receipt,
  Search,
  ShieldAlert,
  Wallet,
} from "lucide-react"
import { useMemo, useState } from "react"
import type { PaymentRecordPublic } from "@/client"
import { ClientStatementView } from "@/components/Financials/ClientStatementView"
import { RecordPaymentModal } from "@/components/Financials/RecordPaymentModal"
import PendingItems from "@/components/Pending/PendingItems"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import useCustomToast from "@/hooks/useCustomToast"
import { useFinancialSummary, useInvoices } from "@/hooks/useFinancials"
import { useClients } from "@/hooks/useInsurance"
import {
  useAllocatePayment,
  usePaymentAllocations,
  usePaymentRecords,
  useReversePaymentAllocation,
  useReversePaymentRecord,
} from "@/hooks/usePayments"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_layout/financials/")({
  component: FinancialsHub,
  head: () => ({
    meta: [
      {
        title: "Financials & Accounts Hub - HealthWatch MS",
      },
    ],
  }),
})

function FinancialsHub() {
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const { summary, isLoading: isSummaryLoading } = useFinancialSummary()
  const { data: clientsData } = useClients(0, 500)
  const { data: invoicesData, isLoading: isInvoicesLoading } = useInvoices(
    undefined,
    0,
    200,
  )
  const { data: paymentsData, isLoading: isPaymentsLoading } =
    usePaymentRecords(undefined, 0, 200)
  const { data: allocationsData, isLoading: isAllocationsLoading } =
    usePaymentAllocations(undefined, undefined, 0, 200)

  // Mutations
  const allocateMutation = useAllocatePayment()
  const reversePaymentMutation = useReversePaymentRecord()
  const reverseAllocMutation = useReversePaymentAllocation()

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
  const [allocTargetInvoiceId, setAllocTargetInvoiceId] = useState("")
  const [allocAmount, setAllocAmount] = useState("")

  const [reversalTarget, setReversalTarget] = useState<{
    type: "payment" | "allocation"
    id: string
    title: string
  } | null>(null)
  const [reversalReason, setReversalReason] = useState("")

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

  // Compute unallocated pool
  const totalUnallocated = useMemo(() => {
    return payments
      .filter((p) => p.status?.toLowerCase() === "active")
      .reduce((sum, p) => sum + Number(p.unallocated_amount || 0), 0)
  }, [payments])

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

  // Open invoices available for selected record
  const availableInvoicesForAlloc = useMemo(() => {
    if (!selectedRecordForAlloc) return []
    return invoices.filter(
      (inv) =>
        inv.client_id === selectedRecordForAlloc.client_id &&
        Number(inv.balance_due || 0) > 0,
    )
  }, [invoices, selectedRecordForAlloc])

  const handleOpenAllocate = (record: PaymentRecordPublic) => {
    setSelectedRecordForAlloc(record)
    setAllocTargetInvoiceId("")
    setAllocAmount(String(record.unallocated_amount || record.amount))
  }

  const handleExecuteAllocation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRecordForAlloc || !allocTargetInvoiceId) {
      showErrorToast("Please select an invoice to allocate to.")
      return
    }
    const parsed = parseFloat(allocAmount)
    if (Number.isNaN(parsed) || parsed <= 0) {
      showErrorToast("Please enter a valid positive allocation amount.")
      return
    }

    try {
      await allocateMutation.mutateAsync({
        id: selectedRecordForAlloc.id,
        data: {
          payment_record_id: selectedRecordForAlloc.id,
          invoice_id: allocTargetInvoiceId,
          amount: parsed.toFixed(2) as any,
        },
      })
      setSelectedRecordForAlloc(null)
      showSuccessToast("Payment funds allocated successfully.")
    } catch (err: any) {
      showErrorToast(err?.detail || err?.message || "Failed to allocate funds.")
    }
  }

  const handleExecuteReversal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reversalTarget || !reversalReason.trim()) {
      showErrorToast("A justification reason is required for ledger reversal.")
      return
    }

    try {
      if (reversalTarget.type === "payment") {
        await reversePaymentMutation.mutateAsync({
          id: reversalTarget.id,
          data: { reversal_reason: reversalReason.trim() },
        })
      } else {
        await reverseAllocMutation.mutateAsync({
          id: reversalTarget.id,
          data: { reversal_reason: reversalReason.trim() },
        })
      }
      setReversalTarget(null)
      setReversalReason("")
      showSuccessToast("Reversal successfully recorded in audit ledger.")
    } catch (err: any) {
      showErrorToast(
        err?.detail || err?.message || "Failed to execute reversal.",
      )
    }
  }

  if (
    isSummaryLoading ||
    isInvoicesLoading ||
    isPaymentsLoading ||
    isAllocationsLoading
  ) {
    return <PendingItems />
  }

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* 1. Header with Accounting Context & Quick Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-blue-500" />
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Agency Accounts & Financial Ledger
            </p>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mt-1">
            Financials & Accounts Hub
          </h1>
          <p className="text-sm text-muted-foreground">
            Cleared payment instruments, debt reconciliation, and invoice
            allocations
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsRecordPaymentOpen(true)}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
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
              KES {summary.totalInvoiced.toLocaleString()}
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
              KES {summary.totalPaid.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Deposited in agency accounts
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
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
              Outstanding Balance
            </CardTitle>
            <AlertCircle className="size-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono tabular-nums tracking-tight text-rose-600 dark:text-rose-400">
              KES {summary.totalDue.toLocaleString()}
            </div>
            <p className="text-xs text-rose-700/80 dark:text-rose-400/80 mt-1">
              Open debtor balance awaiting collection
            </p>
          </CardContent>
        </Card>

        {/* Metric 4: Unallocated Client Funds */}
        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Unallocated Funds
            </CardTitle>
            <Wallet className="size-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono tabular-nums tracking-tight text-amber-600 dark:text-amber-400">
              KES {totalUnallocated.toLocaleString()}
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
          <TabsList className="grid grid-cols-4 w-full sm:w-auto">
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
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 text-muted-foreground font-semibold uppercase tracking-wider border-b">
                  <tr>
                    <th className="p-3.5">Payment Date</th>
                    <th className="p-3.5">Reference / Slip</th>
                    <th className="p-3.5">Client Portfolio</th>
                    <th className="p-3.5">Channel</th>
                    <th className="p-3.5 text-right">Gross Amount</th>
                    <th className="p-3.5 text-right">Unallocated</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredPayments.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="p-8 text-center text-muted-foreground"
                      >
                        No payment records matching the criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((p) => {
                      const clientName = clientMap.get(p.client_id) || "Client"
                      const unalloc = Number(p.unallocated_amount || 0)
                      const isReversed = p.status?.toLowerCase() === "reversed"

                      return (
                        <tr
                          key={p.id}
                          className="hover:bg-muted/20 transition-colors"
                        >
                          <td className="p-3.5 font-mono text-muted-foreground">
                            {p.payment_date}
                          </td>
                          <td className="p-3.5 font-mono font-bold">
                            {p.reference_number || "NO-REF"}
                          </td>
                          <td className="p-3.5 font-medium">{clientName}</td>
                          <td className="p-3.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-muted border">
                              {p.payment_method}
                            </span>
                          </td>
                          <td className="p-3.5 text-right font-mono tabular-nums font-bold text-foreground">
                            KES {Number(p.amount).toLocaleString()}
                          </td>
                          <td className="p-3.5 text-right font-mono tabular-nums">
                            {unalloc > 0 ? (
                              <span className="text-amber-600 dark:text-amber-400 font-bold">
                                KES {unalloc.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">
                                KES 0.00
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-center">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-bold px-1.5 py-0",
                                isReversed
                                  ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20"
                                  : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
                              )}
                            >
                              {p.status || "active"}
                            </Badge>
                          </td>
                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {!isReversed && unalloc > 0 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenAllocate(p)}
                                  className="h-7 text-[11px] px-2 cursor-pointer"
                                >
                                  Allocate
                                </Button>
                              )}
                              {!isReversed && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    setReversalTarget({
                                      type: "payment",
                                      id: p.id,
                                      title: `Payment ${p.reference_number || p.id.substring(0, 8)}`,
                                    })
                                  }
                                  className="h-7 text-[11px] px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 cursor-pointer"
                                >
                                  Reverse
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 2: Invoices */}
      {activeTab === "invoices" && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 text-muted-foreground font-semibold uppercase tracking-wider border-b">
                  <tr>
                    <th className="p-3.5">Invoice Number</th>
                    <th className="p-3.5">Client Portfolio</th>
                    <th className="p-3.5">Issue Date</th>
                    <th className="p-3.5">Due Date</th>
                    <th className="p-3.5 text-right">Total Invoiced</th>
                    <th className="p-3.5 text-right">Balance Due</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="p-8 text-center text-muted-foreground"
                      >
                        No invoices found.
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((inv) => {
                      const clientName =
                        clientMap.get(inv.client_id) || "Client"
                      const balDue = Number(inv.balance_due || 0)

                      return (
                        <tr
                          key={inv.id}
                          className="hover:bg-muted/20 transition-colors"
                        >
                          <td className="p-3.5 font-mono font-bold text-primary">
                            {inv.invoice_number}
                          </td>
                          <td className="p-3.5 font-medium">{clientName}</td>
                          <td className="p-3.5 font-mono text-muted-foreground">
                            {inv.date_issued}
                          </td>
                          <td className="p-3.5 font-mono text-muted-foreground">
                            {inv.due_date || "—"}
                          </td>
                          <td className="p-3.5 text-right font-mono tabular-nums font-semibold">
                            KES {Number(inv.total_amount).toLocaleString()}
                          </td>
                          <td className="p-3.5 text-right font-mono tabular-nums font-bold">
                            {balDue > 0 ? (
                              <span className="text-rose-600 dark:text-rose-400">
                                KES {balDue.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-400">
                                Settled
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-center">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-bold px-1.5 py-0 uppercase",
                                balDue === 0
                                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                                  : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
                              )}
                            >
                              {inv.status}
                            </Badge>
                          </td>
                          <td className="p-3.5 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              asChild
                              className="h-7 text-[11px] px-2.5"
                            >
                              <Link
                                to="/clients/$clientId/invoices"
                                params={{ clientId: inv.client_id }}
                              >
                                View File &rarr;
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 3: Allocations & Audit Trail */}
      {activeTab === "allocations" && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 text-muted-foreground font-semibold uppercase tracking-wider border-b">
                  <tr>
                    <th className="p-3.5">Allocated At</th>
                    <th className="p-3.5">Payment Record ID</th>
                    <th className="p-3.5">Target Invoice ID</th>
                    <th className="p-3.5 text-right">Amount Allocated</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5">Audit / Reversal Notes</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredAllocations.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="p-8 text-center text-muted-foreground"
                      >
                        No payment allocations recorded yet.
                      </td>
                    </tr>
                  ) : (
                    filteredAllocations.map((a) => {
                      const isReversed = a.status?.toLowerCase() === "reversed"

                      return (
                        <tr
                          key={a.id}
                          className="hover:bg-muted/20 transition-colors"
                        >
                          <td className="p-3.5 font-mono text-muted-foreground">
                            {a.allocated_at
                              ? new Date(a.allocated_at).toLocaleDateString()
                              : "—"}
                          </td>
                          <td className="p-3.5 font-mono text-xs">
                            {a.payment_record_id.substring(0, 8)}...
                          </td>
                          <td className="p-3.5 font-mono text-xs">
                            {a.invoice_id.substring(0, 8)}...
                          </td>
                          <td className="p-3.5 text-right font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                            +KES {Number(a.amount).toLocaleString()}
                          </td>
                          <td className="p-3.5 text-center">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-bold px-1.5 py-0 uppercase",
                                isReversed
                                  ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20"
                                  : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
                              )}
                            >
                              {a.status}
                            </Badge>
                          </td>
                          <td className="p-3.5 text-muted-foreground text-xs max-w-xs truncate">
                            {a.reversal_reason || "Standard payment allocation"}
                          </td>
                          <td className="p-3.5 text-right">
                            {!isReversed && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  setReversalTarget({
                                    type: "allocation",
                                    id: a.id,
                                    title: `Allocation ${a.id.substring(0, 8)}`,
                                  })
                                }
                                className="h-7 text-[11px] px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 cursor-pointer"
                              >
                                Reverse
                              </Button>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
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
                  onValueChange={(val) => setSelectedStatementClientId(val)}
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
      <Dialog
        open={!!selectedRecordForAlloc}
        onOpenChange={(open) => !open && setSelectedRecordForAlloc(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              Allocate Payment to Invoice
            </DialogTitle>
            <DialogDescription className="text-xs">
              Apply cleared unallocated funds to extinguish an open client
              balance.
            </DialogDescription>
          </DialogHeader>

          {selectedRecordForAlloc && (
            <form onSubmit={handleExecuteAllocation} className="space-y-4 pt-2">
              <div className="rounded-lg border p-3 bg-muted/20 text-xs space-y-1 font-mono">
                <div>
                  <span className="text-muted-foreground">Payment Ref: </span>
                  <span className="font-bold">
                    {selectedRecordForAlloc.reference_number || "NO-REF"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">
                    Available to Allocate:{" "}
                  </span>
                  <span className="font-bold text-amber-600">
                    KES{" "}
                    {Number(
                      selectedRecordForAlloc.unallocated_amount ||
                        selectedRecordForAlloc.amount,
                    ).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Select Open Invoice *
                </Label>
                {availableInvoicesForAlloc.length === 0 ? (
                  <p className="text-xs text-rose-600 italic">
                    No open invoices with balance due found for this client.
                  </p>
                ) : (
                  <Select
                    value={allocTargetInvoiceId}
                    onValueChange={(val) => {
                      setAllocTargetInvoiceId(val)
                      const inv = availableInvoicesForAlloc.find(
                        (i) => i.id === val,
                      )
                      if (inv) {
                        const maxAvail = Number(
                          selectedRecordForAlloc.unallocated_amount ||
                            selectedRecordForAlloc.amount,
                        )
                        const due = Number(inv.balance_due || 0)
                        setAllocAmount(String(Math.min(maxAvail, due)))
                      }
                    }}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Choose open invoice..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableInvoicesForAlloc.map((inv) => (
                        <SelectItem
                          key={inv.id}
                          value={inv.id}
                          className="text-xs"
                        >
                          <span className="font-mono font-bold mr-2">
                            {inv.invoice_number}
                          </span>
                          &bull; Due: KES{" "}
                          {Number(inv.balance_due).toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Allocation Amount (KES) *
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="1"
                  value={allocAmount}
                  onChange={(e) => setAllocAmount(e.target.value)}
                  className="font-mono text-xs tabular-nums text-right font-bold"
                  required
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedRecordForAlloc(null)}
                  className="text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    allocateMutation.isPending ||
                    !allocTargetInvoiceId ||
                    availableInvoicesForAlloc.length === 0
                  }
                  className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                >
                  {allocateMutation.isPending
                    ? "Allocating..."
                    : "Post Allocation"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* 6. Sub-Dialog: Append-Only Reversal with Required Reason */}
      <Dialog
        open={!!reversalTarget}
        onOpenChange={(open) => !open && setReversalTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-5 text-rose-600" />
              <DialogTitle className="text-base font-bold text-rose-600">
                Authorized Ledger Reversal
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Reversing is an append-only accounting action. It voids this
              financial transaction and restores all linked ledger balances.
            </DialogDescription>
          </DialogHeader>

          {reversalTarget && (
            <form onSubmit={handleExecuteReversal} className="space-y-4 pt-2">
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 text-xs">
                <span className="font-semibold text-rose-700 dark:text-rose-400">
                  Target:{" "}
                </span>
                <span className="font-mono font-bold">
                  {reversalTarget.title}
                </span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Reversal Justification Reason *
                </Label>
                <Textarea
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder="e.g. Client bounce back, duplicate deposit entry, or bank dispute..."
                  rows={3}
                  className="text-xs"
                  required
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setReversalTarget(null)}
                  className="text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    !reversalReason.trim() ||
                    reversePaymentMutation.isPending ||
                    reverseAllocMutation.isPending
                  }
                  className="text-xs bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
                >
                  {reversePaymentMutation.isPending ||
                  reverseAllocMutation.isPending
                    ? "Reversing..."
                    : "Confirm Reversal"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* 7. Record Payment Modal */}
      <RecordPaymentModal
        open={isRecordPaymentOpen}
        onOpenChange={setIsRecordPaymentOpen}
      />
    </div>
  )
}
