import { createFileRoute } from "@tanstack/react-router"
import { FileDown, Mail } from "lucide-react"
import { Suspense, useCallback, useState } from "react"
import { PoliciesService } from "@/client"
import { DataTable } from "@/components/Common/DataTable"
import { DocumentManager } from "@/components/Common/DocumentManager"
import { DocumentViewerModal } from "@/components/Common/DocumentViewerModal"
import ErrorComponent from "@/components/Common/ErrorComponent"
import { DocumentViewer } from "@/components/Documents/DocumentViewer"
import { RiskNoteTemplate } from "@/components/Documents/templates/RiskNoteTemplate"
import { RiskNoteForm } from "@/components/Insurance/RiskNoteForm"
import { VersionHistory } from "@/components/Insurance/VersionHistory"
import PendingItems from "@/components/Pending/PendingItems"
import { PolicyDashboardSkeleton } from "@/components/Policies/Dashboard/PolicyDashboardSkeleton"
import { PolicyHeader } from "@/components/Policies/Dashboard/PolicyHeader"
import { getColumns as getRiskNoteColumns } from "@/components/RiskNotes/columns"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useClient, usePolicyDashboard } from "@/hooks/useInsurance"
import { queryClient } from "@/queryClient"
import type { EnhancedPolicy, EnhancedRiskNote } from "@/types/insurance"
import { getPolicyDisplayName } from "@/utils/insurance"

// --- Route Definition ---

export const Route = createFileRoute(
  "/_layout/clients/$clientId/policies/$policyId",
)({
  component: PolicyDashboard,
  errorComponent: ErrorComponent,
  loader: ({ params }) =>
    queryClient.ensureQueryData({
      queryKey: ["policies", params.policyId],
      queryFn: () => PoliciesService.readPolicy({ id: params.policyId }),
    }),
})

// --- Main Page Component ---

function PolicyDashboard() {
  const { clientId, policyId } = Route.useParams()

  return (
    <Suspense fallback={<PolicyDashboardSkeleton />}>
      <PolicyDashboardContent clientId={clientId} policyId={policyId} />
    </Suspense>
  )
}

// --- Component Content (Suspended) ---

function PolicyDashboardContent({
  clientId,
  policyId,
}: {
  clientId: string
  policyId: string
}) {
  const { policy, latestRiskNote, riskNotes, isLoading } =
    usePolicyDashboard(policyId)

  // We need client name for breadcrumbs
  const { data: client } = useClient(clientId)

  // State for Document Viewer
  const [viewerOpen, setViewerOpen] = useState(false)
  const [selectedRiskNoteId, setSelectedRiskNoteId] = useState<string | null>(
    null,
  )
  const [viewType, setViewType] = useState<"risknote" | "invoice">("risknote")

  // State for Risk Note Form
  const [riskNoteFormOpen, setRiskNoteFormOpen] = useState(false)
  const [transactionType, setTransactionType] = useState("Endorsement")
  const [editingRiskNoteId, setEditingRiskNoteId] = useState<
    string | undefined
  >()

  // Handlers
  const handleViewRiskNote = useCallback(
    (id: string, type: "risknote" | "invoice" = "risknote") => {
      setSelectedRiskNoteId(id)
      setViewType(type)
      setViewerOpen(true)
    },
    [],
  )

  const handlePopulateDraft = () => {
    if (latestRiskNote?.id) {
      setTransactionType(latestRiskNote.transaction_type)
      setEditingRiskNoteId(latestRiskNote.id)
      setRiskNoteFormOpen(true)
    }
  }

  const handleRenew = () => {
    setTransactionType("Renewal")
    setEditingRiskNoteId(undefined)
    setRiskNoteFormOpen(true)
  }

  const handleEndorse = () => {
    setTransactionType("Endorsement")
    setEditingRiskNoteId(undefined)
    setRiskNoteFormOpen(true)
  }

  if (isLoading || !policy || !client) {
    return <PendingItems />
  }

  const daysToExpiry = latestRiskNote?.coverage_end
    ? Math.ceil(
        (new Date(latestRiskNote.coverage_end).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      )
    : 0

  const displayName = getPolicyDisplayName(policy)

  return (
    <div className="flex flex-col gap-6">
      <PolicyHeader
        clientName={client.name}
        clientId={client.id}
        policyNumber={policy.policy_number}
        displayName={displayName}
        status={policy.status || "Unknown"}
        onRenew={handleRenew}
        onEndorse={handleEndorse}
      />

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        {/* TAB 1: OVERVIEW (The Digital File) */}
        <TabsContent value="overview" className="pt-6">
          <div className="flex flex-col gap-8 max-w-5xl mx-auto">
            {/* Top Info & Actions Row */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-6 bg-muted/30 p-6 rounded-xl border border-border/50">
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">
                    Coverage Status
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="text-3xl font-bold tracking-tight">
                      {daysToExpiry}
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase leading-tight font-semibold">
                      Days until
                      <br />
                      Expiry
                    </div>
                  </div>
                </div>
                <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${daysToExpiry < 30 ? "bg-destructive" : "bg-blue-500"}`}
                    style={{
                      width: `${Math.min(100, (daysToExpiry / 365) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 h-9 shadow-sm"
                >
                  <FileDown className="size-4" />
                  Download PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 h-9 shadow-sm"
                >
                  <Mail className="size-4" />
                  Email to Client
                </Button>
              </div>
            </div>

            {/* Main Content: The Document */}
            <div className="space-y-6">
              {(latestRiskNote as any)?.status === "Draft" && (
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-500 p-2 rounded-full">
                      <FileDown className="size-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-blue-900">
                        Draft Risk Note Detected
                      </p>
                      <p className="text-xs text-blue-700">
                        This {latestRiskNote?.transaction_type} has not been
                        finalized yet.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                    onClick={handlePopulateDraft}
                  >
                    Populate & Issue
                  </Button>
                </div>
              )}

              {latestRiskNote ? (
                <div className="border rounded-lg shadow-2xl overflow-hidden bg-white dark:bg-zinc-950">
                  <div className="p-1 bg-muted/20 border-b text-[10px] uppercase tracking-widest text-center text-muted-foreground font-semibold">
                    Current Master Risk Note
                  </div>
                  <RiskNoteTemplate
                    riskNote={latestRiskNote as EnhancedRiskNote}
                    client={client}
                    policy={policy as EnhancedPolicy}
                  />
                </div>
              ) : (
                <div className="p-12 text-center border-2 border-dashed rounded-lg bg-muted/10">
                  <p className="text-muted-foreground italic">
                    No transaction history found for this policy.
                  </p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: HISTORY (Risk Notes) */}

        <TabsContent value="history" className="pt-6">
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="flex justify-between items-center border-b pb-4">
              <h3 className="text-xl font-black uppercase tracking-tighter text-slate-900">
                Transaction History
              </h3>
            </div>

            <Tabs defaultValue="timeline" className="w-full">
              <div className="flex justify-end mb-6">
                <TabsList className="bg-slate-100 p-1">
                  <TabsTrigger
                    value="timeline"
                    className="text-xs font-bold uppercase tracking-widest px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                  >
                    Timeline
                  </TabsTrigger>
                  <TabsTrigger
                    value="table"
                    className="text-xs font-bold uppercase tracking-widest px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                  >
                    Table
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent
                value="timeline"
                className="animate-in fade-in slide-in-from-bottom-2 duration-300"
              >
                <VersionHistory
                  riskNotes={riskNotes}
                  onView={(rn) => handleViewRiskNote(rn.id, "risknote")}
                />
              </TabsContent>

              <TabsContent
                value="table"
                className="animate-in fade-in slide-in-from-bottom-2 duration-300"
              >
                <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
                  <DataTable
                    columns={getRiskNoteColumns((rn) =>
                      handleViewRiskNote(rn.id, "risknote"),
                    )}
                    data={riskNotes}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>

        {/* TAB 4: DOCUMENTS */}
        <TabsContent value="documents" className="pt-6">
          <DocumentManager
            entityId={policyId}
            entityType="Policy"
            title="Policy Support Documents"
          />
        </TabsContent>
      </Tabs>

      {/* Document Viewer Modal */}
      {selectedRiskNoteId && (
        <DocumentViewerModal
          isOpen={viewerOpen}
          onClose={() => setViewerOpen(false)}
          title={`Document: ${selectedRiskNoteId}`}
        >
          <Suspense fallback={<PendingItems />}>
            <DocumentViewer id={selectedRiskNoteId} type={viewType} />
          </Suspense>
        </DocumentViewerModal>
      )}

      {/* Risk Note Form Dialog (Renewals/Endorsements) */}
      <Dialog open={riskNoteFormOpen} onOpenChange={setRiskNoteFormOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {transactionType} for Policy {policy.policy_number}
            </DialogTitle>
            <DialogDescription>
              Create a new financial transaction for this policy.
            </DialogDescription>
          </DialogHeader>
          <RiskNoteForm
            policyId={policyId}
            riskNoteId={editingRiskNoteId}
            onSuccess={() => setRiskNoteFormOpen(false)}
            onCancel={() => setRiskNoteFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
