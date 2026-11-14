import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Plus, ShieldOff } from "lucide-react"
import { useMemo, useState } from "react"

import { PoliciesService } from "@/client"
import { DataTable } from "@/components/Common/DataTable"
import { EmptyState } from "@/components/Common/EmptyState"
import { NewPolicyWizard } from "@/components/Insurance/Wizard/NewPolicyWizard"
import { columns as policyColumns } from "@/components/Policies/columns"
import { Button } from "@/components/ui/button"
import { queryClient } from "@/queryClient"

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

type PolicyStatusFilter = "all" | "active" | "historical"

function ClientPolicies() {
  const { clientId } = Route.useParams()
  const { data: policiesData } = useSuspenseQuery(
    getPoliciesQueryOptions(clientId),
  )
  const [wizardOpen, setWizardOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<PolicyStatusFilter>("all")

  const policies = policiesData?.data || []

  const activePolicies = useMemo(() => {
    return policies.filter((p) => p.status?.toLowerCase() === "active")
  }, [policies])

  const inactivePolicies = useMemo(() => {
    return policies.filter((p) => p.status?.toLowerCase() !== "active")
  }, [policies])

  const filteredPolicies = useMemo(() => {
    if (statusFilter === "active") return activePolicies
    if (statusFilter === "historical") return inactivePolicies
    return policies
  }, [statusFilter, policies, activePolicies, inactivePolicies])

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
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg w-fit">
            {(
              [
                { key: "all", label: "All", count: policies.length },
                { key: "active", label: "Active", count: activePolicies.length },
                {
                  key: "historical",
                  label: "Historical",
                  count: inactivePolicies.length,
                },
              ] as const
            ).map((tab) => (
              <Button
                key={tab.key}
                variant={statusFilter === tab.key ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setStatusFilter(tab.key)}
              >
                {tab.label} ({tab.count})
              </Button>
            ))}
          </div>

          <div className="border rounded-lg overflow-hidden bg-card">
            <DataTable columns={policyColumns} data={filteredPolicies} />
          </div>
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
