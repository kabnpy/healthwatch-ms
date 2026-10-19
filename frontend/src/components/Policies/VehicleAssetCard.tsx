import { Car } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/utils"

interface VehicleAssetCardProps {
  vehicle?: {
    registration_number?: string | null
    make?: string | null
    model?: string | null
    year_of_manufacture?: number | string | null
    chassis_number?: string | null
    engine_number?: string | null
    sum_insured?: number | string | null
    body_type?: string | null
  } | null
}

export function VehicleAssetCard({ vehicle }: VehicleAssetCardProps) {
  if (!vehicle) return null

  const sumInsured = Number(vehicle.sum_insured || 0)
  const isHighEnd = sumInsured >= 3000000

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <Car className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-sm bg-muted/60 px-2 py-0.5 rounded border">
                {vehicle.registration_number || "REG UNRECORDED"}
              </span>
              <span className="font-semibold text-sm text-foreground">
                {vehicle.make} {vehicle.model}
              </span>
              {vehicle.year_of_manufacture && (
                <span className="text-xs text-muted-foreground">
                  ({vehicle.year_of_manufacture})
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Certified NTSA Motor Asset Record • HealthWatch Physical File
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isHighEnd && (
            <Badge
              variant="outline"
              className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
            >
              High-End Tier (≥ KES 3.0M)
            </Badge>
          )}
          <div className="text-right">
            <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
              Sum Insured
            </span>
            <span className="font-mono tabular-nums text-sm font-bold text-foreground">
              {sumInsured > 0 ? formatCurrency(sumInsured) : "—"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
            Make & Model
          </span>
          <span className="font-medium text-foreground">
            {vehicle.make || "—"} {vehicle.model || ""}
          </span>
        </div>

        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
            Year of Manufacture
          </span>
          <span className="font-mono text-foreground">
            {vehicle.year_of_manufacture || "—"}
          </span>
        </div>

        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
            Chassis Number
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {vehicle.chassis_number || "UNRECORDED"}
          </span>
        </div>

        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
            Engine Number
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {vehicle.engine_number || "UNRECORDED"}
          </span>
        </div>
      </div>
    </div>
  )
}
