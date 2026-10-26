import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  FileCheck2,
  FileText,
  Loader2,
  X,
} from "lucide-react"
import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useDocumentJobs } from "@/hooks/useDocumentJobs"

export function DocumentJobStatusTray() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const { data: jobsData } = useDocumentJobs(0, 10)

  const jobs = jobsData?.data || []

  const activeJobs = useMemo(
    () =>
      jobs.filter((j) => j.status === "pending" || j.status === "processing"),
    [jobs],
  )

  // If no jobs ever recorded or explicitly dismissed when idle, don't show
  if (jobs.length === 0 || (isDismissed && activeJobs.length === 0)) {
    return null
  }

  const hasActive = activeJobs.length > 0

  return (
    <div className="fixed bottom-4 right-4 z-40 max-w-sm w-full bg-card/95 backdrop-blur border rounded-xl shadow-xl overflow-hidden print:hidden transition-all duration-200">
      {/* HEADER BAR */}
      <div className="px-3.5 py-2.5 bg-muted/40 border-b flex items-center justify-between select-none">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 flex-1 text-left cursor-pointer hover:opacity-80 transition-opacity"
        >
          {hasActive ? (
            <Loader2 className="size-4 animate-spin text-primary" />
          ) : (
            <FileCheck2 className="size-4 text-emerald-600 dark:text-emerald-400" />
          )}
          <span className="text-xs font-bold text-foreground">
            Document Generation Tray
          </span>
          {hasActive ? (
            <Badge
              variant="outline"
              className="text-[10px] bg-primary/10 text-primary border-primary/20 px-1.5 py-0"
            >
              {activeJobs.length} active
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0"
            >
              Idle
            </Badge>
          )}
        </button>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground hover:text-foreground"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronUp className="size-3.5" />
            )}
          </Button>
          {!hasActive && (
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-muted-foreground hover:text-foreground"
              onClick={() => setIsDismissed(true)}
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* EXPANDED CONTENT LIST */}
      {isExpanded && (
        <div className="max-h-72 overflow-y-auto divide-y text-xs">
          {jobs.map((job) => {
            const isProcessing =
              job.status === "pending" || job.status === "processing"
            const isSuccess = job.status === "succeeded"
            const isFailed = job.status === "failed"

            return (
              <div key={job.id} className="p-3 space-y-1.5 hover:bg-muted/10">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="size-3.5 text-muted-foreground" />
                    <span className="font-semibold text-foreground capitalize">
                      {job.resource_type.replace(/_/g, " ")} Document
                    </span>
                  </div>

                  <div>
                    {isProcessing && (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-primary/10 text-primary border-primary/20"
                      >
                        <Loader2 className="size-2.5 animate-spin mr-1" />
                        {job.status}
                      </Badge>
                    )}
                    {isSuccess && (
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                        >
                          <CheckCircle2 className="size-2.5 mr-1" />
                          Ready
                        </Badge>
                        <a
                          href={`/api/v1/document-jobs/${job.id}/download`}
                          target="_blank"
                          rel="noreferrer"
                          download
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline ml-1"
                        >
                          <Download className="size-3" />
                          PDF
                        </a>
                      </div>
                    )}
                    {isFailed && (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-destructive/10 text-destructive border-destructive/20"
                      >
                        <AlertCircle className="size-2.5 mr-1" />
                        Failed
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                  <span>ID: {job.id.substring(0, 8)}</span>
                  <span>
                    {job.created_at
                      ? new Date(job.created_at).toLocaleTimeString()
                      : "—"}
                  </span>
                </div>

                {job.error_message && (
                  <p className="text-[10px] text-destructive bg-destructive/10 p-1.5 rounded">
                    {job.error_message}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
