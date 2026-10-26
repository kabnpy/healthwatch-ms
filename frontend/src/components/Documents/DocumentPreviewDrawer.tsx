import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FileDown,
  Loader2,
  Printer,
  ShieldCheck,
} from "lucide-react"
import { useMemo, useState } from "react"
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
import type { EnhancedPolicy, EnhancedRiskNote } from "@/types/insurance"
import { RiskNoteTemplate } from "./templates/RiskNoteTemplate"

interface DocumentPreviewDrawerProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  riskNote: EnhancedRiskNote | null
  client: ClientPublic
  policy: EnhancedPolicy
  onEditDraft?: () => void
}

export function DocumentPreviewDrawer({
  isOpen,
  onOpenChange,
  riskNote,
  client,
  policy,
  onEditDraft,
}: DocumentPreviewDrawerProps) {
  const [includeDigitalStamp, setIncludeDigitalStamp] = useState(true)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const enqueueJob = useEnqueueDocumentJob()
  const processJob = useProcessDocumentJob()

  const handleGenerateServerPdf = async () => {
    if (!riskNote) return
    setIsGeneratingPdf(true)
    try {
      const enqueued = await enqueueJob.mutateAsync({
        resource_type: "risk_note" as any,
        resource_id: riskNote.id,
        snapshot_data: { include_digital_stamp: includeDigitalStamp },
      })
      if (enqueued?.id) {
        await processJob.mutateAsync(enqueued.id)
        window.open(`/api/v1/document-jobs/${enqueued.id}/download`, "_blank")
      }
    } catch (err) {
      console.error("Failed to generate official PDF:", err)
    } finally {
      setIsGeneratingPdf(false)
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

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-4xl overflow-y-auto p-6 flex flex-col gap-5">
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

          {/* Official Stamp & Sign Toggle Bar */}
          <div className="flex items-center justify-between px-3 py-2 rounded-lg border bg-muted/30 text-xs">
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
            <span className="text-[11px] text-muted-foreground font-mono">
              Official Agency Copy
            </span>
          </div>
        </div>

        {/* 1:1 A4 Paper Schedule Document Container */}
        <div className="border rounded-xl shadow-lg overflow-hidden bg-slate-100 dark:bg-zinc-900 p-4 sm:p-6 flex justify-center">
          <div className="w-full max-w-3xl bg-white shadow-2xl rounded-sm">
            <RiskNoteTemplate
              riskNote={riskNote}
              client={client}
              policy={policy}
              includeDigitalStamp={includeDigitalStamp}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
