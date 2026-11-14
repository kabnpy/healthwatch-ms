import { useMemo, useState } from "react"
import { toast } from "sonner"
import type { ClientPublic, DocumentJobResourceType } from "@/client"
import { useDocumentPdfExport } from "@/hooks/useDocumentJobs"
import { useCreateRiskNoteRevision } from "@/hooks/usePolicies"
import type { EnhancedPolicy, EnhancedRiskNote } from "@/types/insurance"
import {
  DEFAULT_SPECIAL_CONDITIONS,
  PRESET_CLAUSES,
  type PresetClause,
  validateRiskNoteReadiness,
} from "@/utils/riskNoteReadiness"

export { DEFAULT_SPECIAL_CONDITIONS, PRESET_CLAUSES, type PresetClause }

export type DocumentPreviewTarget =
  | {
      kind: "risk_note"
      riskNote: EnhancedRiskNote
      client: ClientPublic
      policy: EnhancedPolicy
    }
  | {
      kind: "invoice"
      invoiceId: string
      invoiceNumber?: string | null
    }

export interface UseDocumentPreviewSessionParams {
  target?: DocumentPreviewTarget | null
  riskNote?: EnhancedRiskNote | null
  client?: ClientPublic
  policy?: EnhancedPolicy
}

export function useDocumentPreviewSession({
  target,
  riskNote: legacyRiskNote,
  client: legacyClient,
  policy: legacyPolicy,
}: UseDocumentPreviewSessionParams) {
  const riskNote =
    target?.kind === "risk_note" ? target.riskNote : (legacyRiskNote ?? null)
  const client = target?.kind === "risk_note" ? target.client : legacyClient
  const policy = target?.kind === "risk_note" ? target.policy : legacyPolicy
  const isInvoice = target?.kind === "invoice"

  const [includeDigitalStamp, setIncludeDigitalStamp] = useState(true)
  const [specialConditions, setSpecialConditions] = useState<string>(() => {
    const raw = (
      riskNote?.cover_snapshot as Record<string, unknown> | undefined
    )?.special_conditions
    if (typeof raw === "string" && raw.trim().length > 0) {
      return raw
    }
    return DEFAULT_SPECIAL_CONDITIONS
  })

  const { exportPdf, isExporting: isGeneratingPdf } = useDocumentPdfExport()
  const createRiskNoteRevision = useCreateRiskNoteRevision()

  const handleGenerateServerPdf = async () => {
    if (isInvoice && target?.kind === "invoice") {
      try {
        await exportPdf({
          resource_type: "invoice" satisfies DocumentJobResourceType,
          resource_id: target.invoiceId,
        })
      } catch (err) {
        console.error("Failed to generate official PDF:", err)
      }
      return
    }
    if (!riskNote) return
    try {
      await exportPdf({
        resource_type: "risk_note" satisfies DocumentJobResourceType,
        resource_id: riskNote.id,
        snapshot_data: {
          include_digital_stamp: includeDigitalStamp,
          special_conditions: specialConditions,
        },
      })
    } catch (err) {
      console.error("Failed to generate official PDF:", err)
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
      await createRiskNoteRevision.mutateAsync({
        id: riskNote.id,
        data: {
          special_clauses: [specialConditions],
          cover_snapshot: updatedSnapshot,
        },
      })
      toast.success("Warranties & special conditions saved to Risk Note")
    } catch (err: any) {
      toast.error(err?.message || "Failed to save conditions")
    }
  }

  const validation = useMemo(() => {
    if (isInvoice) {
      return { isValid: true, missingFields: [] as string[] }
    }
    return validateRiskNoteReadiness({ riskNote, client, policy })
  }, [isInvoice, riskNote, client, policy])

  const draftSnapshot = useMemo(
    () =>
      isInvoice
        ? undefined
        : {
            include_digital_stamp: includeDigitalStamp,
            special_conditions: specialConditions,
          },
    [isInvoice, includeDigitalStamp, specialConditions],
  )

  return {
    includeDigitalStamp,
    setIncludeDigitalStamp,
    specialConditions,
    setSpecialConditions,
    isGeneratingPdf,
    isSavingClauses: createRiskNoteRevision.isPending,
    validation,
    draftSnapshot,
    handleGenerateServerPdf,
    handleInsertClause,
    handleSaveClauses,
  }
}
