import { useQuery } from "@tanstack/react-query"
import { Calculator } from "lucide-react"
import { useState } from "react"
import {
  type RateBenefitPublic,
  type RateBracketPublic,
  RateTablesService,
  type RateTableVersionPublic,
} from "@/client"
import { AdvisoryRatingCalculator } from "@/components/Insurance/AdvisoryRatingCalculator"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency } from "@/utils"

export interface MedicalTierItem {
  id: string
  inpatient_limit: string | number
  family_size?: string
  m_premium?: string | number
  m1_premium?: string | number
  m2_premium?: string | number
  m3_premium?: string | number
  m4_premium?: string | number
  annual_premium?: string | number
}

export type RateTableVersionDetail = RateTableVersionPublic & {
  brackets?: RateBracketPublic[]
  benefits?: RateBenefitPublic[]
  medical_tiers?: MedicalTierItem[]
}

interface PricingRulesInspectorProps {
  product: {
    id: string
    name: string
    class_of_insurance: string
    insurer_id?: string
    default_commission_rate?: number
    insurer?: { name: string } | null
    product_details?: any
  }
}

export function PricingRulesInspector({ product }: PricingRulesInspectorProps) {
  const [calcOpen, setCalcOpen] = useState(false)
  const isMotor = product.class_of_insurance.toLowerCase().includes("motor")
  const isDomestic = product.class_of_insurance
    .toLowerCase()
    .includes("domestic")
  const isMedical = product.class_of_insurance.toLowerCase().includes("medical")

  const { data: rateTable, isLoading } =
    useQuery<RateTableVersionDetail | null>({
      queryKey: [
        "rate-tables",
        "published",
        product.insurer_id ?? null,
        product.class_of_insurance,
      ],
      queryFn: async () => {
        const listRes = await RateTablesService.tablesReadRateTables({
          query: {
            insurer_id: product.insurer_id ?? null,
            class_of_insurance: product.class_of_insurance,
            status: "published",
            limit: 1,
          },
        })
        const published = listRes.data?.data?.[0]
        if (!published) return null
        const detailRes = await RateTablesService.tablesReadRateTable({
          path: { id: published.id },
        })
        return detailRes.data ?? published
      },
    })

  const brackets = rateTable?.brackets ?? []
  const benefits = rateTable?.benefits ?? []
  const medicalTiers = rateTable?.medical_tiers ?? []

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg border bg-card">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">
              Underwriting Rating Schedule & Benchmark Rules
            </h3>
            <Badge variant="outline" className="text-xs bg-muted/50">
              IRA Cap 487 Compliant
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Actuarial brackets and statutory levies for {product.name} (
            {product.insurer?.name || "General Carrier"}).
          </p>
        </div>

        <Button
          onClick={() => setCalcOpen(true)}
          className="gap-2 bg-primary text-primary-foreground font-medium shrink-0 h-9"
          size="sm"
        >
          <Calculator className="size-4" />
          Test Rating Calculator
        </Button>
      </div>

      {/* LOADING / EMPTY STATE */}
      {isLoading && (
        <Card>
          <CardContent className="py-8 text-center text-xs text-muted-foreground">
            Loading published rate table schedule...
          </CardContent>
        </Card>
      )}

      {!isLoading && !rateTable && (
        <Card>
          <CardContent className="py-8 text-center space-y-1">
            <p className="text-sm font-medium text-foreground">
              No published rate table schedule found for this product.
            </p>
            <p className="text-xs text-muted-foreground">
              Publish a RateTableVersion for {product.class_of_insurance} to
              inspect live underwriting brackets, benefits, and tiers.
            </p>
          </CardContent>
        </Card>
      )}

      {/* MOTOR RATING SCHEDULE */}
      {!isLoading && rateTable && isMotor && brackets.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Value-Based Sum Insured Brackets</span>
              <span className="text-[11px] font-normal lowercase">
                Interval: [min, max)
              </span>
            </CardTitle>
            <CardDescription className="text-xs">
              Base actuarial percentage evaluated against declared motor vehicle
              value with minimum premium floors.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-xs">Value Band Range</TableHead>
                  <TableHead className="text-xs text-right">
                    Base Rate %
                  </TableHead>
                  <TableHead className="text-xs text-right">
                    Minimum Premium Floor
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {brackets.map((bracket) => (
                  <TableRow key={bracket.id}>
                    <TableCell className="font-mono text-xs font-medium">
                      {bracket.display_label}
                    </TableCell>
                    <TableCell className="font-mono tabular-nums text-xs font-semibold text-right">
                      {(Number(bracket.rate_percent) * 100).toFixed(2)}%
                    </TableCell>
                    <TableCell className="font-mono tabular-nums text-xs text-right">
                      {Number(bracket.minimum_premium) > 0
                        ? formatCurrency(Number(bracket.minimum_premium))
                        : "None (No Floor)"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* MEDICAL TIER MATRIX */}
      {!isLoading && rateTable && isMedical && medicalTiers.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Demographic Inpatient Census Matrix
            </CardTitle>
            <CardDescription className="text-xs">
              Actuarial premium schedules per member family bracket and
              inpatient limit tiers.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-xs">
                    Inpatient Limit Tier
                  </TableHead>
                  <TableHead className="text-xs text-right">
                    Member (M)
                  </TableHead>
                  <TableHead className="text-xs text-right">M + 1</TableHead>
                  <TableHead className="text-xs text-right">M + 2</TableHead>
                  <TableHead className="text-xs text-right">M + 3</TableHead>
                  <TableHead className="text-xs text-right">M + 4+</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {medicalTiers.map((tier) => (
                  <TableRow key={tier.id}>
                    <TableCell className="font-mono text-xs font-semibold">
                      {formatCurrency(Number(tier.inpatient_limit))} Limit
                    </TableCell>
                    <TableCell className="font-mono tabular-nums text-xs text-right">
                      {formatCurrency(
                        Number(tier.m_premium ?? tier.annual_premium ?? 0),
                      )}
                    </TableCell>
                    <TableCell className="font-mono tabular-nums text-xs text-right">
                      {formatCurrency(Number(tier.m1_premium ?? 0))}
                    </TableCell>
                    <TableCell className="font-mono tabular-nums text-xs text-right">
                      {formatCurrency(Number(tier.m2_premium ?? 0))}
                    </TableCell>
                    <TableCell className="font-mono tabular-nums text-xs text-right">
                      {formatCurrency(Number(tier.m3_premium ?? 0))}
                    </TableCell>
                    <TableCell className="font-mono tabular-nums text-xs text-right">
                      {formatCurrency(Number(tier.m4_premium ?? 0))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* BENEFITS & RIDERS SCHEDULE */}
      {!isLoading && rateTable && benefits.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Rateable Benefits & Riders
            </CardTitle>
            <CardDescription className="text-xs">
              Optional and mandatory benefit schedules from the published rate
              table version.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-xs">Benefit</TableHead>
                  <TableHead className="text-xs">Calculation Type</TableHead>
                  <TableHead className="text-xs text-right">
                    Rate / Amount
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {benefits.map((benefit) => (
                  <TableRow key={benefit.id}>
                    <TableCell className="font-medium text-xs">
                      {benefit.name}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {benefit.calculation_type}
                    </TableCell>
                    <TableCell className="font-mono tabular-nums text-xs font-semibold text-right">
                      {benefit.calculation_type === "percentage"
                        ? `${(Number(benefit.rate_value) * 100).toFixed(2)}%`
                        : formatCurrency(Number(benefit.rate_value))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* DOMESTIC MULTI-COMPONENT */}
      {isDomestic && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Multi-Component Property Rates
            </CardTitle>
            <CardDescription className="text-xs">
              Section-by-section sum insured rates for buildings, household
              contents, all risks, and domestic staff.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-xs">Section Name</TableHead>
                  <TableHead className="text-xs">Calculation Basis</TableHead>
                  <TableHead className="text-xs text-right">
                    Actuarial Rate / Cost
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium text-xs">
                    Section A: Residential Buildings
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    Declared replacement reconstruction value
                  </TableCell>
                  <TableCell className="font-mono tabular-nums text-xs font-semibold text-right">
                    0.12%
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-xs">
                    Section B: Household Contents
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    Declared furniture, fixtures, and interior contents
                  </TableCell>
                  <TableCell className="font-mono tabular-nums text-xs font-semibold text-right">
                    0.85%
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-xs">
                    Section C: All Risks Valuables
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    Jewelry, portable electronics, mobile cameras
                  </TableCell>
                  <TableCell className="font-mono tabular-nums text-xs font-semibold text-right">
                    1.75%
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-xs">
                    Section D: Domestic Servants (WIBA)
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    Cooks, gardeners, housekeepers, security guards
                  </TableCell>
                  <TableCell className="font-mono tabular-nums text-xs font-semibold text-right">
                    KES 1,200.00 / servant
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-xs">
                    Section E: Owners / Occupiers Liability
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    Third-party bodily injury / property damage (KES 5M limit)
                  </TableCell>
                  <TableCell className="font-mono tabular-nums text-xs font-semibold text-right">
                    KES 1,500.00 flat
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* STATUTORY TAXES & LEVIES SCHEDULE */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Kenya Statutory Tax & Regulatory Levies Schedule
          </CardTitle>
          <CardDescription className="text-xs">
            Mandatory levies under the Insurance Act (Cap 487) and Stamp Duty
            Act.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg border bg-muted/20 space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Training Levy (ITL)
              </span>
              <div className="font-mono tabular-nums text-lg font-bold text-foreground">
                0.20%
              </div>
              <p className="text-[10px] text-muted-foreground">
                Section 8A, Insurance Act. Applies to net premium.
              </p>
            </div>

            <div className="p-3 rounded-lg border bg-muted/20 space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Policyholders Fund (PCF)
              </span>
              <div className="font-mono tabular-nums text-lg font-bold text-foreground">
                0.25%
              </div>
              <p className="text-[10px] text-muted-foreground">
                PCF Regulations. Applies to net premium.
              </p>
            </div>

            <div className="p-3 rounded-lg border bg-muted/20 space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Stamp Duty
              </span>
              <div className="font-mono tabular-nums text-lg font-bold text-foreground">
                {isMedical ? "EXEMPT" : "KES 40.00"}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {isMedical
                  ? "Statutory exemption for medical & health policies."
                  : "Nominal contract slip fee per issued policy."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Embedded Advisory Rating Sheet */}
      <AdvisoryRatingCalculator
        isOpen={calcOpen}
        onOpenChange={setCalcOpen}
        productId={product.id}
        initialClass={product.class_of_insurance}
      />
    </div>
  )
}
