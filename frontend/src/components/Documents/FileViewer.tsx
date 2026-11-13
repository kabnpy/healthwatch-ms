import { AlertCircle, ExternalLink, Loader2, X } from "lucide-react"
import { client } from "@/client"
import { Button } from "@/components/ui/button"
import { useFileDocument } from "@/hooks/useFileDocument"

export interface FileViewerProps {
  id?: string
  receiptId?: string
  onClose?: () => void
}

export function FileViewer({ id, receiptId, onClose }: FileViewerProps) {
  const {
    data: document,
    isLoading,
    isError,
  } = useFileDocument({ id, receiptId })

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-center w-full">
        <Loader2 className="size-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground text-xs">Loading document...</p>
      </div>
    )
  }

  if (isError || !document) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-50 rounded-lg border border-dashed m-4">
        <AlertCircle className="size-10 text-destructive mb-3" />
        <h3 className="font-bold text-slate-900">Unable to load document</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
          The requested document ({id || receiptId || "N/A"}) could not be found
          or is unavailable.
        </p>
      </div>
    )
  }

  const baseUrl =
    (client.getConfig().baseURL as string) ||
    import.meta.env.VITE_API_URL ||
    "http://localhost:8000"
  const downloadUrl = `${baseUrl.replace(/\/$/, "")}/api/v1/documents/${document.id}/download`

  return (
    <div className="flex flex-col h-full bg-slate-100 rounded-lg overflow-hidden border">
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-900">
            {document.document_type || "External File"}
          </span>
          <span className="text-muted-foreground">
            • {receiptId ? "Receipt Proof" : "Attachment"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open(downloadUrl, "_blank")}
            className="h-7 text-xs px-2.5 gap-1.5 cursor-pointer"
          >
            <ExternalLink className="size-3" />
            Pop Out
          </Button>
          {onClose && (
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6 flex flex-col items-center justify-center min-h-[600px]">
        {document.mime_type?.startsWith("image/") ? (
          <img
            src={downloadUrl}
            alt={document.document_type}
            className="max-w-full max-h-[80vh] object-contain shadow-xl rounded-sm border bg-white"
          />
        ) : (
          <iframe
            src={downloadUrl}
            className="w-full h-full min-h-[750px] border-none shadow-xl bg-white rounded-sm"
            title={document.document_type || "Document Viewer"}
          />
        )}
      </div>
    </div>
  )
}
