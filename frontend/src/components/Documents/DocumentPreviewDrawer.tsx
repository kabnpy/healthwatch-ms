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
import { useMemo, useState } from "react"
import { toast } from "sonner"
import type { ClientPublic } from "@/client"
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
  useEnqueueDocumentJob,
  useProcessDocumentJob,
} from "@/hooks/useDocumentJobs"
import { useUpdateRiskNote } from "@/hooks/useInsurance"
import type { EnhancedPolicy, EnhancedRiskNote } from "@/types/insurance"
import { CanonicalDocumentViewer } from "./CanonicalDocumentViewer"

interface DocumentPreviewDrawerProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  riskNote: EnhancedRiskNote | null
  client: ClientPublic
  policy: EnhancedPolicy
  onEditDraft?: () => void
}

const PRESET_CLAUSES = [
  {
    name: "Anti-Theft Tracker",
    snippet:
      "**Anti-Theft Tracker Warranty:** Warranted that an approved anti-theft tracking device is fitted and fully functional on the vehicle within 14 days of inception, failing which theft cover is rendered null and void.",
  },
  {
    name: "Valuation Report",
    snippet:
      "**Valuation Warranty:** Warranted that the vehicle is inspected and valued by an approved agency assessor within 7 days from coverage inception date.",
  },
  {
    name: "Territorial Limits",
    snippet:
      "**Territorial Limits:** Restricted to Kenya. Cross-border extension to Uganda/Tanzania requires prior formal agency endorsement and payment of requisite extension premium.",
  },
  {
    name: "Driver Excess Clause",
    snippet:
      "**Driver Excess Clause:** Drivers under 21 years of age or with less than 2 years of driving experience are subject to an additional mandatory excess of KES 25,000.",
  },
  {
    name: "Premium Payment Warranty",
    snippet:
      "**Premium Payment Warranty:** Cover is conditional upon receipt of cleared premium funds within the statutory credit terms.",
  },
]

export function DocumentPreviewDrawer({
  isOpen,
  onOpenChange,
  riskNote,
  client,
  policy,
  onEditDraft,
}: DocumentPreviewDrawerProps) {
  const [includeDigitalStamp, setIncludeDigitalStamp] = useState(true)
  const [activeTab, setActiveTab] = useState<"preview" | "clauses">("preview")
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [specialConditions, setSpecialConditions] = useState<string>(() => {
    const raw = (riskNote?.cover_snapshot as Record<string, any> | undefined)
      ?.special_conditions
    if (typeof raw === "string" && raw.trim().length > 0) {
      return raw
    }
    return "### Standard Policy Warranties\n- **Anti-Theft Tracker Warranty:** Fitted within 14 days of inception.\n- **Territorial Limits:** Restricted to Kenya unless endorsed.\n- **Use:** Strictly Social, Domestic and Pleasure (SD&P) & business carriage."
  })

  const enqueueJob = useEnqueueDocumentJob()
  const processJob = useProcessDocumentJob()
  const updateRiskNote = useUpdateRiskNote()

  const handleGenerateServerPdf = async () => {
    if (!riskNote) return
    setIsGeneratingPdf(true)
    try {
      const enqueued = await enqueueJob.mutateAsync({
        resource_type: "risk_note" as any,
        resource_id: riskNote.id,
        snapshot_data: {
          include_digital_stamp: includeDigitalStamp,
          special_conditions: specialConditions,
        },
      })
      if (enqueued?.id) {
        await processJob.mutateAsync(enqueued.id)
        window.open(`/api/v1/document-jobs/${enqueued.id}/download`, "_blank")
      }
    } catch (err) {
      console.error("Failed to generate official PDF:", err)
      toast.error("Failed to generate official PDF")
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  const handleInsertClause = (clauseSnippet: string) => {
    setSpecialConditions((prev) => {
      const trimmed = prev.trim()
      if (!trimmed) return clauseSnippet
      return `${trimmed}\n\n${clauseSnippet}`
    })
    toast.success("Clause inserted into document draft")
  }

  const handleSaveClauses = async () => {
    if (!riskNote) return
    try {
      const updatedSnapshot = {
        ...(riskNote.cover_snapshot || {}),
        special_conditions: specialConditions,
      }
      await updateRiskNote.mutateAsync({
        id: riskNote.id,
        data: {
          cover_snapshot: updatedSnapshot,
        },
      })
      toast.success("Warranties & special conditions saved to Risk Note")
    } catch (err: any) {
      toast.error(err?.message || "Failed to save conditions")
    }
  }

  // Pre-flight Data Completeness Validator
  const validation = useMemo(() => {
    if (!riskNote)
      return { isValid: false, missingFields: ["Risk Note Record"] }

    const missing: string[] = []
    const snapshot = riskNote.cover_snapshot || {}
    const isMotor =
      policy.product?.class_of_insurance?.toLowerCase().includes("motor") ||
      false

    if (!client.name) missing.push("Client Name")
    if (!client.kra_pin) missing.push("KRA PIN")
    if (!riskNote.coverage_start || !riskNote.coverage_end)
      missing.push("Coverage Period")

    if (isMotor) {
      const vehicle =
        (snapshot as any).vehicle || (snapshot as any)["VEHICLE DETAILS"] || {}
      if (
        !vehicle.registration_number &&
        !(policy as any).vehicles?.[0]?.registration_number
      ) {
        missing.push("Vehicle Registration Plate")
      }
      if (!vehicle.chassis_number && !snapshot.chassis_number) {
        missing.push("Chassis Number (VIN)")
      }
      if (
        !vehicle.sum_insured &&
        !snapshot.sum_insured &&
        !riskNote.net_premium
      ) {
        missing.push("Insured Market Value")
      }
    }

    return {
      isValid: missing.length === 0,
      missingFields: missing,
    }
  }, [riskNote, client, policy])

  if (!riskNote) return null

  const handlePrint = () => {
    window.open(`/print/risk-notes/${riskNote.id}`, "_blank")
  }

  const draftSnapshot = {
    include_digital_stamp: includeDigitalStamp,
    special_conditions: specialConditions,
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-5xl overflow-y-auto p-6 flex flex-col gap-5">
        <SheetHeader className="border-b pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-wider">
                  Policy Schedule
                </span>
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
              </div>
              <SheetTitle className="text-xl font-bold flex items-center gap-2">
                <ShieldCheck className="size-5 text-primary" />
                <span>
                  {policy.product?.name || "Official Policy Schedule"}
                </span>
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                Document Ref: {riskNote.risk_note_number || "DRAFT"} &bull;{" "}
                Policy: {policy.policy_number}
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
            </div>
          </div>
        </SheetHeader>

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
                  disabled={updateRiskNote.isPending}
                  className="h-7 text-xs gap-1.5 font-semibold"
                >
                  {updateRiskNote.isPending ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Save className="size-3" />
                  )}
                  Save Clauses
                </Button>
              </div>

              <div className="text-xs text-muted-foreground">
                Author underwriting warranties, subjectivities, and endorsements
                in Markdown. Changes update the canonical document preview
                instantly.
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
          <div className="min-h-[750px] border rounded-xl overflow-hidden shadow-lg bg-slate-100">
            <CanonicalDocumentViewer
              resourceType="risk_note"
              resourceId={riskNote.id}
              draftSnapshot={draftSnapshot}
              title={policy.product?.name || "Official Policy Schedule"}
              hideToolbar
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
