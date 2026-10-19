import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Download,
  Printer,
  ShieldCheck,
} from "lucide-react"
import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useInvoices } from "@/hooks/useFinancials"
import {
  type StatementLedgerEntry,
  useClientStatement,
} from "@/hooks/useStatements"
import { formatCurrency } from "@/utils"

interface ClientStatementViewProps {
  clientId: string
  clientName?: string
  kraPin?: string
}

interface RunningLedgerItem extends StatementLedgerEntry {
  debitNum: number
  creditNum: number
  runningBalance: number
}

interface AgingBuckets {
  current: number // 0 - 30 days
  days31To60: number
  days61To90: number
  over90: number
  total: number
}

export function ClientStatementView({
  clientId,
  clientName,
  kraPin,
}: ClientStatementViewProps) {
  const { data: statement, isLoading, error } = useClientStatement(clientId)
  const { data: invoicesData } = useInvoices(clientId)

  const invoices = invoicesData?.data || []

  // 1. Calculate Running Balance sequentially
  const runningLedger = useMemo<RunningLedgerItem[]>(() => {
    if (!statement?.ledger_entries) return []

    let currentBalance = 0
    return statement.ledger_entries.map((entry) => {
      const debitNum = Number(entry.debit || 0)
      const creditNum = Number(entry.credit || 0)
      currentBalance =
        Math.round((currentBalance + debitNum - creditNum) * 100) / 100

      return {
        ...entry,
        debitNum,
        creditNum,
        runningBalance: currentBalance,
      }
    })
  }, [statement?.ledger_entries])

  // 2. Compute Aged Debt Buckets from open invoices
  const aging = useMemo<AgingBuckets>(() => {
    const buckets: AgingBuckets = {
      current: 0,
      days31To60: 0,
      days61To90: 0,
      over90: 0,
      total: 0,
    }

    const now = Date.now()

    for (const inv of invoices) {
      const balance = Number(inv.balance_due || 0)
      if (balance <= 0) continue

      buckets.total += balance
      const issueDate = inv.date_issued
        ? new Date(inv.date_issued).getTime()
        : now
      const days = Math.floor((now - issueDate) / (1000 * 60 * 60 * 24))

      if (days <= 30) {
        buckets.current += balance
      } else if (days <= 60) {
        buckets.days31To60 += balance
      } else if (days <= 90) {
        buckets.days61To90 += balance
      } else {
        buckets.over90 += balance
      }
    }

    // Round all to 2 decimal places
    buckets.current = Math.round(buckets.current * 100) / 100
    buckets.days31To60 = Math.round(buckets.days31To60 * 100) / 100
    buckets.days61To90 = Math.round(buckets.days61To90 * 100) / 100
    buckets.over90 = Math.round(buckets.over90 * 100) / 100
    buckets.total = Math.round(buckets.total * 100) / 100

    return buckets
  }, [invoices])

  // 3. Export CSV handler
  const handleExportCSV = () => {
    if (!runningLedger.length) return

    const headers = [
      "Date",
      "Type",
      "Reference",
      "Description",
      "Debit (KES)",
      "Credit (KES)",
      "Running Balance (KES)",
    ]

    const rows = runningLedger.map((row) => [
      `"${row.date}"`,
      `"${row.type}"`,
      `"${row.reference}"`,
      `"${row.description.replace(/"/g, '""')}"`,
      row.debitNum.toFixed(2),
      row.creditNum.toFixed(2),
      row.runningBalance.toFixed(2),
    ])

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n")

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute(
      "download",
      `statement_${(statement?.client_name || clientName || "client").replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handlePrint = () => {
    window.print()
  }

  if (isLoading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center space-y-3 text-muted-foreground">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-xs font-mono">
          Reconciling client financial statement...
        </span>
      </div>
    )
  }

  if (error || !statement) {
    return (
      <div className="p-6 border border-destructive/20 bg-destructive/5 rounded-xl text-center space-y-2">
        <p className="text-sm font-semibold text-destructive">
          Unable to generate client account statement.
        </p>
        <p className="text-xs text-muted-foreground">
          Check that the client has a registered account and valid billing
          record.
        </p>
      </div>
    )
  }

  const netBalance = Number(statement.net_outstanding_balance || 0)
  const isSettled = netBalance <= 0

  return (
    <div className="space-y-6 print:m-0 print:p-0">
      {/* ACTION BAR (Hidden in print) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-muted/40 p-4 rounded-xl border print:hidden">
        <div>
          <h2 className="text-base font-bold text-foreground">
            Account Statement & Running Ledger
          </h2>
          <p className="text-xs text-muted-foreground">
            Chronological debtor ledger with cleared payment allocations and
            debt aging.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="gap-1.5 h-8 text-xs font-medium"
            disabled={runningLedger.length === 0}
          >
            <Download className="size-3.5" />
            Export CSV
          </Button>
          <Button
            size="sm"
            onClick={handlePrint}
            className="gap-1.5 h-8 text-xs bg-primary text-primary-foreground font-medium"
          >
            <Printer className="size-3.5" />
            Print Statement
          </Button>
        </div>
      </div>

      {/* FORMAL A4 STATEMENT CONTAINER */}
      <div className="bg-card border rounded-xl shadow-sm p-6 sm:p-8 space-y-6 print:border-none print:shadow-none print:p-0">
        {/* Statement Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Building2 className="size-5 text-primary" />
              <span className="font-bold tracking-tight text-lg text-foreground">
                HealthWatch Insurance Agency
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Licensed Insurance Agency • Cap 487 Laws of Kenya
            </p>
            <p className="text-xs font-mono text-muted-foreground">
              Agency KRA PIN: P051234567Z • Upper Hill, Nairobi
            </p>
          </div>

          <div className="text-left sm:text-right space-y-1">
            <Badge
              variant="outline"
              className="text-xs font-bold uppercase tracking-wider bg-primary/10 text-primary border-primary/20 px-2.5 py-0.5"
            >
              Statement of Account
            </Badge>
            <p className="text-xs font-mono text-muted-foreground">
              Date:{" "}
              {new Date().toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </p>
            <p className="text-xs font-mono text-muted-foreground">
              Currency: KES (Fixed-Point)
            </p>
          </div>
        </div>

        {/* Client & Period Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg bg-muted/20 border text-xs">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
              Client / Account Debtor
            </span>
            <p className="text-sm font-bold text-foreground">
              {statement.client_name || clientName}
            </p>
            <p className="font-mono text-muted-foreground">
              KRA PIN: {statement.kra_pin || kraPin || "UNRECORDED"}
            </p>
            <p className="text-muted-foreground">
              Account ID:{" "}
              <span className="font-mono">{statement.client_id}</span>
            </p>
          </div>

          <div className="space-y-1 md:text-right">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
              Ledger Health Status
            </span>
            <div>
              {isSettled ? (
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-xs font-semibold"
                >
                  <ShieldCheck className="size-3 mr-1" />
                  Account Settled in Full
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-xs font-semibold"
                >
                  Balance Outstanding
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1">
              {statement.invoice_count} Invoices Issued •{" "}
              {statement.allocation_count} Payment Allocations Cleared
            </p>
          </div>
        </div>

        {/* Financial KPI Trio */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-lg border bg-card space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Total Invoiced (Debits)
            </span>
            <div className="font-mono tabular-nums text-lg font-bold text-foreground">
              {formatCurrency(statement.total_invoiced)}
            </div>
          </div>

          <div className="p-3.5 rounded-lg border bg-card space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Total Cleared (Credits)
            </span>
            <div className="font-mono tabular-nums text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(statement.total_allocated)}
            </div>
          </div>

          <div
            className={`p-3.5 rounded-lg border space-y-1 ${
              isSettled
                ? "bg-emerald-500/5 border-emerald-500/20"
                : "bg-rose-500/5 border-rose-500/20"
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Net Outstanding Balance
            </span>
            <div
              className={`font-mono tabular-nums text-lg font-bold ${
                isSettled
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-rose-700 dark:text-rose-400"
              }`}
            >
              {formatCurrency(statement.net_outstanding_balance)}
            </div>
          </div>
        </div>

        {/* AGED DEBT ANALYSIS (Design System §3.4 Aged Buckets) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Aged Debt Schedule (Unpaid Invoices)
            </span>
            <span className="text-[11px] font-mono text-muted-foreground">
              Total Overdue: {formatCurrency(aging.total)}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-3 rounded-lg border bg-muted/10 space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Current (0–30 Days)
              </span>
              <span className="font-mono tabular-nums text-sm font-bold text-foreground block">
                {formatCurrency(aging.current)}
              </span>
              <span className="text-[10px] text-muted-foreground">
                Standard credit terms
              </span>
            </div>

            <div className="p-3 rounded-lg border bg-muted/10 space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                31–60 Days
              </span>
              <span
                className={`font-mono tabular-nums text-sm font-bold block ${
                  aging.days31To60 > 0
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-foreground"
                }`}
              >
                {formatCurrency(aging.days31To60)}
              </span>
              <span className="text-[10px] text-muted-foreground">
                First reminder cycle
              </span>
            </div>

            <div className="p-3 rounded-lg border bg-muted/10 space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                61–90 Days
              </span>
              <span
                className={`font-mono tabular-nums text-sm font-bold block ${
                  aging.days61To90 > 0
                    ? "text-amber-700 dark:text-amber-300"
                    : "text-foreground"
                }`}
              >
                {formatCurrency(aging.days61To90)}
              </span>
              <span className="text-[10px] text-muted-foreground">
                Second escalation
              </span>
            </div>

            <div className="p-3 rounded-lg border bg-muted/10 space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                &gt; 90 Days
              </span>
              <span
                className={`font-mono tabular-nums text-sm font-bold block ${
                  aging.over90 > 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-foreground"
                }`}
              >
                {formatCurrency(aging.over90)}
              </span>
              <span className="text-[10px] text-muted-foreground">
                Default review tier
              </span>
            </div>
          </div>
        </div>

        <Separator />

        {/* CHRONOLOGICAL RUNNING-BALANCE LEDGER TABLE */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Reconciled Financial Ledger
            </span>
            <span className="text-[11px] font-mono text-muted-foreground">
              {runningLedger.length} Transaction Events
            </span>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-[110px] text-xs font-bold">
                    Date
                  </TableHead>
                  <TableHead className="w-[130px] text-xs font-bold">
                    Type
                  </TableHead>
                  <TableHead className="w-[140px] text-xs font-bold">
                    Reference
                  </TableHead>
                  <TableHead className="text-xs font-bold">
                    Description
                  </TableHead>
                  <TableHead className="text-right text-xs font-bold">
                    Debit (KES)
                  </TableHead>
                  <TableHead className="text-right text-xs font-bold">
                    Credit (KES)
                  </TableHead>
                  <TableHead className="text-right text-xs font-bold">
                    Running Balance (KES)
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runningLedger.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-xs text-muted-foreground"
                    >
                      No transactional ledger entries recorded for this client.
                    </TableCell>
                  </TableRow>
                ) : (
                  runningLedger.map((item, idx) => {
                    const isDebit = item.debitNum > 0
                    return (
                      <TableRow
                        key={`${item.reference}-${idx}`}
                        className="text-xs"
                      >
                        <TableCell className="font-mono text-muted-foreground">
                          {item.date}
                        </TableCell>
                        <TableCell>
                          {item.type === "INVOICE" ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-semibold bg-muted text-foreground border"
                            >
                              <ArrowUpRight className="size-3 mr-1 text-muted-foreground" />
                              INVOICE
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                            >
                              <ArrowDownRight className="size-3 mr-1 text-emerald-600" />
                              ALLOCATION
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono font-medium text-foreground">
                          {item.reference}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.description}
                        </TableCell>
                        <TableCell className="font-mono tabular-nums text-right text-foreground">
                          {isDebit ? formatCurrency(item.debitNum) : "—"}
                        </TableCell>
                        <TableCell className="font-mono tabular-nums text-right text-emerald-600 dark:text-emerald-400">
                          {item.creditNum > 0
                            ? formatCurrency(item.creditNum)
                            : "—"}
                        </TableCell>
                        <TableCell className="font-mono tabular-nums text-right font-bold text-foreground">
                          {formatCurrency(item.runningBalance)}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* SETTLEMENT & RECONCILIATION INSTRUCTIONS */}
        <div className="rounded-lg border bg-muted/20 p-4 space-y-3 text-xs">
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-primary" />
            <span className="font-bold uppercase tracking-wider text-foreground text-[11px]">
              Agency Settlement & Remittance Instructions
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-muted-foreground">
            <div className="space-y-0.5">
              <span className="font-semibold text-foreground block">
                EFT / Wire Transfer
              </span>
              <p>Bank: Standard Chartered Bank Kenya</p>
              <p>Branch: Kenyatta Avenue, Nairobi</p>
              <p className="font-mono text-foreground font-medium">
                A/C: 0102030405000
              </p>
            </div>

            <div className="space-y-0.5">
              <span className="font-semibold text-foreground block">
                M-Pesa Paybill
              </span>
              <p className="font-mono text-foreground font-medium">
                Paybill Business No: 888999
              </p>
              <p>
                Account: Client KRA PIN ({statement.kra_pin || kraPin || "PIN"})
              </p>
            </div>

            <div className="space-y-0.5">
              <span className="font-semibold text-foreground block">
                Remittance Advice
              </span>
              <p>Email: accounts@healthwatch.co.ke</p>
              <p>
                Cleared funds apply strictly per statutory Premium Financing
                rules.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
