import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Printer } from "lucide-react"
import { Suspense } from "react"
import { z } from "zod"

import { ClientsService, PoliciesService, RiskNotesService } from "@/client"
import PendingItems from "@/components/Pending/PendingItems"
import { Button } from "@/components/ui/button"
import type { EnhancedPolicy, EnhancedRiskNote } from "@/types/insurance"

const searchSchema = z.object({
  mode: z.enum(["invoice", "certificate"]).default("invoice").optional(),
})

function getRiskNoteQueryOptions(id: string) {
  return {
    queryFn: () => RiskNotesService.readRiskNote({ id }),
    queryKey: ["risk-notes", id],
  }
}

function getPolicyQueryOptions(policyId: string) {
  return {
    queryFn: () => PoliciesService.readPolicy({ id: policyId }),
    queryKey: ["policies", policyId],
    enabled: !!policyId,
  }
}

function getClientQueryOptions(clientId: string) {
  return {
    queryFn: () => ClientsService.readClient({ id: clientId }),
    queryKey: ["clients", clientId],
    enabled: !!clientId,
  }
}

export const Route = createFileRoute("/print/risk-notes/$id")({
  component: RiskNotePrint,
  validateSearch: (search) => searchSchema.parse(search),
})

import { RiskNoteTemplate } from "@/components/Documents/templates/RiskNoteTemplate"

function RiskNotePrintContent({ id }: { id: string }) {
  const { mode } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data: riskNote } = useSuspenseQuery(getRiskNoteQueryOptions(id))
  const { data: policy } = useSuspenseQuery(
    getPolicyQueryOptions(riskNote.policy_id),
  )
  const { data: client } = useSuspenseQuery(
    getClientQueryOptions(policy.client_id),
  )

  const riskDetails = riskNote.cover_snapshot || {}

  const isInvoice = mode === "invoice" || !mode

  if (isInvoice) {
    return (
      <div className="max-w-[800px] mx-auto bg-white shadow-lg print:shadow-none min-h-screen relative">
        <RiskNoteTemplate
          riskNote={riskNote as EnhancedRiskNote}
          client={client}
          policy={policy as EnhancedPolicy}
        />

        <div className="fixed bottom-8 right-8 print:hidden flex flex-col gap-2">
          {/* Toggle Buttons */}
          <div className="flex bg-white rounded-lg shadow-lg overflow-hidden border">
            <Button
              variant="secondary"
              className="rounded-none"
              onClick={() => navigate({ search: { mode: "invoice" } })}
            >
              Risk Note
            </Button>
            <Button
              variant="ghost"
              className="rounded-none"
              onClick={() => navigate({ search: { mode: "certificate" } })}
            >
              Certificate
            </Button>
          </div>

          <Button
            onClick={() => window.print()}
            size="lg"
            className="shadow-xl rounded-full gap-2"
          >
            <Printer className="size-5" />
            Print
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[800px] mx-auto p-8 bg-white text-black min-h-screen border shadow-sm print:shadow-none print:border-none print:p-0 font-serif">
      {/* Header */}
      <div className="flex justify-between items-start mb-8 border-b-2 border-black pb-6">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight">
            {isInvoice ? "Debit Note" : "Certificate of Insurance"}
          </h1>
          <p className="text-sm font-bold mt-2">
            HealthWatch Management System
          </p>
          <p className="text-xs">P.O. Box 12345, Nairobi, Kenya</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-xl font-bold">
            {riskNote.risk_note_number || "Draft"}
          </p>
          <p className="text-sm mt-1">
            Date: {new Date().toLocaleDateString()}
          </p>
          {!isInvoice && (
            <p className="text-xs uppercase font-bold text-red-600 mt-2 border border-red-600 px-2 py-1 inline-block">
              Original
            </p>
          )}
        </div>
      </div>

      {/* Client & Policy Info (Common) */}
      <div className="grid grid-cols-2 gap-12 mb-8">
        <div>
          <h2 className="text-xs font-bold uppercase border-b border-gray-300 mb-2">
            Insured Details
          </h2>
          <p className="font-bold text-lg">{client.name}</p>
          <p className="text-sm whitespace-pre-line">
            {client.postal_number
              ? `P.O. Box ${client.postal_number}`
              : "No postal address provided"}
            {client.postal_code && ` - ${client.postal_code}`}
            {client.town && `, ${client.town}`}
          </p>
          <p className="text-sm mt-2">
            <span className="font-semibold">PIN:</span> {client.kra_pin}
          </p>
        </div>
        <div className="text-right">
          <h2 className="text-xs font-bold uppercase border-b border-gray-300 mb-2">
            Policy Details
          </h2>
          <p className="font-bold">{policy.policy_number}</p>
          <p className="text-sm">{riskNote.transaction_type}</p>
          <div className="mt-4">
            <p className="text-xs uppercase text-gray-500">
              Period of Insurance
            </p>
            <p className="font-semibold">From: {riskNote.coverage_start}</p>
            <p className="font-semibold">To: {riskNote.coverage_end}</p>
          </div>
        </div>
      </div>

      {/* MODE: CERTIFICATE */}
      {!isInvoice && (
        <div className="mb-8">
          <div className="bg-gray-100 p-6 border border-gray-300 mb-6 text-center">
            <p className="text-sm italic">
              "This is to certify that the insured named above is covered in
              accordance with the terms and conditions of the Master Policy."
            </p>
          </div>

          <h2 className="text-sm font-bold uppercase border-b-2 border-black mb-4">
            Schedule of Benefits
          </h2>
          <table className="w-full text-sm mb-6">
            <tbody>
              <tr className="border-b">
                <td className="py-2 font-bold">Sum Insured</td>
                <td className="py-2 text-right font-mono font-bold">
                  {riskDetails.sum_insured
                    ? `KES ${Number(riskDetails.sum_insured).toLocaleString()}`
                    : "Refer to Schedule"}
                </td>
              </tr>
              {Object.entries(riskDetails)
                .filter(
                  ([k]) =>
                    !["sum_insured", "description"].includes(k.toLowerCase()),
                )
                .map(([k, v]) => (
                  <tr key={k} className="border-b">
                    <td className="py-2 capitalize">{k.replace(/_/g, " ")}</td>
                    <td className="py-2 text-right">
                      {typeof v === "number"
                        ? `KES ${v.toLocaleString()}`
                        : String(v)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>

          <div className="mb-8">
            <h2 className="text-xs font-bold uppercase border-b border-gray-300 mb-2">
              Clauses & Endorsements
            </h2>
            <ul className="list-disc list-inside text-xs space-y-1">
              <li>Political Violence & Terrorism Included</li>
              <li>Excess Protector Included</li>
              <li>Authorized Repair Limits Clause</li>
              {riskNote.special_clauses?.map((clause, i) => (
                <li key={i}>{clause}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* MODE: INVOICE */}
      {isInvoice && (
        <div className="mb-8">
          <h2 className="text-sm font-bold uppercase border-b-2 border-black mb-4">
            Premium Calculation
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-black text-left bg-gray-50">
                <th className="py-2 pl-2">Description</th>
                <th className="py-2 pr-2 text-right">Amount (KES)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="py-2 pl-2">Net Premium</td>
                <td className="py-2 pr-2 text-right font-mono">
                  {Number(riskNote.net_premium).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </td>
              </tr>

              {/* Taxes/Levies */}
              {Boolean((riskNote.financial_breakdown as any)?.taxes) &&
                Object.entries((riskNote.financial_breakdown as any).taxes).map(
                  ([key, val]: [string, any], i: number) => (
                    <tr key={i}>
                      <td className="py-2 pl-2 text-gray-600 capitalize">
                        {key.replace(/([A-Z])/g, " $1").trim()}
                      </td>
                      <td className="py-2 pr-2 text-right font-mono text-gray-600">
                        {Number(val).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  ),
                )}

              {/* TOTAL */}
              <tr className="bg-gray-100 font-bold text-lg">
                <td className="py-3 pl-2">TOTAL PREMIUM PAYABLE</td>
                <td className="py-3 pr-2 text-right font-mono">
                  {Number(riskNote.total_amount).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="mt-8 p-4 border border-dashed text-xs text-gray-600">
            <p className="font-bold text-black mb-1">Payment Instructions:</p>
            <p>
              Please pay via MPESA Paybill: <strong>555000</strong>, Account:{" "}
              <strong>{riskNote.risk_note_number || "Draft"}</strong>
            </p>
            <p>
              Cheques payable to: <strong>HealthWatch Insurance Agency</strong>
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto pt-8 border-t text-center text-[10px] text-gray-400">
        <p>
          This document is computer generated on {new Date().toLocaleString()}{" "}
          by {client.name.substring(0, 3)}... and is valid without a signature.
        </p>
        <p>HealthWatch MS v1.0 • {riskNote.id}</p>
      </div>

      <div className="fixed bottom-8 right-8 print:hidden flex flex-col gap-2">
        {/* Toggle Buttons */}
        <div className="flex bg-white rounded-lg shadow-lg overflow-hidden border">
          <Button
            variant={isInvoice ? "secondary" : "ghost"}
            className="rounded-none"
            onClick={() => navigate({ search: { mode: "invoice" } })}
          >
            Invoice
          </Button>
          <Button
            variant={!isInvoice ? "secondary" : "ghost"}
            className="rounded-none"
            onClick={() => navigate({ search: { mode: "certificate" } })}
          >
            Certificate
          </Button>
        </div>

        <Button
          onClick={() => window.print()}
          size="lg"
          className="shadow-xl rounded-full gap-2"
        >
          <Printer className="size-5" />
          Print
        </Button>
      </div>
    </div>
  )
}

function RiskNotePrint() {
  const { id } = Route.useParams()

  return (
    <div className="bg-gray-100 min-h-screen print:bg-white pb-20">
      <Suspense fallback={<PendingItems />}>
        <RiskNotePrintContent id={id} />
      </Suspense>
    </div>
  )
}
