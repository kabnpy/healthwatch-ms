import { createFileRoute } from "@tanstack/react-router"
import { FileDown, FileText, Mail } from "lucide-react"
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
import PendingItems from "@/components/Pending/PendingItems"
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
import { formatCurrency } from "@/utils"
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

  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.replace("#", "")
      if (hash === "risk-notes" || hash === "history") return "history"
      if (hash === "documents" || hash === "certificates") return "documents"
      if (hash === "timeline") return "timeline"
    }
    return "overview"
  })

  if (isLoading || !policy || !client) {
    return <PendingItems />
  }

  let expiryDateStr = latestRiskNote?.coverage_end
  if (!expiryDateStr && policy.inception_date) {
    const d = new Date(policy.inception_date)
    d.setFullYear(d.getFullYear() + 1)
    d.setDate(d.getDate() - 1)
    expiryDateStr = d.toISOString().split("T")[0]
  }

  const daysToExpiry = expiryDateStr
    ? Math.ceil(
        (new Date(expiryDateStr).getTime() - Date.now()) /
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

  const snapshot = (latestRiskNote?.cover_snapshot as any) || {}
  const rawSum =
    snapshot.vehicle?.sum_insured ||
    snapshot.sum_insured ||
    (vehicle as any)?.insured_value ||
    (vehicle as any)?.sum_insured ||
    (isMedical ? 2000000 : Number(latestRiskNote?.net_premium || 0) * 20)

  const invoice = (latestRiskNote?.invoice_line_items?.[0] as any)?.invoice
  const balanceDue = Number(invoice?.balance_due ?? 0)
  const isSettled = invoice ? balanceDue === 0 : false

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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-transparent border-b rounded-none w-full justify-start p-0 h-10 gap-6">
          <TabsTrigger
            value="overview"
            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 font-semibold text-xs pb-2.5 transition-none"
          >
            Overview
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

        {/* TAB 1: OVERVIEW */}
        <TabsContent value="overview" className="pt-6">
          <div className="flex flex-col gap-6 max-w-5xl mx-auto">
            {isMedical ? (
              <MedicalPolicyView
                policy={policy as EnhancedPolicy}
                client={client}
                latestRiskNote={latestRiskNote as EnhancedRiskNote}
                onEndorseCensus={handleEndorse}
              />
            ) : (
              <>
                {/* Policy Schedule Header & Primary Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl border bg-card shadow-sm">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-wider">
                        Official Policy Schedule
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                          latestRiskNote?.status === "Draft"
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                            : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                        }`}
                      >
                        {latestRiskNote?.status || "Final"}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-foreground">
                      {displayName}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Ref:{" "}
                      <span className="font-mono font-medium">
                        {latestRiskNote?.risk_note_number || "DRAFT"}
                      </span>
                      {latestRiskNote?.coverage_start &&
                        latestRiskNote?.coverage_end && (
                          <span>
                            {" "}
                            &bull; Term: {latestRiskNote.coverage_start} to{" "}
                            {latestRiskNote.coverage_end}
                          </span>
                        )}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setPreviewDrawerOpen(true)}
                      disabled={!latestRiskNote?.id}
                      className="gap-2 h-9 cursor-pointer shadow-sm text-xs font-semibold"
                    >
                      <FileText className="size-4" />
                      <span>View Schedule</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 h-9 text-xs cursor-pointer"
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
                      <span>Email Client</span>
                    </Button>
                  </div>
                </div>

                {/* Key Figures Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl border bg-card shadow-sm space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Sum Insured
                    </span>
                    <p className="text-lg font-bold font-mono tabular-nums text-foreground">
                      {rawSum > 0 ? formatCurrency(rawSum) : "—"}
                    </p>
                    <span className="text-[11px] text-muted-foreground block truncate">
                      {policy.product?.class_of_insurance || "Agreed Value"}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl border bg-card shadow-sm space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Net Premium
                    </span>
                    <p className="text-lg font-bold font-mono tabular-nums text-foreground">
                      {latestRiskNote?.net_premium != null
                        ? formatCurrency(latestRiskNote.net_premium)
                        : "—"}
                    </p>
                    <span className="text-[11px] text-muted-foreground block truncate">
                      {latestRiskNote?.total_amount != null
                        ? `Total Payable: ${formatCurrency(latestRiskNote.total_amount)}`
                        : "Excludes statutory levies"}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl border bg-card shadow-sm space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Invoice Balance
                    </span>
                    <p className="text-lg font-bold font-mono tabular-nums text-foreground">
                      {invoice ? (
                        isSettled ? (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            Settled in Full
                          </span>
                        ) : (
                          formatCurrency(balanceDue)
                        )
                      ) : (
                        "Pending"
                      )}
                    </p>
                    <span className="text-[11px] text-muted-foreground block truncate">
                      {invoice
                        ? `Invoice #${invoice.invoice_number}`
                        : "Unbilled"}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl border bg-card shadow-sm space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Policy Expiry
                    </span>
                    <p
                      className={`text-lg font-bold tracking-tight ${
                        daysToExpiry <= 14
                          ? "text-rose-600 dark:text-rose-400"
                          : daysToExpiry <= 30
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-foreground"
                      }`}
                    >
                      {daysToExpiry > 0
                        ? `${daysToExpiry} days left`
                        : daysToExpiry === 0
                          ? "Expires today"
                          : "Expired"}
                    </p>
                    <span className="text-[11px] text-muted-foreground block truncate">
                      {expiryDateStr
                        ? `Expires: ${expiryDateStr}`
                        : "No expiry date"}
                    </span>
                  </div>
                </div>

                {/* Draft Risk Note Alert if present */}
                {(latestRiskNote as any)?.status === "Draft" && (
                  <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl flex items-center justify-between shadow-sm text-xs">
                    <div className="flex items-center gap-3">
                      <div className="bg-amber-500 text-white p-2 rounded-lg">
                        <FileDown className="size-4" />
                      </div>
                      <div>
                        <p className="font-bold text-amber-900 dark:text-amber-200">
                          Draft Risk Note Detected
                        </p>
                        <p className="text-amber-700 dark:text-amber-300">
                          This {latestRiskNote?.transaction_type} has not been
                          finalized yet.
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700 text-white gap-2 font-medium cursor-pointer"
                      onClick={handlePopulateDraft}
                    >
                      Populate & Issue
                    </Button>
                  </div>
                )}

                {/* Vehicle Asset Card for Motor policies */}
                {(isMotor || vehicle) && <VehicleAssetCard vehicle={vehicle} />}
              </>
            )}
          </div>
        </TabsContent>

        {/* TAB 2: HISTORY (Risk Notes) */}
        <TabsContent value="history" className="pt-6">
          <div className="max-w-5xl mx-auto space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  Transaction & Schedule History
                </h3>
                <p className="text-xs text-muted-foreground font-medium">
                  Authoritative risk notes, endorsements, and coverage schedules
                </p>
              </div>
              <span className="text-xs font-mono text-muted-foreground">
                {riskNotes.length}{" "}
                {riskNotes.length === 1 ? "record" : "records"}
              </span>
            </div>

            <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
              <DataTable
                columns={getRiskNoteColumns((rn) =>
                  handleViewRiskNote(rn.id, "risknote"),
                )}
                data={riskNotes}
              />
            </div>
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
            <DocumentViewer
              id={selectedRiskNoteId}
              type={viewType}
              onClose={() => setViewerOpen(false)}
            />
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
