import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { AlertCircle, ExternalLink, FileText, Loader2, X } from "lucide-react"
import { Suspense, useState } from "react"
import {
  client,
  DocumentsService,
  FinancialsService,
  RiskNotesService,
} from "@/client"
import { Button } from "@/components/ui/button"
import {
  useEnqueueDocumentJob,
  useProcessDocumentJob,
} from "@/hooks/useDocumentJobs"
import { CanonicalDocumentViewer } from "./CanonicalDocumentViewer"

// --- Types ---

type DocumentType = "risknote" | "invoice" | "receipt" | "external"

interface DocumentViewerProps {
  id: string
  type: DocumentType
  onClose?: () => void
}

// --- Shared Components ---

function DocumentShell({
  title,
  subtitle,
  children,
  headerExtra,
  footer,
  onClose,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  headerExtra?: React.ReactNode
  footer?: React.ReactNode
  onClose?: () => void
}) {
  return (
    <div className="flex flex-col h-full bg-slate-100 rounded-lg overflow-hidden border">
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-900">{title}</span>
          {subtitle && (
            <span className="text-[10px] font-mono uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
              {subtitle}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {headerExtra}
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

      <div className="flex-1 p-4 overflow-auto flex items-center justify-center">
        {children}
      </div>

      {footer && <div className="p-4 border-t bg-white text-xs">{footer}</div>}
    </div>
  )
}

function ErrorDisplay({ id, message }: { id: string; message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-lg shadow-inner border border-dashed m-8 w-full">
      <div className="p-4 rounded-full bg-destructive/10 text-destructive mb-4">
        <AlertCircle className="size-8" />
      </div>
      <h3 className="text-lg font-bold">Document Not Found</h3>
      <p className="text-muted-foreground max-w-xs mx-auto">
        {message ||
          "We could not find the requested file. It may have been deleted or the link is invalid."}
      </p>
      <p className="text-[10px] text-muted-foreground mt-4 font-mono">
        Reference ID: {id}
      </p>
    </div>
  )
}

// --- Loader Components (Canonical System Documents) ---

function RiskNoteLoader({ id, onClose }: { id: string; onClose?: () => void }) {
  const { data: riskNote } = useSuspenseQuery({
    queryFn: async () =>
      (await RiskNotesService.notesReadRiskNote({ path: { id } })).data,
    queryKey: ["risk-notes", id],
  })

  const enqueueJob = useEnqueueDocumentJob()
  const processJob = useProcessDocumentJob()
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true)
    try {
      const enqueued = await enqueueJob.mutateAsync({
        resource_type: "risk_note" as any,
        resource_id: riskNote.id,
      })
      if (enqueued?.id) {
        await processJob.mutateAsync(enqueued.id)
        window.open(`/api/v1/document-jobs/${enqueued.id}/download`, "_blank")
      }
    } catch (err) {
      console.error("Failed to generate official PDF:", err)
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  return (
    <CanonicalDocumentViewer
      resourceType="risk_note"
      resourceId={riskNote.id}
      title={`Risk Note - ${riskNote.risk_note_number || "Schedule"}`}
      onDownloadPdf={handleDownloadPdf}
      isDownloadingPdf={isDownloadingPdf}
      onClose={onClose}
    />
  )
}

function InvoiceLoader({ id, onClose }: { id: string; onClose?: () => void }) {
  const { data: invoice } = useSuspenseQuery({
    queryFn: async () =>
      (await FinancialsService.readInvoice({ path: { id } })).data,
    queryKey: ["invoices", id],
  })

  const enqueueJob = useEnqueueDocumentJob()
  const processJob = useProcessDocumentJob()
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true)
    try {
      const enqueued = await enqueueJob.mutateAsync({
        resource_type: "invoice" as any,
        resource_id: invoice.id,
      })
      if (enqueued?.id) {
        await processJob.mutateAsync(enqueued.id)
        window.open(`/api/v1/document-jobs/${enqueued.id}/download`, "_blank")
      }
    } catch (err) {
      console.error("Failed to generate official PDF:", err)
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  return (
    <CanonicalDocumentViewer
      resourceType="invoice"
      resourceId={invoice.id}
      title={`Invoice - ${invoice.invoice_number || "Debit Note"}`}
      onDownloadPdf={handleDownloadPdf}
      isDownloadingPdf={isDownloadingPdf}
      onClose={onClose}
    />
  )
}

// --- Loader Components (External Files) ---

function FileLoader({
  id,
  receiptId,
  onClose,
}: {
  id?: string
  receiptId?: string
  onClose?: () => void
}) {
  const {
    data: document,
    isLoading: isDocLoading,
    isError: isDocError,
  } = useQuery({
    queryKey: ["document-metadata", id, receiptId],
    queryFn: async () => {
      if (id) {
        return (await DocumentsService.readDocumentById({ path: { id } })).data
      }
      if (receiptId) {
        const docs = (
          await DocumentsService.readDocuments({
            query: {
              entity_id: receiptId,
              entity_type: "Receipt",
            },
          })
        ).data
        return docs.data[0] || null
      }
      return null
    },
  })

  const { data: receipt, isLoading: isReceiptLoading } = useQuery({
    queryKey: ["receipt-metadata", receiptId],
    queryFn: async () =>
      receiptId
        ? (
            await FinancialsService.readReceiptById({
              path: { id: receiptId },
            })
          ).data
        : null,
    enabled: !!receiptId,
  })

  if (isDocLoading || isReceiptLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-center w-full">
        <Loader2 className="size-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground text-xs">Loading document...</p>
      </div>
    )
  }

  if (isDocError || !document) {
    return <ErrorDisplay id={id || receiptId || "N/A"} />
  }

  const baseUrl =
    (client.getConfig().baseURL as string) ||
    import.meta.env.VITE_API_URL ||
    "http://localhost:8000"
  const downloadUrl = `${baseUrl.replace(/\/$/, "")}/api/v1/documents/${document.id}/download`

  const headerExtra = (
    <div className="flex items-center gap-3">
      {receipt && (
        <div className="flex gap-4 text-right">
          <div>
            <span className="text-[10px] font-bold uppercase text-muted-foreground mr-1">
              Amount:
            </span>
            <span className="font-bold text-xs">
              KES {receipt.amount.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-muted-foreground mr-1">
              Mode:
            </span>
            <span className="font-bold text-xs">{receipt.mode}</span>
          </div>
        </div>
      )}
      <Button
        size="sm"
        variant="outline"
        onClick={() => window.open(downloadUrl, "_blank")}
        className="h-7 text-xs px-2.5 gap-1.5 cursor-pointer"
      >
        <ExternalLink className="size-3" />
        Pop Out
      </Button>
    </div>
  )

  const footer =
    receipt?.allocations && receipt.allocations.length > 0 ? (
      <>
        <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2 flex items-center gap-1.5">
          <FileText className="size-3" />
          Payment Allocations
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {receipt.allocations.map((alloc: any, i: number) => (
            <div
              key={i}
              className="flex justify-between text-xs bg-slate-50 p-2 rounded border"
            >
              <span className="text-muted-foreground font-mono">
                {alloc.invoice_id.substring(0, 13)}...
              </span>
              <span className="font-bold">
                KES {alloc.amount_allocated.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </>
    ) : undefined

  return (
    <DocumentShell
      title={document.document_type || "External File"}
      subtitle={receipt ? "Receipt Proof" : "Attachment"}
      headerExtra={headerExtra}
      footer={footer}
      onClose={onClose}
    >
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
          title="Document Viewer"
        />
      )}
    </DocumentShell>
  )
}

// --- Main Component ---

export function DocumentViewer({ id, type, onClose }: DocumentViewerProps) {
  return (
    <div className="w-full h-full animate-in fade-in zoom-in-95 duration-200">
      {(type === "risknote" || type === "invoice") && (
        <Suspense
          fallback={
            <div className="flex items-center justify-center p-24">
              <Loader2 className="size-8 animate-spin text-primary" />
            </div>
          }
        >
          {type === "risknote" && <RiskNoteLoader id={id} onClose={onClose} />}
          {type === "invoice" && <InvoiceLoader id={id} onClose={onClose} />}
        </Suspense>
      )}

      {type === "receipt" && <FileLoader receiptId={id} onClose={onClose} />}
      {type === "external" && <FileLoader id={id} onClose={onClose} />}
    </div>
  )
}
