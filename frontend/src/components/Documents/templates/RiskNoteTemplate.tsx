import { RefreshCcw, Save } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import type { ClientPublic } from "@/client"
import { Button } from "@/components/ui/button"
import type {
  EnhancedPolicy,
  EnhancedRiskNote,
  RiskNoteContentValue,
  RiskNoteSection,
} from "@/types/insurance"
import { formatCurrency } from "@/utils"
import { BaseDocument } from "../BaseDocument"
import { OfficialAgencyStamp } from "../OfficialAgencyStamp"
import { RiskNoteTable } from "./RiskNote/RiskNoteTable"

interface RiskNoteTemplateProps {
  riskNote: EnhancedRiskNote
  client: ClientPublic
  policy: EnhancedPolicy
  isEditable?: boolean
  onSave?: (updatedSnapshot: any) => void
  includeDigitalStamp?: boolean
}

export const RiskNoteTemplate = ({
  riskNote,
  client,
  policy,
  isEditable = false,
  onSave,
  includeDigitalStamp = false,
}: RiskNoteTemplateProps) => {
  const [localRiskDetails, setLocalRiskDetails] = useState<Record<string, any>>(
    riskNote.cover_snapshot || {},
  )

  // Keep local state in sync with external changes if not editing
  useEffect(() => {
    if (!isEditable) {
      setLocalRiskDetails(riskNote.cover_snapshot || {})
    }
  }, [riskNote.cover_snapshot, isEditable])

  const handleSave = () => {
    onSave?.(localRiskDetails)
  }

  const handleReset = () => {
    setLocalRiskDetails(riskNote.cover_snapshot || {})
  }

  // --- DATA CONSOLIDATION LOGIC ---
  const tableSections = useMemo(() => {
    const sections: RiskNoteSection[] = []

    // 1. INSURED
    sections.push({
      name: "INSURED",
      content: (
        <div className="text-black">
          <p className="font-bold text-base leading-tight mb-1">
            {client.name}
          </p>
          <div className="flex justify-between items-end gap-8">
            <p className="text-[11px] leading-relaxed">
              {client.physical_address && (
                <>
                  {client.physical_address}
                  <br />
                </>
              )}
              {client.postal_number
                ? `P.O. Box ${client.postal_number}`
                : !client.physical_address && "No Address Provided"}
              {client.postal_code && ` - ${client.postal_code}`}
              <br />
              {client.town || "Nairobi"}
            </p>
            <p className="font-mono text-[12px] font-bold shrink-0 uppercase">
              P.I.N No. {client.kra_pin || "N/A"}
            </p>
          </div>
        </div>
      ),
    })

    // 2. CLASS
    sections.push({
      name: "CLASS",
      content: (
        <div className="flex justify-between items-center w-full text-black uppercase">
          <span className="font-bold tracking-tight text-[11px]">
            {policy.product?.name || "N/A"}
          </span>
          <span className="font-mono text-[12px] font-bold">
            [Policy No. {policy.policy_number}]
          </span>
        </div>
      ),
    })

    // 3. PERIOD
    const startDate = riskNote.coverage_start
    const endDate = riskNote.coverage_end

    sections.push({
      name: "PERIOD",
      content: (
        <div className="flex items-center justify-between text-black font-bold uppercase tracking-tight text-[11px]">
          <span>
            {startDate
              ? new Date(startDate).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : "N/A"}
          </span>
          <span className="text-slate-700 normal-case">To</span>
          <span>
            {endDate
              ? new Date(endDate).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : "N/A"}
          </span>
        </div>
      ),
    })

    // 4. COVER
    sections.push({
      name: "COVER",
      content: (
        <div className="text-black text-[11px] leading-relaxed italic">
          {policy.product?.class_of_insurance}: Accidental loss or damage to
          insured property and / or death, bodily injury or loss or damage to
          property of third parties.
        </div>
      ),
    })

    // Multi-vehicle schedule for fleet policies
    const policyVehicles = (policy as any)?.vehicles || []
    if (policyVehicles.length > 1) {
      sections.push({
        name: `ASSET SCHEDULE (${policyVehicles.length} VEHICLES)`,
        content: (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse text-[10px]">
              <thead>
                <tr className="border-b border-black font-mono uppercase text-muted-foreground">
                  <th className="py-1">Reg No</th>
                  <th className="py-1">Make / Model</th>
                  <th className="py-1">Year</th>
                  <th className="py-1">Chassis (VIN)</th>
                  <th className="py-1 text-right">Sum Insured</th>
                </tr>
              </thead>
              <tbody>
                {policyVehicles.map((v: any, idx: number) => (
                  <tr
                    key={v.id || idx}
                    className="border-b border-black/10 font-mono"
                  >
                    <td className="py-1 font-bold">
                      {v.registration_number || v.reg_no}
                    </td>
                    <td className="py-1">
                      {v.make} {v.model || ""}
                    </td>
                    <td className="py-1">{v.year_of_manufacture || "-"}</td>
                    <td className="py-1">{v.chassis_number || "ON RECORD"}</td>
                    <td className="py-1 text-right font-bold">
                      {formatCurrency(v.sum_insured || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ),
      })
    }

    // 5. DYNAMIC RISK SECTIONS (Template + Instance)
    const template: Record<string, any> = policy.product?.product_details || {}
    const instance: Record<string, any> = localRiskDetails || {}

    // Merge logic: template provides structure, instance provides values
    // We iterate over the template sections to ensure order and grouping
    const manualSections = [
      "INSURED",
      "CLASS",
      "PERIOD",
      "COVER",
      "ANNUAL PREMIUM",
      "FINANCIAL SUMMARY",
      "INSURER",
      "AUTHENTICATION",
    ]

    // First, handle sections defined in the template
    Object.entries(template).forEach(([name, templateContent]) => {
      const upperName = name.toUpperCase()
      if (!manualSections.includes(upperName)) {
        const instanceContent = instance[name] || instance[upperName] || {}

        let mergedContent = templateContent
        if (typeof templateContent === "object" && templateContent !== null) {
          // If it's a structured section (like VEHICLE DETAILS)
          mergedContent = { ...templateContent }
          if (typeof instanceContent === "object" && instanceContent !== null) {
            Object.entries(instanceContent).forEach(([k, v]) => {
              // Only override if the value is not a placeholder or if it has actual data
              if (
                v !== undefined &&
                v !== null &&
                v !== "" &&
                v !== "[ EMPTY ]"
              ) {
                mergedContent[k] = v
              }
            })
          }

          // Singular Source Mapping: Map the internal 'sum_insured' to the template's 'Value Kshs.'
          if (
            instance.sum_insured !== undefined &&
            instance.sum_insured !== "[ EMPTY ]"
          ) {
            mergedContent["Value Kshs."] = instance.sum_insured
          }
        } else if (instanceContent && instanceContent !== "[ EMPTY ]") {
          mergedContent = instanceContent
        }

        sections.push({
          name: upperName,
          content: mergedContent as RiskNoteContentValue,
        })
      }
    })

    // Then, add any sections from instance that weren't in template (fallback for legacy/custom)
    Object.entries(instance).forEach(([name, content]) => {
      const upperName = name.toUpperCase()
      if (
        !manualSections.includes(upperName) &&
        !sections.find((s) => s.name === upperName)
      ) {
        sections.push({
          name: upperName,
          content: content as RiskNoteContentValue,
        })
      }
    })

    // 6. ANNUAL PREMIUM
    const breakdown = riskNote.financial_breakdown || {}
    const taxes = (breakdown.taxes as Record<string, number>) || {}
    const benefits = (breakdown.benefits as any[]) || []

    const taxRows: Record<string, RiskNoteContentValue> = {}
    Object.entries(taxes).forEach(([name, amt]) => {
      taxRows[name.replace(/_/g, " ").toUpperCase()] = formatCurrency(
        amt as string | number,
      )
    })

    const benefitRows: Record<string, RiskNoteContentValue> = {}
    benefits.forEach((b) => {
      benefitRows[b.name.toUpperCase()] = formatCurrency(b.amount)
    })

    sections.push({
      name: "FINANCIAL SUMMARY",
      content: {
        "Net Premium": formatCurrency(riskNote.net_premium),
        ...benefitRows,
        ...taxRows,
        "Total Amount Payable": (
          <span className="text-xl font-black text-black tracking-tighter">
            {formatCurrency(riskNote.total_amount)}
          </span>
        ),
      },
    })

    // 7. INSURER
    sections.push({
      name: "INSURER",
      content: (
        <div className="flex justify-between items-center text-black">
          <span className="font-bold uppercase text-[11px]">
            {policy.product?.insurer?.name || "N/A"}
          </span>
        </div>
      ),
    })

    // 8. AUTHENTICATION
    const invoice = (riskNote.invoice_line_items?.[0] as any)?.invoice
    sections.push({
      name: "AUTHENTICATION",
      content: (
        <div className="flex justify-between items-center text-black uppercase">
          <div className="flex flex-col">
            <span className="font-bold tracking-tight text-[11px]">
              {invoice
                ? `Invoiced: ${invoice.invoice_number}`
                : "Pending Invoicing"}
            </span>
            <span className="font-mono text-[10px] text-slate-700 font-semibold mt-0.5">
              Issued: {new Date(riskNote.created_at || "").toLocaleDateString()}
            </span>
          </div>
          {includeDigitalStamp ? (
            <div className="py-0.5">
              <OfficialAgencyStamp
                date={new Date(riskNote.created_at || "")
                  .toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                  .toUpperCase()}
              />
            </div>
          ) : (
            <span className="font-mono text-[11px] font-bold text-slate-700">
              [Authorized Broker Cover Slip]
            </span>
          )}
        </div>
      ),
    })

    return sections
  }, [client, policy, riskNote, localRiskDetails, includeDigitalStamp])

  const handleUpdateSection = (sectionName: string, updatedContent: any) => {
    setLocalRiskDetails({
      ...localRiskDetails,
      [sectionName]: updatedContent,
    })
  }

  return (
    <div className="relative group">
      {/* EDITING TOOLBAR */}
      {isEditable && (
        <div className="absolute -top-12 left-0 right-0 flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-30">
          <Button
            size="sm"
            variant="outline"
            className="bg-white shadow-sm"
            onClick={handleReset}
          >
            <RefreshCcw className="h-3 w-3 mr-2" /> Reset
          </Button>
          <Button size="sm" className="shadow-sm" onClick={handleSave}>
            <Save className="h-3 w-3 mr-2" /> Save Draft Changes
          </Button>
        </div>
      )}

      <BaseDocument>
        <div className="space-y-8">
          {/* Document Header Info */}
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tighter text-black">
                Risk Note
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-[11px] text-slate-500 font-mono uppercase bg-slate-100 px-2 py-0.5 rounded">
                  Ref: {riskNote.risk_note_number || "DRAFT"}
                </p>
                <div
                  className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-full border ${
                    riskNote.status === "Draft"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  }`}
                >
                  {riskNote.status}
                </div>
              </div>
            </div>
            {/*<div className="text-right flex flex-col items-end">
              <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1">
                Transaction Type
              </p>
              <p className="text-xl font-black uppercase tracking-tighter text-black bg-black text-white px-3 py-1">
                {riskNote.transaction_type}
              </p>
            </div>*/}
          </div>

          {/* UNIFIED TABLE BODY */}
          <div className="mt-4">
            <RiskNoteTable
              sections={tableSections}
              isEditable={isEditable}
              onChange={handleUpdateSection}
            />
          </div>
        </div>
      </BaseDocument>
    </div>
  )
}
