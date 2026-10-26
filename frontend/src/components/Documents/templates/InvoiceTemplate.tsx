import type { ClientPublic, InvoicePublic } from "@/client"
import { formatCurrency } from "@/utils"
import { BaseDocument } from "../BaseDocument"

interface InvoiceTemplateProps {
  invoice: InvoicePublic
  client: ClientPublic
  lineItems: any[]
}

export const InvoiceTemplate = ({
  invoice,
  client,
  lineItems,
}: InvoiceTemplateProps) => {
  // Calculate year range for invoice date (e.g., 2025/2026)
  const dateIssued = invoice.date_issued
    ? new Date(invoice.date_issued)
    : new Date()
  const year = dateIssued.getFullYear()
  const yearRange = `${year - 1}/${year}`

  // Get insurer from the first line item's risk note if available
  const insurerName =
    lineItems[0]?.risk_note?.policy?.product?.insurer?.name || "N/A"

  return (
    <BaseDocument>
      <div className="space-y-8">
        {/* DOCUMENT HEADER */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter text-black">
              Invoice
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <p className="text-[11px] text-slate-500 font-mono uppercase bg-slate-100 px-2 py-0.5 rounded">
                Ref: {invoice.invoice_number}
              </p>
              <div
                className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-full border ${
                  invoice.status === "Paid"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}
              >
                {invoice.status}
              </div>
            </div>
          </div>
          <div className="text-right flex flex-col items-end">
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1">
              Year
            </p>
            <p className="text-xl font-black uppercase tracking-tighter text-black bg-black text-white px-3 py-1">
              {yearRange}
            </p>
          </div>
        </div>

        {/* CORE DETAILS SECTION (Minimalist Style) */}
        <div className="mt-6">
          <table className="w-full border-collapse border-t-2 border-black text-black">
            <tbody>
              <tr className="border-b border-black/10">
                <th
                  scope="row"
                  className="w-[20%] py-4 px-0 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70 text-left align-top"
                >
                  Insured
                </th>
                <td className="py-4 px-6 align-top border-l border-black/5">
                  <div className="text-black">
                    <p className="font-bold text-lg leading-tight mb-2 tracking-tight">
                      {client.name}
                    </p>
                    <div className="flex justify-between items-end gap-8">
                      <p className="text-[11px] leading-relaxed font-medium">
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
                      <p className="font-mono text-[10px] font-bold text-slate-400">
                        P.I.N No. {client.kra_pin || "N/A"}
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
              <tr className="border-b border-black/10">
                <th
                  scope="row"
                  className="w-[20%] py-4 px-0 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70 text-left align-middle"
                >
                  Insurer
                </th>
                <td className="py-4 px-6 align-middle border-l border-black/5 font-bold uppercase text-xs">
                  {insurerName}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* LINE ITEMS (Multi-column list) */}
        <div className="bg-white overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-black">
                <th className="w-12 py-3 text-[9px] font-black uppercase text-center text-muted-foreground/70">
                  #
                </th>
                <th className="py-3 px-4 text-[9px] font-black uppercase text-left text-muted-foreground/70">
                  Class of Insurance
                </th>
                <th className="py-3 px-4 text-[9px] font-black uppercase text-left text-muted-foreground/70">
                  Policy No / Period
                </th>
                <th className="w-32 py-3 text-[9px] font-black uppercase text-right text-muted-foreground/70">
                  Amount (KSH)
                </th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, i) => {
                const riskNote = item.risk_note
                const policy = riskNote?.policy
                const product = policy?.product

                const period = riskNote
                  ? `${new Date(riskNote.coverage_start).toLocaleDateString("en-GB")} - ${new Date(riskNote.coverage_end).toLocaleDateString("en-GB")}`
                  : "N/A"

                return (
                  <tr
                    key={item.id || i}
                    className="border-b border-black/10 last:border-b-0"
                  >
                    <td className="py-4 text-[10px] text-center font-mono text-slate-400">
                      {(i + 1).toString().padStart(2, "0")}
                    </td>
                    <td className="py-4 px-4 text-[11px] font-black text-black uppercase tracking-tight">
                      {product?.class_of_insurance || item.description || "N/A"}
                    </td>
                    <td className="py-4 px-4 text-sm">
                      <div className="font-bold text-black font-mono tracking-tighter">
                        {policy?.policy_number || "N/A"}
                      </div>
                      <div className="text-slate-500 font-mono text-xs mt-0.5">
                        {period}
                      </div>
                    </td>
                    <td className="py-4 text-sm font-black text-right font-mono text-black">
                      {(item.amount || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* FINANCIAL SUMMARY */}
        <div className="border-t-2 border-black pt-4">
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-12">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                Total Premium Payable
              </span>
              <span className="text-2xl font-black text-black tracking-tighter">
                {formatCurrency(invoice.total_amount || 0)}
              </span>
            </div>
            {invoice.balance_due !== invoice.total_amount && (
              <div className="flex items-center gap-12">
                <span className="text-[10px] font-black uppercase tracking-widest text-red-600">
                  Balance Due
                </span>
                <span className="text-xl font-black text-red-600 tracking-tighter">
                  {formatCurrency(invoice.balance_due || 0)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* PAYMENT INSTRUCTIONS */}
        <div className="mt-12 bg-slate-50 p-6 rounded-xl border border-slate-100">
          <div className="grid grid-cols-3 gap-8">
            <div className="col-span-1">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">
                Settlement
              </span>
            </div>
            <div className="col-span-2 grid grid-cols-2 gap-12 text-[10px] text-black">
              <div>
                <p className="font-black uppercase mb-3 border-b border-black/10 pb-1 text-black tracking-widest">
                  MPESA Paybill
                </p>
                <div className="space-y-1 mt-2">
                  <p className="flex justify-between">
                    <span className="text-slate-500">Business No:</span>
                    <span className="font-black">522522</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-slate-500">Account No:</span>
                    <span className="font-black font-mono">
                      {invoice.invoice_number}
                    </span>
                  </p>
                </div>
              </div>
              <div>
                <p className="font-black uppercase mb-3 border-b border-black/10 pb-1 text-black tracking-widest">
                  Direct Bank (EFT / RTGS)
                </p>
                <div className="space-y-1 mt-2">
                  <p className="flex justify-between">
                    <span className="text-slate-500">Bank:</span>
                    <span className="font-black">NCBA Bank Kenya PLC</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-slate-500">Account No:</span>
                    <span className="font-black font-mono">1002345678</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-slate-500">Beneficiary:</span>
                    <span className="font-bold">
                      HealthWatch Insurance Agency
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </BaseDocument>
  )
}
