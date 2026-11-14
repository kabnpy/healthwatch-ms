import { AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface QueryErrorBannerProps {
  message?: string
  onRetry?: () => void
  className?: string
}

export function QueryErrorBanner({
  message = "Failed to load data. Please try again.",
  onRetry,
  className,
}: QueryErrorBannerProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive",
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
        <span>{message}</span>
      </div>
      {onRetry && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Retry
        </Button>
      )}
    </div>
  )
}
