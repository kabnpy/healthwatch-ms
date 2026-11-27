import { createFileRoute } from "@tanstack/react-router"
import {
  AlertCircle,
  CheckCircle2,
  Plus,
  Receipt,
  Search,
  Wallet,
} from "lucide-react"
import { useMemo, useState } from "react"
import { QueryErrorBanner } from "@/components/Common/QueryErrorBanner"
import { AllocationsTab } from "@/components/Financials/AllocationsTab"
import { InvoicesTab } from "@/components/Financials/InvoicesTab"
import { PaymentRecordsTab } from "@/components/Financials/PaymentRecordsTab"
import { RecordPaymentModal } from "@/components/Financials/RecordPaymentModal"
import { StatementsTab } from "@/components/Financials/StatementsTab"
import PendingItems from "@/components/Pending/PendingItems"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useClients } from "@/hooks/useClients"
import { useFinancialSummary } from "@/hooks/useFinancials"
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

type FinancialsTab = "payments" | "invoices" | "allocations" | "statements"

function FinancialsHub() {
  const {
    summary,
    isLoading: isSummaryLoading,
    isError: isSummaryError,
    refetch: refetchSummary,
  } = useFinancialSummary()
  const { data: clientsData } = useClients(0, 500)

  const [activeTab, setActiveTab] = useState<FinancialsTab>("payments")
  const [searchTerm, setSearchTerm] = useState("")
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false)

  const clientMap = useMemo(() => {
    const map = new Map<string, string>()
    clientsData?.data?.forEach((c) => {
      map.set(c.id, c.name)
    })
    return map
  }, [clientsData])

  const clients = useMemo(() => clientsData?.data || [], [clientsData])

  const totalUnallocated = summary?.totalUnallocated ?? 0

  if (isSummaryLoading) {
    return <PendingItems />
  }

  if (isSummaryError) {
    return (
      <div className="p-6">
        <QueryErrorBanner
          message="Failed to load financial data. Please try again."
          onRetry={() => void refetchSummary()}
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
              Issued policy invoices
            </p>
          </CardContent>
        </Card>

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
                summary.totalDue > 0
                  ? "text-rose-600"
                  : "text-muted-foreground",
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
          onValueChange={(val: FinancialsTab) => setActiveTab(val)}
          className="w-full sm:w-auto"
        >
          <TabsList
            variant="line"
            className="w-full max-w-full overflow-x-auto justify-start border-b"
          >
            <TabsTrigger value="payments" className="text-xs font-medium">
              Payment Records
            </TabsTrigger>
            <TabsTrigger value="invoices" className="text-xs font-medium">
              Invoices
            </TabsTrigger>
            <TabsTrigger value="allocations" className="text-xs font-medium">
              Allocations
            </TabsTrigger>
            <TabsTrigger value="statements" className="text-xs font-medium">
              Client Statements
            </TabsTrigger>
          </TabsList>
        </Tabs>

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

      {/* 4. Active Tab Panel (mounted lazily) */}
      {activeTab === "payments" && (
        <PaymentRecordsTab searchTerm={searchTerm} clientMap={clientMap} />
      )}
      {activeTab === "invoices" && (
        <InvoicesTab searchTerm={searchTerm} clientMap={clientMap} />
      )}
      {activeTab === "allocations" && (
        <AllocationsTab searchTerm={searchTerm} />
      )}
      {activeTab === "statements" && <StatementsTab clients={clients} />}

      {/* 5. Record Payment Modal */}
      {isRecordPaymentOpen && (
        <RecordPaymentModal
          open={isRecordPaymentOpen}
          onOpenChange={setIsRecordPaymentOpen}
        />
      )}
    </div>
  )
}
