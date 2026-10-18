import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Plus, ShieldOff } from "lucide-react"
import { useState } from "react"
import { PoliciesService } from "@/client"
import { DataTable } from "@/components/Common/DataTable"
import { EmptyState } from "@/components/Common/EmptyState"
import { NewPolicyWizard } from "@/components/Insurance/Wizard/NewPolicyWizard"
import { columns as policyColumns } from "@/components/Policies/columns"
import { Button } from "@/components/ui/button"

function getPoliciesQueryOptions(clientId: string) {
  return {
    queryFn: async () =>
      (
        await PoliciesService.readPolicies({
          query: { client_id: clientId, skip: 0, limit: 100 },
        })
      ).data,
    queryKey: ["policies", { clientId }],
  }
}

export const Route = createFileRoute("/_layout/clients/$clientId/policies/")({
  component: ClientPolicies,
})

function ClientPolicies() {
  const { clientId } = Route.useParams()
  const { data: policies } = useSuspenseQuery(getPoliciesQueryOptions(clientId))
  const [wizardOpen, setWizardOpen] = useState(false)

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight">Policies</h2>
        <Button onClick={() => setWizardOpen(true)} className="gap-2">
          <Plus className="size-4" />
          New Policy
        </Button>
      </div>
      {policies.data.length === 0 ? (
        <EmptyState
          title="No policies found"
          description="This client doesn't have any insurance policies yet. Use the wizard to create one."
          icon={ShieldOff}
          action={{
            label: "Create First Policy",
            onClick: () => setWizardOpen(true),
            icon: Plus,
          }}
        />
      ) : (
        <DataTable columns={policyColumns} data={policies.data} />
      )}

      <NewPolicyWizard
        clientId={clientId}
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
      />
    </div>
  )
}
