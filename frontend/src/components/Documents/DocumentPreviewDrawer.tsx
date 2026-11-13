import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FileDown,
  FileText,
  Loader2,
  PenTool,
  Printer,
  Save,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  type DocumentPreviewTarget,
  PRESET_CLAUSES,
  useDocumentPreviewSession,
} from "@/hooks/useDocumentPreviewSession"
import { CanonicalDocumentViewer } from "./CanonicalDocumentViewer"

interface DocumentPreviewDrawerProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  target: DocumentPreviewTarget | null
  onEditDraft?: () => void
}

export function DocumentPreviewDrawer({
  isOpen,
  onOpenChange,
  target,
  onEditDraft,
}: DocumentPreviewDrawerProps) {
  const [activeTab, setActiveTab] = useState<"preview" | "clauses">("preview")
  const {
    includeDigitalStamp,
    setIncludeDigitalStamp,
    specialConditions,
    setSpecialConditions,
    isGeneratingPdf,
    isSavingClauses,
    validation,
    draftSnapshot,
    handleGenerateServerPdf,
    handleInsertClause,
    handleSaveClauses,
  } = useDocumentPreviewSession({
    target,
  })

  if (!target) return null

  const isRiskNote = target.kind === "risk_note"
  const riskNote = isRiskNote ? target.riskNote : null
  const policy = isRiskNote ? target.policy : null

  const handlePrint = () => {
    if (riskNote) {
      window.open(`/print/risk-notes/${riskNote.id}`, "_blank")
    }
  }

  const previewViewer = (
    <div className="min-h-[750px] border rounded-xl overflow-hidden shadow-lg bg-slate-100">
      <CanonicalDocumentViewer
        resourceType={isRiskNote ? "risk_note" : "invoice"}
        resourceId={
          isRiskNote && riskNote
            ? riskNote.id
            : target.kind === "invoice"
              ? target.invoiceId
              : ""
        }
        draftSnapshot={isRiskNote ? draftSnapshot : undefined}
        title={
          isRiskNote
            ? policy?.product?.name || "Official Policy Schedule"
            : target.kind === "invoice"
              ? `Invoice - ${target.invoiceNumber || "Debit Note"}`
              : "Invoice"
        }
        hideToolbar
      />
    </div>
  )

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-5xl overflow-y-auto p-6 flex flex-col gap-5">
        <SheetHeader className="border-b pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-wider">
                  {isRiskNote ? "Policy Schedule" : "Invoice / Debit Note"}
                </span>
                {isRiskNote && riskNote && (
                  <Badge
                    variant="outline"
                    className={
                      riskNote.status === "Draft"
                        ? "text-amber-600 border-amber-500/30 text-xs"
                        : "text-emerald-600 border-emerald-500/30 text-xs"
                    }
                  >
                    {riskNote.status || "Final"}
                  </Badge>
                )}
              </div>
              <SheetTitle className="text-xl font-bold flex items-center gap-2">
                <ShieldCheck className="size-5 text-primary" />
                <span>
                  {isRiskNote
                    ? policy?.product?.name || "Official Policy Schedule"
                    : `Invoice - ${target.invoiceNumber || "Debit Note"}`}
                </span>
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                {target.kind === "risk_note"
                  ? `Document Ref: ${target.riskNote.risk_note_number || "DRAFT"} \u2022 Policy: ${target.policy.policy_number}`
                  : `Document Ref: ${target.invoiceNumber || target.invoiceId}`}
              </SheetDescription>
            </div>

            {/* Action Bar */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="default"
                size="sm"
                onClick={handleGenerateServerPdf}
                disabled={isGeneratingPdf}
                className="gap-1.5 text-xs h-8 cursor-pointer font-semibold shadow-sm"
              >
                {isGeneratingPdf ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <FileDown className="size-3.5" />
                )}
                <span>Official PDF</span>
              </Button>
              {isRiskNote && riskNote && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrint}
                    className="gap-1.5 text-xs h-8 cursor-pointer"
                  >
                    <Printer className="size-3.5" />
                    Print
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      window.open(`/print/risk-notes/${riskNote.id}`, "_blank")
                    }
                    className="gap-1.5 text-xs h-8 cursor-pointer"
                  >
                    <ExternalLink className="size-3.5" />
                    Full Page
                  </Button>
                </>
              )}
            </div>
          </div>
        </SheetHeader>

        {isRiskNote && riskNote ? (
          <>
            {/* Completeness Status Banner */}
            <div className="flex flex-col gap-2">
              {validation.isValid ? (
                <div className="flex items-center justify-between p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-xs">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                    <span>Schedule details are complete and verified.</span>
                  </div>
                  <span className="text-[10px] font-mono font-semibold uppercase">
                    A4 Layout
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs">
                  <div className="flex items-center gap-2 font-medium">
                    <AlertCircle className="size-4 text-amber-600 shrink-0" />
                    <span>
                      Missing required fields:{" "}
                      <strong>{validation.missingFields.join(", ")}</strong>
                    </span>
                  </div>
                  {onEditDraft && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={onEditDraft}
                      className="h-7 text-xs text-amber-900 dark:text-amber-200 underline font-semibold"
                    >
                      Edit Details
                    </Button>
                  )}
                </div>
              )}

              {/* Mode Switcher & Official Stamp Controls */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-3 py-2 rounded-lg border bg-muted/30 text-xs">
                <label
                  htmlFor="stamp-toggle"
                  className="flex items-center gap-2 cursor-pointer select-none font-medium text-foreground"
                >
                  <input
                    id="stamp-toggle"
                    type="checkbox"
                    checked={includeDigitalStamp}
                    onChange={(e) => setIncludeDigitalStamp(e.target.checked)}
                    className="size-4 rounded border-gray-300 text-primary cursor-pointer"
                  />
                  <span>Include official agency seal and signature</span>
                </label>
                <div className="flex items-center gap-1 self-end sm:self-auto">
                  <Button
                    size="sm"
                    variant={activeTab === "preview" ? "secondary" : "ghost"}
                    onClick={() => setActiveTab("preview")}
                    className="h-7 text-xs px-2.5 font-medium cursor-pointer gap-1"
                  >
                    <FileText className="size-3" />
                    Document Preview
                  </Button>
                  <Button
                    size="sm"
                    variant={activeTab === "clauses" ? "secondary" : "ghost"}
                    onClick={() => setActiveTab("clauses")}
                    className="h-7 text-xs px-2.5 font-medium cursor-pointer gap-1"
                  >
                    <PenTool className="size-3" />
                    Clauses Studio (Markdown)
                  </Button>
                </div>
              </div>
            </div>

            {/* Authoring & Preview Content Area */}
            {activeTab === "clauses" ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                {/* Markdown Clause Authoring Panel */}
                <div className="flex flex-col gap-3 p-4 bg-white dark:bg-zinc-900 border rounded-lg shadow-sm">
                  <div className="flex items-center justify-between pb-2 border-b">
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-4 text-primary" />
                      <span className="font-semibold text-sm">
                        Warranties & Special Conditions
                      </span>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleSaveClauses}
                      disabled={isSavingClauses}
                      className="h-7 text-xs gap-1.5 font-semibold"
                    >
                      {isSavingClauses ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Save className="size-3" />
                      )}
                      Save Clauses
                    </Button>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Author underwriting warranties, subjectivities, and
                    endorsements in Markdown. Changes update the canonical
                    document preview instantly.
                  </div>

                  {/* Quick Clause Inserters */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-mono text-muted-foreground uppercase font-semibold">
                      Insert Standard Clauses
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {PRESET_CLAUSES.map((clause) => (
                        <Button
                          key={clause.name}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleInsertClause(clause.snippet)}
                          className="h-6 text-[11px] px-2 bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800"
                        >
                          + {clause.name}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Textarea */}
                  <div className="flex flex-col gap-1 mt-1">
                    <label
                      htmlFor="special-conditions-editor"
                      className="text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      Markdown Source
                    </label>
                    <textarea
                      id="special-conditions-editor"
                      value={specialConditions}
                      onChange={(e) => setSpecialConditions(e.target.value)}
                      rows={14}
                      className="w-full font-mono text-xs p-3 rounded-md border border-slate-200 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-primary/20 leading-relaxed resize-y"
                      placeholder="### Special Conditions & Warranties&#10;- **Tracker Warranty:** Fitted within 14 days..."
                    />
                  </div>
                </div>

                {/* Live Canonical Document Preview */}
                <div className="h-[600px] border rounded-lg overflow-hidden shadow-sm">
                  <CanonicalDocumentViewer
                    resourceType="risk_note"
                    resourceId={riskNote.id}
                    draftSnapshot={draftSnapshot}
                    title="Live Document Preview"
                    hideToolbar
                  />
                </div>
              </div>
            ) : (
              previewViewer
            )}
          </>
        ) : (
          previewViewer
        )}
      </SheetContent>
    </Sheet>
  )
}
