import { FileText, Receipt, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { EnhancedPolicy, EnhancedRiskNote } from "@/types/insurance"
import { formatCurrency } from "@/utils"

interface CoverageMatrixCardProps {
  policy: EnhancedPolicy
  riskNote: EnhancedRiskNote | null
  onOpenPreview?: () => void
}

export function CoverageMatrixCard({
  policy,
  riskNote,
  onOpenPreview,
}: CoverageMatrixCardProps) {
  if (!riskNote) return null

  const netPremium = Number(riskNote.net_premium || 0)
  const breakdown = (riskNote.financial_breakdown as any) || {}
  const taxes = (breakdown.taxes as Record<string, number>) || {}
  const snapshot = riskNote.cover_snapshot || {}
  const terms = (snapshot as any)?.terms || {}
  const extensions = (snapshot as any)?.extensions || {}

  const invoice = riskNote.invoice_line_items?.[0]?.invoice

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* 1. Coverage Limits & Benefit Extensions */}
      <div className="rounded-xl border bg-card p-4 shadow-sm flex flex-col justify-between gap-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b pb-2.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Coverage Limits & Deductibles
              </h4>
            </div>
            <span className="text-[11px] font-mono font-medium text-muted-foreground">
              {policy.product?.class_of_insurance || "General Insurance"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                Declared Insured Value
              </span>
              <span className="font-mono text-sm font-bold text-foreground tabular-nums">
                {formatCurrency(
                  (snapshot as any)?.sum_insured ||
                    (snapshot as any)?.vehicle?.sum_insured ||
                    netPremium * 20, // fallback estimate if not present
                )}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                Base Annual Premium
              </span>
              <span className="font-mono text-sm font-bold text-foreground tabular-nums">
                {formatCurrency(riskNote.net_premium)}
              </span>
            </div>
          </div>

          {/* Deductibles / Clauses */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
              Deductibles & Special Terms
            </span>
            <div className="p-2.5 rounded-lg bg-muted/20 border text-xs text-muted-foreground font-mono space-y-1">
              <div>
                &bull; Own Damage:{" "}
                <span className="text-foreground font-semibold">
                  {terms.excesses || "2.5% of value (min KES 15,000)"}
                </span>
              </div>
              <div>
                &bull; Windscreen Limit:{" "}
                <span className="text-foreground font-semibold">
                  KES 50,000 (standard complimentary)
                </span>
              </div>
              <div>
                &bull; Radio / Entertainment:{" "}
                <span className="text-foreground font-semibold">
                  KES 30,000
                </span>
              </div>
            </div>
          </div>

          {/* Add-on Riders Badges */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
              Underwriting Riders & Endorsement Extensions
            </span>
            <div className="flex flex-wrap gap-1.5">
              <Badge
                variant="outline"
                className={`text-[10px] ${
                  extensions.excessProtector !== false
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-semibold"
                    : "text-muted-foreground"
                }`}
              >
                Excess Protector:{" "}
                {extensions.excessProtector !== false ? "Included" : "Excluded"}
              </Badge>
              <Badge
                variant="outline"
                className={`text-[10px] ${
                  extensions.pvt
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-semibold"
                    : "text-muted-foreground"
                }`}
              >
                Political Violence & Terrorism:{" "}
                {extensions.pvt ? "Included (0.25%)" : "Standard"}
              </Badge>
              <Badge
                variant="outline"
                className="text-[10px] text-muted-foreground"
              >
                Road Rescue: AA Kenya Fleet Coverage
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Statutory Levies & Ledger Reconciliation */}
      <div className="rounded-xl border bg-card p-4 shadow-sm flex flex-col justify-between gap-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b pb-2.5">
            <div className="flex items-center gap-2">
              <Receipt className="size-4 text-primary" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Financial Schedule & Statutory Levies
              </h4>
            </div>
            <span className="text-[11px] font-mono font-medium text-muted-foreground">
              IRA Cap 487 Schedules
            </span>
          </div>

          {/* Levies Itemized Table */}
          <div className="rounded-lg border bg-muted/10 divide-y text-xs">
            <div className="flex justify-between items-center py-2 px-3">
              <span className="text-muted-foreground">Basic Net Premium</span>
              <span className="font-mono font-semibold tabular-nums">
                {formatCurrency(riskNote.net_premium)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 px-3">
              <span className="text-muted-foreground">
                Insurance Training Levy (ITL 0.20%)
              </span>
              <span className="font-mono font-semibold tabular-nums">
                {formatCurrency(
                  taxes.insurance_training_levy ||
                    taxes.training_levy ||
                    Math.round(netPremium * 0.002),
                )}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 px-3">
              <span className="text-muted-foreground">
                Policyholders Compensation Fund (PCF 0.25%)
              </span>
              <span className="font-mono font-semibold tabular-nums">
                {formatCurrency(
                  taxes.policyholders_compensation_fund ||
                    taxes.pcf_levy ||
                    Math.round(netPremium * 0.0025),
                )}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 px-3">
              <span className="text-muted-foreground">
                Statutory Stamp Duty (Cap 480)
              </span>
              <span className="font-mono font-semibold tabular-nums">
                {formatCurrency(taxes.stamp_duty || 40)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2.5 px-3 bg-muted/30 font-bold">
              <span className="text-foreground uppercase tracking-tight">
                Gross Term Payable
              </span>
              <span className="font-mono text-sm text-foreground tabular-nums">
                {formatCurrency(riskNote.total_amount)}
              </span>
            </div>
          </div>

          {/* Connected Invoice & Balance Status */}
          <div className="p-3 rounded-lg border bg-muted/20 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                Billing & Receivables Status
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                {invoice ? (
                  <>
                    <span className="font-mono text-xs font-bold text-foreground">
                      Invoice #{invoice.invoice_number}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        Number(invoice.balance_due || 0) === 0
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                          : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30"
                      }`}
                    >
                      {Number(invoice.balance_due || 0) === 0
                        ? "Settled in Full"
                        : `Due: KES ${Number(invoice.balance_due || 0).toLocaleString()}`}
                    </Badge>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground italic">
                    Unbilled / Invoicing Pending Renewal Settlement
                  </span>
                )}
              </div>
            </div>

            {onOpenPreview && (
              <button
                type="button"
                onClick={onOpenPreview}
                className="text-xs font-semibold text-primary hover:underline cursor-pointer flex items-center gap-1"
              >
                <FileText className="size-3.5" />
                View A4 Slip
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
