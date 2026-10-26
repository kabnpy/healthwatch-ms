import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { AlertCircle, FileText, Loader2 } from "lucide-react"
import { Suspense } from "react"

import {
  client,
  DocumentsService,
  FinancialsService,
  RiskNotesService,
} from "@/client"
import { CanonicalDocumentViewer } from "./CanonicalDocumentViewer"

// --- Types ---

type DocumentType = "risknote" | "invoice" | "receipt" | "external"

interface DocumentViewerProps {
  id: string
  type: DocumentType
}

// --- Shared Components ---

function DocumentShell({
  title,
  subtitle,
  children,
  headerExtra,
  footer,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  headerExtra?: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-inner overflow-hidden border">
      <div className="p-6 border-b bg-muted/30 flex justify-between items-center">
        <div>
          <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
            {subtitle || "Document"}
          </p>
          <h3 className="text-sm font-bold font-mono">{title}</h3>
        </div>
        {headerExtra}
      </div>

      <div className="flex-1 min-h-[600px] bg-zinc-100 p-4 flex items-center justify-center overflow-auto">
        {children}
      </div>

      {footer && <div className="p-6 border-t bg-muted/10">{footer}</div>}
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
          "We couldn't find the requested file. It may have been deleted or the link is invalid."}
      </p>
      <p className="text-[10px] text-muted-foreground mt-4 font-mono">
        Reference ID: {id}
      </p>
    </div>
  )
}

// --- Loader Components (Internal) ---

function RiskNoteLoader({ id }: { id: string }) {
  const { data: riskNote } = useSuspenseQuery({
    queryFn: async () =>
      (await RiskNotesService.notesReadRiskNote({ path: { id } })).data,
    queryKey: ["risk-notes", id],
  })

  return (
    <CanonicalDocumentViewer
      resourceType="risk_note"
      resourceId={riskNote.id}
      title={`Risk Note - ${riskNote.risk_note_number || "Schedule"}`}
    />
  )
}

function InvoiceLoader({ id }: { id: string }) {
  const { data: invoice } = useSuspenseQuery({
    queryFn: async () =>
      (await FinancialsService.readInvoice({ path: { id } })).data,
    queryKey: ["invoices", id],
  })

  return (
    <CanonicalDocumentViewer
      resourceType="invoice"
      resourceId={invoice.id}
      title={`Invoice - ${invoice.invoice_number || "Debit Note"}`}
    />
  )
}

// --- Loader Components (External) ---

function FileLoader({ id, receiptId }: { id?: string; receiptId?: string }) {
  // 1. Fetch the Document Metadata
  const {
    data: document,
    isLoading: isDocLoading,
    isError: isDocError,
  } = useQuery({
    queryKey: ["document-metadata", id, receiptId],
    queryFn: async () => {
      console.log("Fetching document metadata...", { id, receiptId })
      if (id)
        return (await DocumentsService.readDocumentById({ path: { id } })).data
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

  // 2. Fetch Receipt Metadata (only if it's a receipt view)
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
        <p className="text-muted-foreground">Loading document...</p>
      </div>
    )
  }

  if (isDocError || !document) {
    console.error("Document not found or error fetching metadata", {
      isDocError,
      document,
    })
    return <ErrorDisplay id={id || receiptId || "N/A"} />
  }

  // Ensure BASE URL is present and doesn't have double slashes
  const baseUrl =
    (client.getConfig().baseURL as string) ||
    import.meta.env.VITE_API_URL ||
    "http://localhost:8000"
  const downloadUrl = `${baseUrl.replace(/\/$/, "")}/api/v1/documents/${document.id}/download`

  console.log("Document Ready:", {
    name: document.document_type,
    mime: document.mime_type,
    url: downloadUrl,
  })

  const headerExtra = receipt ? (
    <div className="flex gap-6 text-right">
      <div>
        <p className="text-[10px] font-bold uppercase text-muted-foreground">
          Amount
        </p>
        <p className="font-bold text-xs">
          KES {receipt.amount.toLocaleString()}
        </p>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase text-muted-foreground">
          Mode
        </p>
        <p className="font-bold text-xs">{receipt.mode}</p>
      </div>
    </div>
  ) : null

  const footer =
    receipt?.allocations && receipt.allocations.length > 0 ? (
      <>
        <p className="text-[10px] font-bold uppercase text-muted-foreground mb-3 flex items-center gap-2">
          <FileText className="size-3" />
          Payment Allocations
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {receipt.allocations.map((alloc: any, i: number) => (
            <div
              key={i}
              className="flex justify-between text-xs bg-white p-2 rounded border border-black/5"
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
    >
      {document.mime_type?.startsWith("image/") ? (
        <img
          src={downloadUrl}
          alt={document.document_type}
          className="max-w-full h-auto shadow-2xl rounded-sm border bg-white"
          onError={() => console.error("Image failed to load:", downloadUrl)}
        />
      ) : (
        <iframe
          src={downloadUrl}
          className="w-full h-full min-h-[800px] border-none shadow-2xl bg-white rounded-sm"
          title="Document Viewer"
        />
      )}
    </DocumentShell>
  )
}

// --- Main Component ---

export function DocumentViewer({ id, type }: DocumentViewerProps) {
  return (
    <div className="w-full h-full animate-in fade-in zoom-in-95 duration-300">
      {/* Templates use Suspense */}
      {(type === "risknote" || type === "invoice") && (
        <Suspense
          fallback={
            <div className="flex items-center justify-center p-24">
              <Loader2 className="size-8 animate-spin text-primary" />
            </div>
          }
        >
          {type === "risknote" && <RiskNoteLoader id={id} />}
          {type === "invoice" && <InvoiceLoader id={id} />}
        </Suspense>
      )}

      {/* External Files use internal state for better error handling */}
      {type === "receipt" && <FileLoader receiptId={id} />}
      {type === "external" && <FileLoader id={id} />}
    </div>
  )
}
