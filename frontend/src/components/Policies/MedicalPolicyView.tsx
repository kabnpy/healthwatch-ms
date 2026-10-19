import { HeartPulse, Mail, PlusCircle, ShieldCheck } from "lucide-react"
import type { ClientPublic } from "@/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import type { EnhancedPolicy, EnhancedRiskNote } from "@/types/insurance"
import { formatCurrency } from "@/utils"

interface MedicalPolicyViewProps {
  policy: EnhancedPolicy
  client: ClientPublic
  latestRiskNote?: EnhancedRiskNote | null
  onEndorseCensus: () => void
}

export function MedicalPolicyView({
  policy,
  client,
  latestRiskNote,
  onEndorseCensus,
}: MedicalPolicyViewProps) {
  const snapshot = latestRiskNote?.cover_snapshot || {}
  const rawAdvisory = (snapshot as any)?.advisory_calculation
  const netPremium = Number(
    latestRiskNote?.net_premium ||
      rawAdvisory?.net_premium ||
      latestRiskNote?.total_amount ||
      0,
  )

  const trainingLevy = Math.round(netPremium * 0.002 * 100) / 100
  const phcfLevy = Math.round(netPremium * 0.0025 * 100) / 100
  const grossTotal =
    Math.round((netPremium + trainingLevy + phcfLevy) * 100) / 100

  const familySize =
    (snapshot as any)?.family_size || (snapshot as any)?.census || "M+2"
  const inpatientLimit =
    (snapshot as any)?.inpatient_limit ||
    (snapshot as any)?.tier_limit ||
    2000000

  return (
    <div className="space-y-6">
      {/* 1. ARCHITECTURAL INVARIANT BANNER */}
      <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-lg shrink-0">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-foreground">
                Direct Carrier Healthcare Policy Slip
              </p>
              <Badge
                variant="outline"
                className="text-[10px] bg-background border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
              >
                No Risk Notes Required
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Underwritten by{" "}
              {policy.product?.insurer?.name || "Licensed Carrier"} (Cap 487).
              Healthcare contracts are exempt from agency Risk Notes and
              statutory Stamp Duty.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            onClick={onEndorseCensus}
            className="gap-1.5 h-8 text-xs bg-primary text-primary-foreground font-medium"
          >
            <PlusCircle className="size-3.5" />
            Endorse Census / Limits
          </Button>
        </div>
      </div>

      {/* 2. THE FORMAL MASTER SCHEDULE CARD */}
      <div className="border rounded-xl shadow-lg bg-card overflow-hidden">
        {/* Slip Header */}
        <div className="p-6 border-b bg-muted/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <HeartPulse className="size-5 text-rose-600 dark:text-rose-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Healthcare Schedule & Census Master Slip
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {policy.product?.name || "Medical Family Plan"}
            </h2>
            <p className="text-xs text-muted-foreground">
              Carrier Underwriter:{" "}
              <span className="font-semibold text-foreground">
                {policy.product?.insurer?.name || "Licensed Kenyan Insurer"}
              </span>
            </p>
          </div>

          <div className="flex flex-col sm:items-end gap-1 font-mono text-xs">
            <span className="text-muted-foreground">Policy Number</span>
            <span className="text-base font-bold text-foreground">
              {policy.policy_number}
            </span>
            <Badge
              variant="outline"
              className="text-[10px] uppercase font-mono bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
            >
              {policy.status || "Active / In Force"}
            </Badge>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Identity & Policyholder Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg border bg-muted/10 text-xs">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Policyholder / Principal
              </span>
              <p className="font-semibold text-sm text-foreground">
                {client.name}
              </p>
              <p className="font-mono text-muted-foreground">
                KRA PIN: {client.kra_pin}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Coverage Term Horizon
              </span>
              <p className="font-mono text-foreground">
                {latestRiskNote?.coverage_start || policy.inception_date || "—"}{" "}
                to {latestRiskNote?.coverage_end || "—"}
              </p>
              <p className="text-muted-foreground">
                Annual calendar-month term
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Demographic Structure
              </span>
              <p className="font-semibold text-foreground">
                Category: {familySize}
              </p>
              <p className="text-muted-foreground">
                Covered Lives: Principal + Eligible Dependents
              </p>
            </div>
          </div>

          {/* Census & Actuarial Benefit Limits */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Defined Benefit Limits & Modular Riders
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg border bg-card space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                  Inpatient Hospitalization
                </span>
                <div className="font-mono tabular-nums text-base font-bold text-foreground">
                  {formatCurrency(inpatientLimit)}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Per family per annum
                </p>
              </div>

              <div className="p-3 rounded-lg border bg-card space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                  Outpatient Services
                </span>
                <div className="font-mono tabular-nums text-base font-bold text-foreground">
                  KES 100,000.00
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Consultation, labs & drugs
                </p>
              </div>

              <div className="p-3 rounded-lg border bg-card space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                  Dental & Optical Care
                </span>
                <div className="font-mono tabular-nums text-base font-bold text-foreground">
                  KES 30,000.00
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Routine care & frames
                </p>
              </div>

              <div className="p-3 rounded-lg border bg-card space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                  Maternity Option
                </span>
                <div className="font-mono tabular-nums text-base font-bold text-foreground">
                  KES 150,000.00
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Normal delivery & C-section
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* FINANCIAL SCHEDULE (Strict Tabular Monospace) */}
          <div className="rounded-lg border bg-muted/20 overflow-hidden">
            <div className="px-4 py-2 bg-muted/40 border-b flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Authoritative Financial Breakdown (Fixed-Point KES)
              </span>
              <span className="text-[11px] font-mono text-muted-foreground">
                Cap 487 Compliant
              </span>
            </div>

            <div className="p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-foreground">
                  Net Carrier Healthcare Premium
                </span>
                <span className="font-mono tabular-nums font-semibold text-right">
                  {formatCurrency(netPremium)}
                </span>
              </div>

              <div className="flex items-center justify-between text-muted-foreground pl-2 border-l-2 border-border">
                <span>Insurance Training Levy (0.20%)</span>
                <span className="font-mono tabular-nums text-right text-foreground">
                  {formatCurrency(trainingLevy)}
                </span>
              </div>

              <div className="flex items-center justify-between text-muted-foreground pl-2 border-l-2 border-border">
                <span>Policyholders Compensation Fund (0.25%)</span>
                <span className="font-mono tabular-nums text-right text-foreground">
                  {formatCurrency(phcfLevy)}
                </span>
              </div>

              <div className="flex items-center justify-between text-muted-foreground pl-2 border-l-2 border-border">
                <div className="flex items-center gap-1.5">
                  <span>Stamp Duty</span>
                  <Badge
                    variant="outline"
                    className="text-[9px] py-0 px-1 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                  >
                    Statutory Exemption
                  </Badge>
                </div>
                <span className="font-mono tabular-nums text-right text-foreground">
                  KES 0.00
                </span>
              </div>

              <div className="flex items-center justify-between pt-2.5 border-t text-sm font-bold">
                <span className="text-foreground">Total Invoiced Premium</span>
                <span className="font-mono tabular-nums text-right text-base text-primary">
                  {formatCurrency(grossTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-3 bg-muted/10 border-t flex items-center justify-between text-xs text-muted-foreground">
          <span>HealthWatch MS • Authorized Healthcare Intermediary</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!client.email) {
                  alert("No email address found for this client.")
                  return
                }
                const subject = encodeURIComponent(
                  `Healthcare Policy ${policy.policy_number} - ${client.name}`,
                )
                const body = encodeURIComponent(
                  `Dear ${client.name},\n\nPlease find attached the master healthcare schedule for policy ${policy.policy_number}.\n\nInpatient Limit: ${formatCurrency(inpatientLimit)}\nCoverage Period: ${latestRiskNote?.coverage_start || policy.inception_date || ""} to ${latestRiskNote?.coverage_end || ""}\n\nKind regards,\nHealthWatch MS`,
                )
                window.location.href = `mailto:${client.email}?subject=${subject}&body=${body}`
              }}
              className="gap-1.5 h-8 text-xs"
            >
              <Mail className="size-3.5" />
              Email Client Summary
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
