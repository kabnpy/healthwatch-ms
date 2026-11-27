import type { RenewalStatus } from "@/client"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getRenewalStageMeta } from "./renewalWorkflow"

interface RenewalStatusBadgeProps {
  status?: RenewalStatus | null
  className?: string
}

export function RenewalStatusBadge({
  status,
  className,
}: RenewalStatusBadgeProps) {
  if (!status) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "text-[11px] text-muted-foreground font-normal",
          className,
        )}
      >
        Not Initiated
      </Badge>
    )
  }

  const meta = getRenewalStageMeta(status)
  const Icon = meta.icon

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border",
        meta.color,
        className,
      )}
    >
      <Icon className="size-3" />
      {meta.label}
    </span>
  )
}
