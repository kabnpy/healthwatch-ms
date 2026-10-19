import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import {
  ArrowRight,
  Car,
  Clock,
  Home,
  Plus,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldOff,
} from "lucide-react"
import { useMemo, useState } from "react"

import type { PolicyPublic } from "@/client"
import { PoliciesService } from "@/client"
import { DataTable } from "@/components/Common/DataTable"
import { EmptyState } from "@/components/Common/EmptyState"
import { NewPolicyWizard } from "@/components/Insurance/Wizard/NewPolicyWizard"
import { columns as policyColumns } from "@/components/Policies/columns"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { queryClient } from "@/queryClient"
import { formatCurrency } from "@/utils"
import { getPolicyDisplayName } from "@/utils/insurance"

function getPoliciesQueryOptions(clientId: string) {
  return {
    queryFn: async () =>
      (
        await PoliciesService.readPolicies({
          query: { client_id: clientId, skip: 0, limit: 100 },
        })
      ).data,
    queryKey: ["policies", { clientId }],
    staleTime: 1000 * 60 * 2,
  }
}

export const Route = createFileRoute("/_layout/clients/$clientId/policies/")({
  component: ClientPolicies,
  loader: ({ params }) =>
    queryClient.ensureQueryData(getPoliciesQueryOptions(params.clientId)),
})

function getCoverIcon(classOfInsurance?: string, name?: string) {
  const combined = `${classOfInsurance || ""} ${name || ""}`.toLowerCase()
  if (
    combined.includes("motor") ||
    combined.includes("vehicle") ||
    combined.includes("car")
  ) {
    return Car
  }
  if (
    combined.includes("home") ||
    combined.includes("domestic") ||
    combined.includes("fire")
  ) {
    return Home
  }
  return Shield
}

function PolicyCard({
  policy,
  clientId,
}: {
  policy: PolicyPublic
  clientId: string
}) {
  const activeNote = policy.active_note
  const snapshot = activeNote?.cover_snapshot as any
  const displayName = getPolicyDisplayName(policy)
  const productClass =
    policy.product?.class_of_insurance ||
    policy.product?.name ||
    "General Insurance"

  const Icon = getCoverIcon(
    policy.product?.class_of_insurance,
    policy.product?.name,
  )

  const rawSum = snapshot?.vehicle?.sum_insured || snapshot?.sum_insured || 0

  const premium = activeNote?.total_amount ? Number(activeNote.total_amount) : 0

  const now = Date.now()
  const daysLeft = activeNote?.coverage_end
    ? Math.ceil(
        (new Date(activeNote.coverage_end).getTime() - now) /
          (1000 * 60 * 60 * 24),
      )
    : null

  const isActive = policy.status === "Active"
  const isExpiringSoon = daysLeft !== null && daysLeft <= 30 && daysLeft >= 0
  const isExpired = daysLeft !== null && daysLeft < 0

  return (
    <Card className="flex flex-col justify-between hover:border-primary/50 hover:shadow-md transition-all">
      <CardHeader className="pb-3 border-b bg-muted/15">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
              <Icon className="size-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                {productClass}
              </span>
              <CardTitle className="text-sm font-bold font-mono tracking-tight">
                {policy.policy_number}
              </CardTitle>
            </div>
          </div>

          {/* Status Badge */}
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold border shrink-0 ${
              isExpired
                ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20"
                : isExpiringSoon
                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 animate-pulse"
                  : isActive
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                    : "bg-muted text-muted-foreground border-border"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${
                isExpired
                  ? "bg-rose-500"
                  : isExpiringSoon
                    ? "bg-amber-500"
                    : isActive
                      ? "bg-emerald-500"
                      : "bg-muted-foreground"
              }`}
            />
            {isExpired
              ? "Expired"
              : isExpiringSoon
                ? `${daysLeft}d to Expiry`
                : policy.status}
          </span>
        </div>
      </CardHeader>

      <CardContent className="pt-4 pb-2 space-y-3">
        {/* Asset / Description */}
        <div>
          <p className="text-base font-bold tracking-tight text-foreground line-clamp-1">
            {displayName}
          </p>
          <p className="text-xs text-muted-foreground">
            Carrier:{" "}
            <span className="font-medium text-foreground">
              {policy.product?.name || "Direct Cover"}
            </span>
          </p>
        </div>

        {/* Financials Strip (Strict Invariant: Zero Proportional Numerals) */}
        <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-muted/30 border text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">
              Sum Insured
            </span>
            <span className="font-mono tabular-nums font-bold text-foreground">
              {rawSum > 0 ? formatCurrency(rawSum) : "—"}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">
              Annual Premium
            </span>
            <span className="font-mono tabular-nums font-bold text-foreground">
              {premium > 0 ? formatCurrency(premium) : "—"}
            </span>
          </div>
        </div>

        {/* Coverage Dates */}
        {activeNote?.coverage_start && activeNote?.coverage_end && (
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
            <span className="flex items-center gap-1 font-mono">
              <Clock className="size-3" />
              {activeNote.coverage_start} &rarr; {activeNote.coverage_end}
            </span>
            {daysLeft !== null && daysLeft > 0 && !isExpiringSoon && (
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {daysLeft} days active
              </span>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-3 border-t bg-muted/10 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs font-semibold px-2"
          asChild
        >
          <Link
            to="/clients/$clientId/policies/$policyId"
            params={{ clientId, policyId: policy.id }}
          >
            Digital File
            <ArrowRight className="ml-1 size-3.5" />
          </Link>
        </Button>

        {isExpiringSoon && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1 border-amber-500/30 text-amber-700 hover:bg-amber-500/10"
            asChild
          >
            <Link
              to="/clients/$clientId/policies/$policyId"
              params={{ clientId, policyId: policy.id }}
            >
              <RefreshCw className="size-3" />
              Renew
            </Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

function ClientPolicies() {
  const { clientId } = Route.useParams()
  const { data: policiesData } = useSuspenseQuery(
    getPoliciesQueryOptions(clientId),
  )
  const [wizardOpen, setWizardOpen] = useState(false)
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid")

  const policies = policiesData?.data || []

  const activePolicies = useMemo(() => {
    return policies.filter((p) => p.status === "Active")
  }, [policies])

  const inactivePolicies = useMemo(() => {
    return policies.filter((p) => p.status !== "Active")
  }, [policies])

  return (
    <div className="space-y-6 pt-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Active Policies & Covers
          </h2>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
            {activePolicies.length} Active{" "}
            {activePolicies.length === 1 ? "Cover" : "Covers"} In Force
            {inactivePolicies.length > 0 &&
              ` • ${inactivePolicies.length} Historical/Lapsed`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {policies.length > 0 && (
            <div className="flex bg-muted p-1 rounded-lg">
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setViewMode("grid")}
              >
                Cards View
              </Button>
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setViewMode("table")}
              >
                Table View
              </Button>
            </div>
          )}

          <Button onClick={() => setWizardOpen(true)} className="gap-2">
            <Plus className="size-4" />
            New Policy
          </Button>
        </div>
      </div>

      {/* Main Content */}
      {policies.length === 0 ? (
        <EmptyState
          title="No insurance policies in portfolio"
          description="This client doesn't have any insurance policies yet. Launch the policy wizard to incept a new cover."
          icon={ShieldOff}
          action={{
            label: "Incept First Policy",
            onClick: () => setWizardOpen(true),
            icon: Plus,
          }}
        />
      ) : viewMode === "grid" ? (
        <div className="space-y-8">
          {/* Active Policies Grid */}
          <div>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {activePolicies.map((policy) => (
                <PolicyCard
                  key={policy.id}
                  policy={policy}
                  clientId={clientId}
                />
              ))}
            </div>
          </div>

          {/* Historical / Lapsed Covers Section */}
          {inactivePolicies.length > 0 && (
            <div className="pt-4 border-t space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <ShieldAlert className="size-4 text-muted-foreground" />
                  Historical / Lapsed Policies ({inactivePolicies.length})
                </h3>
              </div>
              <div className="border rounded-lg overflow-hidden bg-card">
                <DataTable columns={policyColumns} data={inactivePolicies} />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden bg-card">
          <DataTable columns={policyColumns} data={policies} />
        </div>
      )}

      {/* New Policy Wizard Modal */}
      <NewPolicyWizard
        clientId={clientId}
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
      />
    </div>
  )
}
