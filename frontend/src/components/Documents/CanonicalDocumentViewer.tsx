import {
  Download,
  ExternalLink,
  Loader2,
  Printer,
  RefreshCw,
  X,
} from "lucide-react"
import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { useDocumentHtmlPreview } from "@/hooks/useDocumentHtmlPreview"

interface CanonicalDocumentViewerProps {
  resourceType: "risk_note" | "invoice" | "statement"
  resourceId?: string
  draftSnapshot?: Record<string, any>
  title?: string
  className?: string
  hideToolbar?: boolean
  onDownloadPdf?: () => void
  isDownloadingPdf?: boolean
  onClose?: () => void
}

export function CanonicalDocumentViewer({
  resourceType,
  resourceId,
  draftSnapshot,
  title = "Authoritative Document",
  className = "",
  hideToolbar = false,
  onDownloadPdf,
  isDownloadingPdf = false,
  onClose,
}: CanonicalDocumentViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const {
    data: htmlContent = "",
    isLoading,
    isFetching,
    error: queryError,
    refetch,
  } = useDocumentHtmlPreview({
    resourceType,
    resourceId,
    draftSnapshot,
  })

  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : "Failed to render document preview"
    : null

  const handleRefresh = () => {
    void refetch()
  }

  const handlePrint = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.focus()
      iframeRef.current.contentWindow.print()
    }
  }

  const handleOpenNewTab = () => {
    const blob = new Blob([htmlContent], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    window.open(url, "_blank")
  }

  return (
    <div
      className={`flex flex-col h-full bg-slate-100 rounded-lg overflow-hidden border ${className}`}
    >
      {/* Control Header Bar */}
      {!hideToolbar && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">{title}</span>
            <span className="text-[10px] font-mono uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
              Canonical Print Engine (A4)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRefresh}
              disabled={isFetching}
              className="h-7 text-xs px-2 gap-1 cursor-pointer"
              title="Refresh preview"
            >
              <RefreshCw
                className={`size-3 ${isFetching ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handlePrint}
              disabled={isLoading || !htmlContent}
              className="h-7 text-xs px-2.5 gap-1.5 cursor-pointer"
            >
              <Printer className="size-3" />
              Print
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleOpenNewTab}
              disabled={isLoading || !htmlContent}
              className="h-7 text-xs px-2.5 gap-1.5 cursor-pointer"
            >
              <ExternalLink className="size-3" />
              Pop Out
            </Button>
            {onDownloadPdf && (
              <Button
                size="sm"
                onClick={onDownloadPdf}
                disabled={isDownloadingPdf}
                className="h-7 text-xs px-2.5 gap-1.5 cursor-pointer bg-slate-900 text-white hover:bg-slate-800"
              >
                {isDownloadingPdf ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Download className="size-3" />
                )}
                Official PDF
              </Button>
            )}
            {onClose && (
              <div className="flex items-center pl-1 border-l ml-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onClose}
                  className="h-7 w-7 p-0 cursor-pointer text-slate-500 hover:text-slate-900"
                  title="Close"
                >
                  <X className="size-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Document View Area */}
      <div className="flex-1 p-4 sm:p-6 overflow-auto flex justify-center items-start">
        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="size-8 animate-spin text-primary" />
            <span className="text-xs font-mono font-medium">
              Compiling authoritative document layout...
            </span>
          </div>
        ) : error ? (
          <div className="p-8 max-w-md bg-white border border-destructive/20 rounded-lg text-center space-y-2">
            <p className="text-sm font-bold text-destructive">Preview Error</p>
            <p className="text-xs text-muted-foreground">{error}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRefresh}
              className="mt-2 text-xs"
            >
              Retry
            </Button>
          </div>
        ) : (
          <div className="w-full max-w-[850px] bg-white shadow-xl rounded-sm overflow-hidden border">
            <iframe
              ref={iframeRef}
              srcDoc={htmlContent}
              className="w-full min-h-[950px] border-0"
              title="Canonical Document Schedule"
            />
          </div>
        )}
      </div>
    </div>
  )
}
