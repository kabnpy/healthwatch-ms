import { createFileRoute, Link } from "@tanstack/react-router"
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  CreditCard,
  Plus,
  Receipt,
  RefreshCw,
  ShieldCheck,
} from "lucide-react"
import { useState } from "react"

import type { PolicyPublic, RenewalPublic } from "@/client"
import { AddClient } from "@/components/Clients/AddClient"
import { RecordPaymentModal } from "@/components/Financials/RecordPaymentModal"
import PendingItems from "@/components/Pending/PendingItems"
import { RenewalTransitionSheet } from "@/components/Renewals/RenewalTransitionSheet"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import useAuth from "@/hooks/useAuth"
import { useDashboardSummary } from "@/hooks/useDashboard"
import { useFinancialSummary } from "@/hooks/useFinancials"
import { getPolicyDisplayName } from "@/utils/insurance"

export const Route = createFileRoute("/_layout/")({
  component: AgencyDashboard,
  head: () => ({
    meta: [
      {
        title: "Agency Dashboard - HealthWatch MS",
      },
    ],
  }),
})

function AgencyDashboard() {
  const { user: currentUser } = useAuth()
  const { data: dashboardSummary, isLoading: isDashboardLoading } =
    useDashboardSummary()
  const { summary } = useFinancialSummary()

  const [isAddReceiptOpen, setIsAddReceiptOpen] = useState(false)
  const [selectedRenewalPolicy, setSelectedRenewalPolicy] = useState<{
    policy: PolicyPublic
    renewal: RenewalPublic | null
    clientName: string
  } | null>(null)

  if (isDashboardLoading) {
    return <PendingItems />
  }

  const triage = {
    activeCount: dashboardSummary?.active_count ?? 0,
    lapsedCount: dashboardSummary?.lapsed_count ?? 0,
    expiring30: (dashboardSummary?.expiring_30 ?? []).map((item) => ({
      policy: item.policy,
      daysLeft: item.days_left,
      clientName: item.client_name,
    })),
  }

  const inFlightRenewals = dashboardSummary?.in_flight_renewals ?? []
  const inFlightRenewalsCount =
    dashboardSummary?.in_flight_renewals_count ?? inFlightRenewals.length

  const today = new Intl.DateTimeFormat("en-KE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date())

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* 1. Header with Agency Greeting & Action Dock */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Agency Operations • {today}
            </p>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mt-1">
            Agency Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Signed in as{" "}
            <span className="font-semibold text-foreground">
              {currentUser?.full_name || currentUser?.email}
            </span>{" "}
            &bull; Daily policy servicing and renewal management
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <AddClient />
          <Button variant="outline" asChild>
            <Link to="/renewals" className="gap-2">
              <RefreshCw className="size-4" />
              Renewals
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/financials" className="gap-2">
              <CreditCard className="size-4" />
              Finances
            </Link>
          </Button>
          <Button
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
            onClick={() => setIsAddReceiptOpen(true)}
          >
            <Plus className="size-4" />
            Record Payment
          </Button>
        </div>
      </div>

      {/* 2. Operational Metrics Ribbon (Strict Invariant: Tabular Numerals) */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1: Policies in Force */}
        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Policies in Force
            </CardTitle>
            <ShieldCheck className="size-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono tabular-nums tracking-tight">
              {triage.activeCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
              <span>Across all clients & carriers</span>
            </p>
          </CardContent>
        </Card>

        {/* Metric 2: Expiring in <= 30 Days */}
        <Card className="border-amber-500/40 bg-amber-500/5 hover:border-amber-500/60 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Expiring in ≤30 Days
            </CardTitle>
            <Clock className="size-4 text-amber-600 animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono tabular-nums tracking-tight text-amber-700 dark:text-amber-400">
              {triage.expiring30.length}
            </div>
            <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-1 flex items-center justify-between">
              <span>Urgent review required</span>
              <Link
                to="/renewals"
                className="font-bold underline hover:text-amber-900"
              >
                Open Queue &rarr;
              </Link>
            </p>
          </CardContent>
        </Card>

        {/* Metric 3: In-Flight Renewal Pipeline */}
        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Renewals Pipeline
            </CardTitle>
            <RefreshCw className="size-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono tabular-nums tracking-tight text-blue-600 dark:text-blue-400">
              {inFlightRenewalsCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
              <span>Navigating 6-stage lifecycle</span>
              <Link to="/renewals" className="font-bold underline text-primary">
                View Desk &rarr;
              </Link>
            </p>
          </CardContent>
        </Card>

        {/* Metric 4: Agency Invoiced Premium */}
        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Invoiced Premium
            </CardTitle>
            <Receipt className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono tabular-nums tracking-tight">
              KES {summary.totalInvoiced.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
              <span>KES {summary.totalPaid.toLocaleString()} collected</span>
              <Link
                to="/financials"
                className="font-bold underline text-primary"
              >
                Accounts &rarr;
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 3. Operational Triage Horizons (2-Column Grid) */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Left Column: Renewals & Expiry Triage */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="size-4 text-amber-600" />
              <h2 className="text-lg font-bold tracking-tight">
                Upcoming Policy Expiries
              </h2>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-xs">
              <Link to="/renewals">
                View All Renewals
                <ArrowRight className="ml-1 size-3.5" />
              </Link>
            </Button>
          </div>

          <Card>
            <CardContent className="p-0 divide-y">
              {triage.expiring30.length === 0 ? (
                <div className="p-8 text-center">
                  <CheckCircle2 className="size-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-semibold">
                    No urgent expiries in the next 30 days
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    All client policies have current, active coverage.
                  </p>
                </div>
              ) : (
                triage.expiring30.slice(0, 6).map(({ policy, daysLeft, clientName }) => {
                  const displayName = getPolicyDisplayName(policy)

                  return (
                    <div
                      key={policy.id}
                      className="p-4 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Link
                            to="/clients/$clientId/policies/$policyId"
                            params={{
                              clientId: policy.client_id,
                              policyId: policy.id,
                            }}
                            className="font-mono text-xs font-bold hover:underline text-primary"
                          >
                            {policy.policy_number}
                          </Link>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              daysLeft <= 7
                                ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20"
                                : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                            }`}
                          >
                            <Clock className="size-2.5" />
                            {daysLeft > 0
                              ? `${daysLeft}d left`
                              : daysLeft === 0
                                ? "Expires today"
                                : "Expired"}
                          </span>
                        </div>
                        <p className="text-sm font-medium truncate mt-0.5">
                          {displayName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {clientName} &bull;{" "}
                          {policy.product?.name || "Insurance Cover"}
                        </p>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 shrink-0"
                        asChild
                      >
                        <Link
                          to="/clients/$clientId/policies/$policyId"
                          params={{
                            clientId: policy.client_id,
                            policyId: policy.id,
                          }}
                        >
                          Review
                          <ArrowRight className="size-3" />
                        </Link>
                      </Button>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: In-Flight Renewal Lifecycle Triage */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="size-4 text-blue-600" />
              <h2 className="text-lg font-bold tracking-tight">
                Renewals in Progress
              </h2>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-xs">
              <Link to="/renewals">
                View All Renewals
                <ArrowRight className="ml-1 size-3.5" />
              </Link>
            </Button>
          </div>

          <Card>
            <CardHeader className="pb-3 border-b bg-muted/20">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>Active Renewals</span>
                <span className="font-mono text-blue-600 font-bold">
                  {inFlightRenewalsCount} in progress
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 divide-y">
              {inFlightRenewals.length === 0 ? (
                <div className="p-8 text-center">
                  <CheckCircle2 className="size-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-semibold">
                    No active renewals in progress
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Policies approaching expiration will appear here for review.
                  </p>
                </div>
              ) : (
                inFlightRenewals.slice(0, 5).map(({ renewal: ren, policy, client_name: clientName }) => {
                  const displayName = policy
                    ? getPolicyDisplayName(policy)
                    : "Insurance Policy"

                  return (
                    <div
                      key={ren.id}
                      className="p-3.5 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-primary">
                            {policy?.policy_number || "POL"}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
                            {(ren.status || "").replace("_", " ")}
                          </span>
                        </div>
                        <p className="text-sm font-medium truncate mt-0.5">
                          {displayName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {clientName}
                          {ren.proposed_premium &&
                            ` • Proposed: KES ${Number(ren.proposed_premium).toLocaleString()}`}
                        </p>
                      </div>

                      {policy && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setSelectedRenewalPolicy({
                              policy,
                              renewal: ren,
                              clientName,
                            })
                          }
                          className="h-8 gap-1 shrink-0 text-xs cursor-pointer"
                        >
                          Manage
                          <ArrowRight className="size-3" />
                        </Button>
                      )}
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>

          {/* Agency Financials & Accounts Shortcut Card */}
          <Card className="border-border/60 bg-muted/20 hover:border-primary/40 transition-colors">
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <CreditCard className="size-4" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Agency Accounts & Ledger
                  </p>
                  <p className="text-xs text-foreground font-mono mt-0.5">
                    KES {summary.totalDue.toLocaleString()} open receivables
                    &bull; KES {summary.totalPaid.toLocaleString()} collected
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                asChild
                className="text-xs shrink-0"
              >
                <Link to="/financials">
                  View Finances
                  <ArrowRight className="ml-1 size-3" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 4. Cashiering / Log Payment Modal */}
      <RecordPaymentModal
        open={isAddReceiptOpen}
        onOpenChange={setIsAddReceiptOpen}
      />

      {/* 5. Renewal Transition Sheet */}
      {selectedRenewalPolicy && (
        <RenewalTransitionSheet
          isOpen={!!selectedRenewalPolicy}
          onOpenChange={(open) => !open && setSelectedRenewalPolicy(null)}
          policy={selectedRenewalPolicy.policy}
          renewal={selectedRenewalPolicy.renewal}
          clientName={selectedRenewalPolicy.clientName}
        />
      )}
    </div>
  )
}
