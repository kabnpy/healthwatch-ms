import { useMemo, useState } from "react"
import { toast } from "sonner"
import type { ClientPublic } from "@/client"
import { useDocumentPdfExport } from "@/hooks/useDocumentPdfExport"
import { useCreateRiskNoteRevision } from "@/hooks/usePolicies"
import type { EnhancedPolicy, EnhancedRiskNote } from "@/types/insurance"

export interface PresetClause {
  name: string
  snippet: string
}

export const PRESET_CLAUSES: PresetClause[] = [
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

const DEFAULT_SPECIAL_CONDITIONS =
  "### Standard Policy Warranties\n- **Anti-Theft Tracker Warranty:** Fitted within 14 days of inception.\n- **Territorial Limits:** Restricted to Kenya unless endorsed.\n- **Use:** Strictly Social, Domestic and Pleasure (SD&P) & business carriage."

export interface UseDocumentPreviewSessionParams {
  riskNote: EnhancedRiskNote | null
  client: ClientPublic
  policy: EnhancedPolicy
}

export function useDocumentPreviewSession({
  riskNote,
  client,
  policy,
}: UseDocumentPreviewSessionParams) {
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
    if (!riskNote) return
    try {
      await exportPdf({
        resource_type: "risk_note" as any,
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

  const draftSnapshot = useMemo(
    () => ({
      include_digital_stamp: includeDigitalStamp,
      special_conditions: specialConditions,
    }),
    [includeDigitalStamp, specialConditions],
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
