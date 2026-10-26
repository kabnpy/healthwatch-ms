import { Activity } from "lucide-react"

import { useSidebar } from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export interface AgencyStatusBadgeProps {
  className?: string
  currency?: string
  timezone?: string
  status?: string
}

export function AgencyStatusBadge({
  className,
  currency = "KES",
  timezone = "UTC",
  status = "Operational",
}: AgencyStatusBadgeProps) {
  const { isMobile, state } = useSidebar()
  const isCollapsed = state === "collapsed" && !isMobile

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          data-testid="agency-status-badge"
          role="status"
          aria-label={`Agency status: ${status}. Active currency: ${currency}, timezone: ${timezone}.`}
          className={cn(
            "flex items-center justify-between rounded-lg border border-sidebar-border/70 bg-sidebar-accent/40 px-2.5 py-1.5 text-xs font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent/60 select-none",
            "group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:border-sidebar-border/60",
            className,
          )}
        >
          {/* Expanded view */}
          <div className="flex items-center justify-between w-full group-data-[collapsible=icon]:hidden gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex size-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              <span className="truncate text-xs font-medium text-foreground">
                {status}
              </span>
            </div>
            <div className="flex items-center gap-1 font-mono text-[10px] font-medium tracking-wider text-muted-foreground uppercase shrink-0">
              <span>{currency}</span>
              <span className="text-muted-foreground/60">•</span>
              <span>{timezone}</span>
            </div>
          </div>

          {/* Collapsed icon view */}
          <div className="relative hidden group-data-[collapsible=icon]:flex items-center justify-center">
            <Activity className="size-4 text-muted-foreground" />
            <span className="absolute -top-1 -right-1 flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" align="center" hidden={!isCollapsed}>
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 font-medium text-xs">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            <span>{status}</span>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">
            {currency} • {timezone}
          </span>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

export default AgencyStatusBadge
