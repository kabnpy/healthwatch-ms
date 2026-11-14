import { createFileRoute, Link } from "@tanstack/react-router"
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Receipt,
  RefreshCw,
  ShieldCheck,
} from "lucide-react"
import { useMemo, useState } from "react"

import type { PolicyPublic, RenewalPublic } from "@/client"
import { AddClient } from "@/components/Clients/AddClient"
import { QueryErrorBanner } from "@/components/Common/QueryErrorBanner"
import PendingItems from "@/components/Pending/PendingItems"
import { RenewalTransitionSheet } from "@/components/Renewals/RenewalTransitionSheet"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import useAuth from "@/hooks/useAuth"
import { useClients } from "@/hooks/useClients"
import { useFinancialSummary } from "@/hooks/useFinancials"
import { usePolicies } from "@/hooks/usePolicies"
import { useRenewals } from "@/hooks/useRenewals"
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

const RENEWAL_STAGE_META: Record<
  string,
  { label: string; actionLabel: string; badgeClass: string }
> = {
  awaiting_carrier: {
    label: "Awaiting Insurer",
    actionLabel: "Log Insurer Terms",
    badgeClass:
      "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  },
  carrier_received: {
    label: "Insurer Terms Received",
    actionLabel: "Prepare Invitation",
    badgeClass:
      "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  },
  client_invited: {
    label: "Client Invited",
    actionLabel: "Follow Up",
    badgeClass:
      "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20",
  },
  changes_requested: {
    label: "Changes Requested",
    actionLabel: "Revise Terms",
    badgeClass:
      "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
  },
  paid: {
    label: "Payment Recorded",
    actionLabel: "Complete Renewal",
    badgeClass:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  },
}

function getRenewalStageMeta(status?: string | null) {
  const key = (status || "").toLowerCase()
  return (
    RENEWAL_STAGE_META[key] || {
      label: (status || "In Progress").replace(/_/g, " "),
      actionLabel: "Update Renewal",
      badgeClass:
        "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
    }
  )
}

function AgencyDashboard() {
  const { user: currentUser } = useAuth()
  const {
    data: policiesData,
    isLoading: isPoliciesLoading,
    isError: isPoliciesError,
    refetch: refetchPolicies,
  } = usePolicies(undefined, 0, 200)
  const {
    data: clientsData,
    isLoading: isClientsLoading,
    isError: isClientsError,
    refetch: refetchClients,
  } = useClients(0, 200)
  const {
    data: renewalsData,
    isLoading: isRenewalsLoading,
    isError: isRenewalsError,
    refetch: refetchRenewals,
  } = useRenewals(undefined, undefined, 0, 200)
  const {
    summary,
    isError: isSummaryError,
    refetch: refetchSummary,
  } = useFinancialSummary()

  const [selectedRenewalPolicy, setSelectedRenewalPolicy] = useState<{
    policy: PolicyPublic
    renewal: RenewalPublic | null
  } | null>(null)

  const clientMap = useMemo(() => {
    const map = new Map<string, string>()
    clientsData?.data?.forEach((c) => {
      map.set(c.id, c.name)
    })
    return map
  }, [clientsData])

  const policies = policiesData?.data || []
  const renewals = renewalsData?.data || []

  const inFlightRenewals = useMemo(() => {
    return renewals.filter(
      (r) =>
        !["completed", "cancelled"].includes(r.status?.toLowerCase() || ""),
    )
  }, [renewals])

  const activeRenewalPolicyIds = useMemo(() => {
    return new Set(inFlightRenewals.map((r) => r.policy_id))
  }, [inFlightRenewals])

  const triage = useMemo(() => {
    const now = Date.now()
    const expiring30: Array<{ policy: PolicyPublic; daysLeft: number }> = []
    let activeCount = 0

    policies.forEach((policy) => {
      if (policy.status?.toLowerCase() === "active") {
        activeCount++
      }

      if (activeRenewalPolicyIds.has(policy.id)) return

      const activeNote = policy.active_note
      if (!activeNote?.coverage_end) return

      const endDate = new Date(activeNote.coverage_end).getTime()
      const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24))

      if (daysLeft >= 0 && daysLeft <= 30) {
        expiring30.push({ policy, daysLeft })
      }
    })

    expiring30.sort((a, b) => a.daysLeft - b.daysLeft)

    return {
      activeCount,
      expiring30,
    }
  }, [policies, activeRenewalPolicyIds])

  const policyMap = useMemo(() => {
    const map = new Map<string, PolicyPublic>()
    policies.forEach((p) => {
      map.set(p.id, p)
    })
    return map
  }, [policies])

  if (isPoliciesLoading || isClientsLoading || isRenewalsLoading) {
    return <PendingItems />
  }

  const today = new Intl.DateTimeFormat("en-KE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date())

  const hasExpiringPolicies = triage.expiring30.length > 0

  if (isPoliciesError || isClientsError || isRenewalsError || isSummaryError) {
    const handleRetry = () => {
      if (isPoliciesError) void refetchPolicies()
      if (isClientsError) void refetchClients()
      if (isRenewalsError) void refetchRenewals()
      if (isSummaryError) void refetchSummary()
    }
    return (
      <div className="p-6">
        <QueryErrorBanner
          message="Failed to load dashboard data. Please try again."
          onRetry={handleRetry}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* 1. Header with Single Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Agency Operations &bull; {today}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight mt-1">
            Agency Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Signed in as{" "}
            <span className="font-semibold text-foreground">
              {currentUser?.full_name || currentUser?.email}
            </span>{" "}
            &bull; Daily policy servicing and renewal triage
          </p>
        </div>

        <div className="flex items-center shrink-0">
          <AddClient />
        </div>
      </div>

      {/* 2. Operational Metrics Ribbon (Strict Invariant: Tabular Numerals) */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
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
            <p className="text-xs text-muted-foreground mt-1">
              Across all clients &amp; insurers
            </p>
          </CardContent>
        </Card>

        <Card
          className={
            hasExpiringPolicies
              ? "border-amber-500/40 bg-amber-500/5"
              : undefined
          }
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle
              className={`text-xs font-bold uppercase tracking-wider ${
                hasExpiringPolicies
                  ? "text-amber-700 dark:text-amber-400"
                  : "text-muted-foreground"
              }`}
            >
              Expiring in &le;30 Days
            </CardTitle>
            <Clock
              className={`size-4 ${
                hasExpiringPolicies ? "text-amber-600" : "text-muted-foreground"
              }`}
            />
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold font-mono tabular-nums tracking-tight ${
                hasExpiringPolicies ? "text-amber-700 dark:text-amber-400" : ""
              }`}
            >
              {triage.expiring30.length}
            </div>
            <div className="text-xs text-muted-foreground mt-1 flex items-center justify-between gap-2">
              {hasExpiringPolicies ? (
                <>
                  <span className="text-amber-700/80 dark:text-amber-400/80">
                    Needs renewal start
                  </span>
                  <Link
                    to="/renewals"
                    className="font-semibold underline whitespace-nowrap shrink-0 text-amber-800 dark:text-amber-300"
                  >
                    Review &rarr;
                  </Link>
                </>
              ) : (
                <span>No unstarted expiries</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Renewals Pipeline
            </CardTitle>
            <RefreshCw className="size-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono tabular-nums tracking-tight text-blue-600 dark:text-blue-400">
              {inFlightRenewals.length}
            </div>
            <div className="text-xs text-muted-foreground mt-1 flex items-center justify-between gap-2">
              <span>Active 6-stage workflows</span>
              <Link
                to="/renewals"
                className="font-semibold underline whitespace-nowrap shrink-0 text-primary"
              >
                Open Desk &rarr;
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Invoiced Premium
            </CardTitle>
            <Receipt className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl xl:text-2xl font-bold font-mono tabular-nums tracking-tight whitespace-nowrap">
              KES {summary.totalInvoiced.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground mt-1 flex items-center justify-between gap-2">
              <span className="tabular-nums">
                KES {summary.totalPaid.toLocaleString()} collected
              </span>
              <Link
                to="/financials"
                className="font-semibold underline whitespace-nowrap shrink-0 text-primary"
              >
                Financials &rarr;
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Prioritized Operational Queues */}
      <div className="flex flex-col gap-6">
        {hasExpiringPolicies ? (
          <Card>
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-amber-600" />
                <CardTitle className="text-base font-bold tracking-tight">
                  Expiring Policies Without Active Renewal
                </CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="text-xs whitespace-nowrap"
              >
                <Link to="/renewals">
                  All Renewals
                  <ArrowRight className="ml-1 size-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0 divide-y">
              {triage.expiring30.slice(0, 6).map(({ policy, daysLeft }) => {
                const clientName = clientMap.get(policy.client_id) || "Client"
                const rawDisplay = getPolicyDisplayName(policy)
                const title =
                  rawDisplay && rawDisplay !== policy.policy_number
                    ? `${clientName} — ${rawDisplay}`
                    : `${clientName} — ${policy.product?.name || "Insurance Cover"}`

                return (
                  <div
                    key={policy.id}
                    className="p-4 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
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
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${
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
                      <p className="text-sm font-medium truncate mt-1">
                        {title}
                      </p>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 shrink-0 whitespace-nowrap"
                      asChild
                    >
                      <Link
                        to="/clients/$clientId/policies/$policyId"
                        params={{
                          clientId: policy.client_id,
                          policyId: policy.id,
                        }}
                      >
                        Review Policy
                        <ArrowRight className="size-3" />
                      </Link>
                    </Button>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        ) : (
          <div className="flex items-center gap-2.5 rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
            <span>
              All policies expiring within 30 days are already in renewal or
              current.
            </span>
          </div>
        )}

        {/* Active Renewals Queue */}
        <Card>
          <CardHeader className="pb-3 border-b flex flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="size-4 text-blue-600" />
              <CardTitle className="text-base font-bold tracking-tight">
                Renewals in Progress
              </CardTitle>
              <span className="font-mono text-xs font-semibold text-muted-foreground tabular-nums">
                ({inFlightRenewals.length})
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="text-xs whitespace-nowrap"
            >
              <Link to="/renewals">
                View All Renewals
                <ArrowRight className="ml-1 size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0 divide-y">
            {inFlightRenewals.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle2 className="size-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-semibold">
                  No active renewals in progress
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Policies approaching expiration will appear here for triage.
                </p>
              </div>
            ) : (
              inFlightRenewals.slice(0, 8).map((ren) => {
                const policy = policyMap.get(ren.policy_id)
                const clientName = policy
                  ? clientMap.get(policy.client_id) || "Client"
                  : "Client"
                const rawDisplay = policy ? getPolicyDisplayName(policy) : ""
                const title =
                  policy && rawDisplay && rawDisplay !== policy.policy_number
                    ? `${clientName} — ${rawDisplay}`
                    : `${clientName} — ${policy?.product?.name || "Insurance Policy"}`
                const stage = getRenewalStageMeta(ren.status)

                return (
                  <div
                    key={ren.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-primary">
                          {policy?.policy_number || "POL"}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${stage.badgeClass}`}
                        >
                          {stage.label}
                        </span>
                      </div>
                      <p className="text-sm font-medium truncate mt-1">
                        {title}
                      </p>
                      {ren.proposed_premium && (
                        <p className="text-xs text-muted-foreground font-mono tabular-nums mt-0.5">
                          Proposed: KES{" "}
                          {Number(ren.proposed_premium).toLocaleString()}
                        </p>
                      )}
                    </div>

                    {policy && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setSelectedRenewalPolicy({ policy, renewal: ren })
                        }
                        className="h-8 gap-1.5 shrink-0 text-xs cursor-pointer whitespace-nowrap self-start sm:self-center"
                      >
                        {stage.actionLabel}
                        <ArrowRight className="size-3" />
                      </Button>
                    )}
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Renewal Transition Sheet */}
      {selectedRenewalPolicy && (
        <RenewalTransitionSheet
          isOpen={!!selectedRenewalPolicy}
          onOpenChange={(open) => !open && setSelectedRenewalPolicy(null)}
          policy={selectedRenewalPolicy.policy}
          renewal={selectedRenewalPolicy.renewal}
          clientName={
            clientMap.get(selectedRenewalPolicy.policy.client_id) || "Client"
          }
        />
      )}
    </div>
  )
}
