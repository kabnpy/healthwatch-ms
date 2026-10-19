import { Calculator, Check, CheckCircle2, Copy } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { formatCurrency } from "@/utils"
import {
  type AdvisoryRatingResult,
  calculateDomesticRating,
  calculateMedicalRating,
  calculateMotorPrivateRating,
  MOTOR_PRIVATE_DEFAULT_TIERS,
} from "@/utils/ratingCalculator"

interface AdvisoryRatingCalculatorProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  initialClass?: string
  initialSumInsured?: number
  onApplyCalculation?: (result: AdvisoryRatingResult) => void
}

export function AdvisoryRatingCalculator({
  isOpen,
  onOpenChange,
  initialClass = "Motor Private",
  initialSumInsured = 2000000,
  onApplyCalculation,
}: AdvisoryRatingCalculatorProps) {
  // Class selection
  const [selectedClass, setSelectedClass] = useState<string>(
    initialClass.toLowerCase().includes("medical")
      ? "Medical"
      : initialClass.toLowerCase().includes("domestic")
        ? "Domestic Package"
        : "Motor Private",
  )

  // Motor state
  const [motorSumInsured, setMotorSumInsured] =
    useState<number>(initialSumInsured)
  const [motorPvt, setMotorPvt] = useState<boolean>(true)
  const [motorExcessProtector, setMotorExcessProtector] =
    useState<boolean>(true)
  const [motorPassengerLiability, setMotorPassengerLiability] =
    useState<boolean>(false)
  const [motorRoadRescue, setMotorRoadRescue] = useState<boolean>(true)
  const [motorCourtesyCar, setMotorCourtesyCar] = useState<boolean>(false)

  // Domestic state
  const [domesticBuildings, setDomesticBuildings] = useState<number>(15000000)
  const [domesticContents, setDomesticContents] = useState<number>(3000000)
  const [domesticAllRisks, setDomesticAllRisks] = useState<number>(500000)
  const [domesticServants, setDomesticServants] = useState<number>(2)
  const [domesticOwnersLiability, setDomesticOwnersLiability] =
    useState<boolean>(true)

  // Medical state
  const [medicalTierLimit, setMedicalTierLimit] = useState<
    "1000000" | "2000000" | "5000000" | "10000000"
  >("2000000")
  const [medicalFamilySize, setMedicalFamilySize] = useState<
    "M" | "M+1" | "M+2" | "M+3" | "M+4"
  >("M+2")
  const [medOutpatient, setMedOutpatient] = useState<boolean>(true)
  const [medDental, setMedDental] = useState<boolean>(false)
  const [medOptical, setMedOptical] = useState<boolean>(false)
  const [medMaternity, setMedMaternity] = useState<boolean>(false)

  // Copy state
  const [hasCopied, setHasCopied] = useState(false)

  // Compute live calculation
  const ratingResult: AdvisoryRatingResult = useMemo(() => {
    if (selectedClass === "Motor Private") {
      return calculateMotorPrivateRating({
        sumInsured: motorSumInsured,
        extensions: {
          pvt: motorPvt,
          excessProtector: motorExcessProtector,
          passengerLiability: motorPassengerLiability,
          roadRescue: motorRoadRescue,
          courtesyCar: motorCourtesyCar,
        },
      })
    }

    if (selectedClass === "Domestic Package") {
      return calculateDomesticRating({
        buildingsSumInsured: domesticBuildings,
        contentsSumInsured: domesticContents,
        allRisksSumInsured: domesticAllRisks,
        numberOfServants: domesticServants,
        includeOwnersLiability: domesticOwnersLiability,
      })
    }

    // Default to Medical
    return calculateMedicalRating({
      tierLimit: medicalTierLimit,
      familySize: medicalFamilySize,
      riders: {
        outpatient: medOutpatient,
        dental: medDental,
        optical: medOptical,
        maternity: medMaternity,
      },
    })
  }, [
    selectedClass,
    motorSumInsured,
    motorPvt,
    motorExcessProtector,
    motorPassengerLiability,
    motorRoadRescue,
    motorCourtesyCar,
    domesticBuildings,
    domesticContents,
    domesticAllRisks,
    domesticServants,
    domesticOwnersLiability,
    medicalTierLimit,
    medicalFamilySize,
    medOutpatient,
    medDental,
    medOptical,
    medMaternity,
  ])

  const handleCopyBreakdown = () => {
    const textLines = [
      `HEALTHWATCH ADVISORY RATING BREAKDOWN`,
      `Class of Insurance: ${ratingResult.classOfInsurance}`,
      `Base Premium: ${formatCurrency(ratingResult.basePremium)}`,
      ...ratingResult.benefitLines.map(
        (b) =>
          `  - ${b.label}: ${b.isComplimentary ? "COMPLIMENTARY" : formatCurrency(b.amount)} (${b.rateDescription || ""})`,
      ),
      `Net Premium: ${formatCurrency(ratingResult.netPremium)}`,
      `Statutory Levies:`,
      `  - Training Levy (0.20%): ${formatCurrency(ratingResult.taxesAndLevies.trainingLevy)}`,
      `  - PHCF Levy (0.25%): ${formatCurrency(ratingResult.taxesAndLevies.phcfLevy)}`,
      `  - Stamp Duty: ${ratingResult.ruleProvenance.isMedicalStampDutyExempt ? "EXEMPT (KES 0.00)" : formatCurrency(ratingResult.taxesAndLevies.stampDuty)}`,
      `Total Premium: ${formatCurrency(ratingResult.grossTotal)}`,
      `Engine Version: ${ratingResult.ruleProvenance.engineVersion}`,
    ]
    navigator.clipboard.writeText(textLines.join("\n"))
    setHasCopied(true)
    toast.success("Rating breakdown copied to clipboard")
    setTimeout(() => setHasCopied(false), 2000)
  }

  const handleApply = () => {
    if (onApplyCalculation) {
      onApplyCalculation(ratingResult)
      toast.success("Applied rating calculation to active workflow")
      onOpenChange(false)
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto p-0 flex flex-col"
      >
        {/* Header */}
        <SheetHeader className="p-6 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Calculator className="size-5" />
              </div>
              <div>
                <SheetTitle className="text-lg font-bold tracking-tight">
                  Advisory Rating Calculator
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  Deterministic actuarial quoting and statutory levy schedule
                </SheetDescription>
              </div>
            </div>
            <Badge
              variant="outline"
              className="font-mono text-[11px] bg-background"
            >
              {ratingResult.ruleProvenance.engineVersion}
            </Badge>
          </div>
        </SheetHeader>

        <div className="p-6 space-y-6 flex-1">
          {/* Class Switcher */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Insurance Product Line
            </Label>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-full h-9">
                <SelectValue placeholder="Select Product Class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Motor Private">
                  Motor Private (Comprehensive Asset Rating)
                </SelectItem>
                <SelectItem value="Domestic Package">
                  Domestic Package (Multi-Component Homeowners)
                </SelectItem>
                <SelectItem value="Medical">
                  Medical / Healthcare (Demographic Tier Matrix)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* DYNAMIC RISK INPUTS */}
          {selectedClass === "Motor Private" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Declared Vehicle Sum Insured
                  </Label>
                  {motorSumInsured >= 3000000 && (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                    >
                      High-End Vehicle Tier (≥ KES 3.0M)
                    </Badge>
                  )}
                </div>
                <CurrencyInput
                  value={motorSumInsured}
                  onValueChange={setMotorSumInsured}
                  className="font-mono text-base font-semibold"
                />
                <p className="text-[11px] text-muted-foreground">
                  Applicable bracket:{" "}
                  <span className="font-medium text-foreground">
                    {
                      (
                        MOTOR_PRIVATE_DEFAULT_TIERS.find(
                          (t) => motorSumInsured <= t.max,
                        ) ||
                        MOTOR_PRIVATE_DEFAULT_TIERS[
                          MOTOR_PRIVATE_DEFAULT_TIERS.length - 1
                        ]
                      ).label
                    }
                  </span>
                </p>
              </div>

              {/* Cover Riders / Extensions */}
              <div className="space-y-2 pt-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Optional & Mandatory Extensions
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="flex items-start gap-2.5 p-2.5 rounded-md border bg-card text-xs">
                    <Checkbox
                      id="pvt"
                      checked={motorPvt}
                      onCheckedChange={(c) => setMotorPvt(Boolean(c))}
                    />
                    <div className="space-y-0.5">
                      <label
                        htmlFor="pvt"
                        className="font-medium cursor-pointer"
                      >
                        PVT (Terrorism & Violence)
                      </label>
                      <p className="text-[10px] text-muted-foreground">
                        {motorSumInsured >= 3000000
                          ? "Complimentary benefit"
                          : "0.25% of Sum Insured"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2.5 rounded-md border bg-card text-xs">
                    <Checkbox
                      id="excessProtector"
                      checked={motorExcessProtector}
                      onCheckedChange={(c) =>
                        setMotorExcessProtector(Boolean(c))
                      }
                    />
                    <div className="space-y-0.5">
                      <label
                        htmlFor="excessProtector"
                        className="font-medium cursor-pointer"
                      >
                        Excess Protector (Own Damage)
                      </label>
                      <p className="text-[10px] text-muted-foreground">
                        {motorSumInsured >= 3000000
                          ? "Complimentary benefit"
                          : "0.25% of Sum Insured"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2.5 rounded-md border bg-card text-xs">
                    <Checkbox
                      id="roadRescue"
                      checked={motorRoadRescue}
                      onCheckedChange={(c) => setMotorRoadRescue(Boolean(c))}
                    />
                    <div className="space-y-0.5">
                      <label
                        htmlFor="roadRescue"
                        className="font-medium cursor-pointer"
                      >
                        24/7 Road Rescue
                      </label>
                      <p className="text-[10px] text-muted-foreground">
                        Flat KES 1,000.00
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2.5 rounded-md border bg-card text-xs">
                    <Checkbox
                      id="passengerLiability"
                      checked={motorPassengerLiability}
                      onCheckedChange={(c) =>
                        setMotorPassengerLiability(Boolean(c))
                      }
                    />
                    <div className="space-y-0.5">
                      <label
                        htmlFor="passengerLiability"
                        className="font-medium cursor-pointer"
                      >
                        Passenger Legal Liability
                      </label>
                      <p className="text-[10px] text-muted-foreground">
                        Statutory flat KES 500.00
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2.5 rounded-md border bg-card text-xs">
                    <Checkbox
                      id="courtesyCar"
                      checked={motorCourtesyCar}
                      onCheckedChange={(c) => setMotorCourtesyCar(Boolean(c))}
                    />
                    <div className="space-y-0.5">
                      <label
                        htmlFor="courtesyCar"
                        className="font-medium cursor-pointer"
                      >
                        Courtesy Car Replacement
                      </label>
                      <p className="text-[10px] text-muted-foreground">
                        10 days option (KES 3,000.00)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedClass === "Domestic Package" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Section A: Buildings (0.12%)
                  </Label>
                  <CurrencyInput
                    value={domesticBuildings}
                    onValueChange={setDomesticBuildings}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Section B: Contents (0.85%)
                  </Label>
                  <CurrencyInput
                    value={domesticContents}
                    onValueChange={setDomesticContents}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Section C: All Risks Valuables (1.75%)
                  </Label>
                  <CurrencyInput
                    value={domesticAllRisks}
                    onValueChange={setDomesticAllRisks}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Domestic Servants (KES 1,200/ea)
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    value={domesticServants}
                    onChange={(e) =>
                      setDomesticServants(
                        Number.parseInt(e.target.value, 10) || 0,
                      )
                    }
                    className="font-mono text-sm h-8"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-md border bg-card text-xs">
                <Checkbox
                  id="ownersLiability"
                  checked={domesticOwnersLiability}
                  onCheckedChange={(c) =>
                    setDomesticOwnersLiability(Boolean(c))
                  }
                />
                <div className="space-y-0.5">
                  <label
                    htmlFor="ownersLiability"
                    className="font-medium cursor-pointer"
                  >
                    Section E: Owners & Occupiers Legal Liability
                  </label>
                  <p className="text-[10px] text-muted-foreground">
                    KES 5,000,000 indemnity limit (KES 1,500.00 flat)
                  </p>
                </div>
              </div>
            </div>
          )}

          {selectedClass === "Medical" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Inpatient Limit Tier
                  </Label>
                  <Select
                    value={medicalTierLimit}
                    onValueChange={(v: any) => setMedicalTierLimit(v)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select Tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1000000">
                        KES 1,000,000 Inpatient Limit
                      </SelectItem>
                      <SelectItem value="2000000">
                        KES 2,000,000 Inpatient Limit
                      </SelectItem>
                      <SelectItem value="5000000">
                        KES 5,000,000 Inpatient Limit
                      </SelectItem>
                      <SelectItem value="10000000">
                        KES 10,000,000 Inpatient Limit
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Family Demographic Census
                  </Label>
                  <Select
                    value={medicalFamilySize}
                    onValueChange={(v: any) => setMedicalFamilySize(v)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Family Census" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">
                        Principal Member Only (M)
                      </SelectItem>
                      <SelectItem value="M+1">
                        Member + 1 Dependent (M+1)
                      </SelectItem>
                      <SelectItem value="M+2">
                        Member + 2 Dependents (M+2)
                      </SelectItem>
                      <SelectItem value="M+3">
                        Member + 3 Dependents (M+3)
                      </SelectItem>
                      <SelectItem value="M+4">
                        Member + 4+ Dependents (M+4+)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Medical Benefit Riders */}
              <div className="space-y-2 pt-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Optional Outpatient & Healthcare Riders
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="flex items-start gap-2.5 p-2.5 rounded-md border bg-card text-xs">
                    <Checkbox
                      id="medOutpatient"
                      checked={medOutpatient}
                      onCheckedChange={(c) => setMedOutpatient(Boolean(c))}
                    />
                    <div className="space-y-0.5">
                      <label
                        htmlFor="medOutpatient"
                        className="font-medium cursor-pointer"
                      >
                        Outpatient Cover
                      </label>
                      <p className="text-[10px] text-muted-foreground">
                        KES 15,000 per member (Limit KES 100K)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2.5 rounded-md border bg-card text-xs">
                    <Checkbox
                      id="medDental"
                      checked={medDental}
                      onCheckedChange={(c) => setMedDental(Boolean(c))}
                    />
                    <div className="space-y-0.5">
                      <label
                        htmlFor="medDental"
                        className="font-medium cursor-pointer"
                      >
                        Dental Care Option
                      </label>
                      <p className="text-[10px] text-muted-foreground">
                        KES 4,500 per member (Limit KES 30K)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2.5 rounded-md border bg-card text-xs">
                    <Checkbox
                      id="medOptical"
                      checked={medOptical}
                      onCheckedChange={(c) => setMedOptical(Boolean(c))}
                    />
                    <div className="space-y-0.5">
                      <label
                        htmlFor="medOptical"
                        className="font-medium cursor-pointer"
                      >
                        Optical Care Option
                      </label>
                      <p className="text-[10px] text-muted-foreground">
                        KES 4,500 per member (Limit KES 30K)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2.5 rounded-md border bg-card text-xs">
                    <Checkbox
                      id="medMaternity"
                      checked={medMaternity}
                      onCheckedChange={(c) => setMedMaternity(Boolean(c))}
                    />
                    <div className="space-y-0.5">
                      <label
                        htmlFor="medMaternity"
                        className="font-medium cursor-pointer"
                      >
                        Maternity Benefit
                      </label>
                      <p className="text-[10px] text-muted-foreground">
                        Flat KES 12,000 (Limit KES 150K)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ITEMIZED RATING SCHEDULE BREAKDOWN */}
          <div className="rounded-lg border bg-muted/30 overflow-hidden">
            <div className="px-4 py-2.5 bg-muted/60 border-b flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Itemized Rating Breakdown (KES Fixed-Point)
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyBreakdown}
                className="h-7 text-xs gap-1.5 px-2"
              >
                {hasCopied ? (
                  <Check className="size-3.5 text-emerald-600" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                {hasCopied ? "Copied" : "Copy Schedule"}
              </Button>
            </div>

            <div className="p-4 space-y-3">
              {/* Base Premium Row */}
              <div className="flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-foreground">
                    Base Actuarial Premium
                  </span>
                  {ratingResult.appliedRatePercent && (
                    <span className="text-muted-foreground ml-1.5">
                      ({ratingResult.appliedRatePercent.toFixed(2)}%
                      {ratingResult.minimumPremiumFloor &&
                      ratingResult.basePremium ===
                        ratingResult.minimumPremiumFloor
                        ? ` • Subject to minimum KES ${ratingResult.minimumPremiumFloor.toLocaleString()}`
                        : ""}
                      )
                    </span>
                  )}
                </div>
                <span className="font-mono tabular-nums font-semibold text-right">
                  {formatCurrency(ratingResult.basePremium)}
                </span>
              </div>

              {/* Cover Riders / Benefit Lines */}
              {ratingResult.benefitLines.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-dashed">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                    Cover Extensions & Riders
                  </span>
                  {ratingResult.benefitLines.map((line, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs pl-2"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-foreground">{line.label}</span>
                        {line.isComplimentary && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] py-0 px-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          >
                            Complimentary
                          </Badge>
                        )}
                        {line.rateDescription && !line.isComplimentary && (
                          <span className="text-[11px] text-muted-foreground">
                            ({line.rateDescription})
                          </span>
                        )}
                      </div>
                      <span className="font-mono tabular-nums text-right">
                        {line.isComplimentary
                          ? formatCurrency(0)
                          : formatCurrency(line.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Net Premium Subtotal */}
              <div className="flex items-center justify-between text-xs pt-2 border-t font-semibold">
                <span className="text-foreground">Net Premium (Pre-Tax)</span>
                <span className="font-mono tabular-nums text-right text-foreground">
                  {formatCurrency(ratingResult.netPremium)}
                </span>
              </div>

              {/* Statutory Levies Inset */}
              <div className="p-3 rounded-md bg-muted/60 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <span>Kenya Statutory Levies & Taxes</span>
                  <span>Cap 487</span>
                </div>
                <div className="flex items-center justify-between pl-1 text-muted-foreground">
                  <span>Insurance Training Levy (0.20%)</span>
                  <span className="font-mono tabular-nums text-right text-foreground">
                    {formatCurrency(ratingResult.taxesAndLevies.trainingLevy)}
                  </span>
                </div>
                <div className="flex items-center justify-between pl-1 text-muted-foreground">
                  <span>Policyholders Compensation Fund (0.25%)</span>
                  <span className="font-mono tabular-nums text-right text-foreground">
                    {formatCurrency(ratingResult.taxesAndLevies.phcfLevy)}
                  </span>
                </div>
                <div className="flex items-center justify-between pl-1 text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <span>Stamp Duty</span>
                    {ratingResult.ruleProvenance.isMedicalStampDutyExempt && (
                      <Badge
                        variant="outline"
                        className="text-[9px] py-0 px-1 border-muted-foreground/30 text-muted-foreground"
                      >
                        Exempt
                      </Badge>
                    )}
                  </div>
                  <span className="font-mono tabular-nums text-right text-foreground">
                    {ratingResult.ruleProvenance.isMedicalStampDutyExempt
                      ? formatCurrency(0)
                      : formatCurrency(ratingResult.taxesAndLevies.stampDuty)}
                  </span>
                </div>
              </div>

              {/* Reconciled Gross Total */}
              <div className="flex items-center justify-between pt-2 border-t text-sm font-bold">
                <span className="text-foreground">
                  Reconciled Gross Premium
                </span>
                <span className="font-mono tabular-nums text-right text-base text-primary">
                  {formatCurrency(ratingResult.grossTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t bg-muted/10 flex items-center justify-end gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          {onApplyCalculation && (
            <Button
              size="sm"
              onClick={handleApply}
              className="gap-2 bg-primary text-primary-foreground font-medium"
            >
              <CheckCircle2 className="size-4" />
              Apply to Workflow
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
