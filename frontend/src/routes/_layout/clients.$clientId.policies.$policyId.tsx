import { createFileRoute } from "@tanstack/react-router"
import { Eye, FileDown, FileText, Mail, Printer } from "lucide-react"
import { Suspense, useCallback, useState } from "react"
import { PoliciesService } from "@/client"
import { ActivityTimeline } from "@/components/Activities/ActivityTimeline"
import { DataTable } from "@/components/Common/DataTable"
import { DocumentManager } from "@/components/Common/DocumentManager"
import { DocumentViewerModal } from "@/components/Common/DocumentViewerModal"
import ErrorComponent from "@/components/Common/ErrorComponent"
import { DocumentPreviewDrawer } from "@/components/Documents/DocumentPreviewDrawer"
import { DocumentViewer } from "@/components/Documents/DocumentViewer"
import { RiskNoteForm } from "@/components/Insurance/RiskNoteForm"
import { VersionHistory } from "@/components/Insurance/VersionHistory"
import PendingItems from "@/components/Pending/PendingItems"
import { CoverageMatrixCard } from "@/components/Policies/CoverageMatrixCard"
import { PolicyDashboardSkeleton } from "@/components/Policies/Dashboard/PolicyDashboardSkeleton"
import { PolicyHeader } from "@/components/Policies/Dashboard/PolicyHeader"
import { MedicalPolicyView } from "@/components/Policies/MedicalPolicyView"
import { VehicleAssetCard } from "@/components/Policies/VehicleAssetCard"
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
      queryFn: async () =>
        (await PoliciesService.readPolicy({ path: { id: params.policyId } }))
          .data,
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
  const [previewDrawerOpen, setPreviewDrawerOpen] = useState(false)

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

  const isMedical =
    policy.product?.class_of_insurance?.toLowerCase().includes("medical") ||
    policy.product?.name?.toLowerCase().includes("medical") ||
    policy.product?.name?.toLowerCase().includes("health") ||
    false

  const isMotor =
    policy.product?.class_of_insurance?.toLowerCase().includes("motor") || false

  const vehicle =
    (policy as any).vehicles?.[0] ||
    (latestRiskNote?.cover_snapshot as any)?.vehicle ||
    (policy as any).vehicle

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
        <TabsList className="bg-transparent border-b rounded-none w-full justify-start p-0 h-10 gap-6">
          <TabsTrigger
            value="overview"
            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 font-semibold text-xs pb-2.5 transition-none"
          >
            Digital File
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 font-semibold text-xs pb-2.5 transition-none"
          >
            {isMedical ? "Census & Endorsement History" : "Risk Note Versions"}
          </TabsTrigger>
          <TabsTrigger
            value="timeline"
            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 font-semibold text-xs pb-2.5 transition-none"
          >
            Activity & Audit Log
          </TabsTrigger>
          <TabsTrigger
            value="documents"
            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 font-semibold text-xs pb-2.5 transition-none"
          >
            Documents
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: OVERVIEW (The Digital File) */}
        <TabsContent value="overview" className="pt-6">
          <div className="flex flex-col gap-8 max-w-5xl mx-auto">
            {isMedical ? (
              <MedicalPolicyView
                policy={policy as EnhancedPolicy}
                client={client}
                latestRiskNote={latestRiskNote as EnhancedRiskNote}
                onEndorseCensus={handleEndorse}
              />
            ) : (
              <>
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
                      className="gap-2 h-9 shadow-sm cursor-pointer"
                      onClick={() => setPreviewDrawerOpen(true)}
                      disabled={!latestRiskNote?.id}
                    >
                      <Printer className="size-4" />
                      Print / Export Schedule
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 h-9 shadow-sm"
                      onClick={() => {
                        if (!client?.email) {
                          alert("No email address registered for this client.")
                          return
                        }
                        const subject = encodeURIComponent(
                          `Policy ${policy.policy_number} - ${displayName}`,
                        )
                        const body = encodeURIComponent(
                          `Dear ${client.name},\n\nPlease find attached details for your policy ${policy.policy_number}.\n\nCoverage Period: ${latestRiskNote?.coverage_start || ""} to ${latestRiskNote?.coverage_end || ""}\n\nKind regards,\nHealthWatch MS`,
                        )
                        window.location.href = `mailto:${client.email}?subject=${subject}&body=${body}`
                      }}
                    >
                      <Mail className="size-4" />
                      Email Client
                    </Button>
                  </div>
                </div>

                {/* Draft Risk Note Alert if present */}
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

                {/* Vehicle Asset Card for Motor policies */}
                {(isMotor || vehicle) && <VehicleAssetCard vehicle={vehicle} />}

                {/* Interactive Coverage & Statutory Levies Matrix */}
                {latestRiskNote && (
                  <CoverageMatrixCard
                    policy={policy as EnhancedPolicy}
                    riskNote={latestRiskNote as EnhancedRiskNote}
                    onOpenPreview={() => setPreviewDrawerOpen(true)}
                  />
                )}

                {/* Outbound Document Engine Action Banner */}
                {latestRiskNote && (
                  <div className="rounded-xl border bg-muted/20 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                        <FileText className="size-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-foreground">
                          Official Carrier Policy Schedule (A4 Format)
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Pre-flight verified underwriter transmittal slip with
                          digital certified seal, fixed-point taxes, and legal
                          schedule notes.
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => setPreviewDrawerOpen(true)}
                      disabled={!latestRiskNote?.id}
                      className="gap-2 shrink-0 cursor-pointer text-xs"
                    >
                      <Eye className="size-3.5" />
                      View Outbound A4 Slip
                    </Button>
                  </div>
                )}
              </>
            )}
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

        {/* TAB 3: ACTIVITY TIMELINE */}
        <TabsContent value="timeline" className="pt-6">
          <div className="max-w-4xl mx-auto">
            <ActivityTimeline clientId={client.id} policyId={policy.id} />
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
            initialTransactionType={transactionType}
            onSuccess={() => setRiskNoteFormOpen(false)}
            onCancel={() => setRiskNoteFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Outbound A4 Document Engine Drawer */}
      <DocumentPreviewDrawer
        isOpen={previewDrawerOpen}
        onOpenChange={setPreviewDrawerOpen}
        riskNote={latestRiskNote as EnhancedRiskNote}
        client={client}
        policy={policy as EnhancedPolicy}
        onEditDraft={handlePopulateDraft}
      />
    </div>
  )
}
