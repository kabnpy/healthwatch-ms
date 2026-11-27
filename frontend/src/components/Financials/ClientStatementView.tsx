import { Download } from "lucide-react"
import { CanonicalDocumentViewer } from "@/components/Documents/CanonicalDocumentViewer"
import { Button } from "@/components/ui/button"
import { useDocumentPdfExport } from "@/hooks/useDocumentJobs"
import { useClientStatement } from "@/hooks/useStatements"
import {
  buildStatementCsvFilename,
  serializeStatementLedgerToCsv,
} from "@/utils/statementCsv"

interface ClientStatementViewProps {
  clientId: string
  clientName?: string
  kraPin?: string
}

export function ClientStatementView({
  clientId,
  clientName,
}: ClientStatementViewProps) {
  const { data: statement, isLoading, error } = useClientStatement(clientId)
  const { exportPdf, isExporting } = useDocumentPdfExport()
  const ledgerEntries = statement?.ledger_entries ?? []

  const handleExportCSV = () => {
    const csvBody = serializeStatementLedgerToCsv(ledgerEntries)
    if (!csvBody) return

    const csvContent = `data:text/csv;charset=utf-8,${csvBody}`
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute(
      "download",
      buildStatementCsvFilename(statement?.client_name || clientName),
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleDownloadPdf = async () => {
    try {
      await exportPdf({
        resource_type: "statement",
        resource_id: clientId,
      })
    } catch (err) {
      console.error("Failed to generate statement PDF:", err)
    }
  }

  if (isLoading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center space-y-3 text-muted-foreground">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-xs font-mono">
          Reconciling client financial statement...
        </span>
      </div>
    )
  }

  if (error || !statement) {
    return (
      <div className="p-6 border border-destructive/20 bg-destructive/5 rounded-xl text-center space-y-2">
        <p className="text-sm font-semibold text-destructive">
          Unable to generate client account statement.
        </p>
        <p className="text-xs text-muted-foreground">
          Check that the client has a registered account and valid billing
          record.
        </p>
      </div>
    )
  }

  const displayClientName = statement.client_name || clientName || "Client"

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-muted/40 p-4 rounded-xl border">
        <div>
          <h2 className="text-base font-bold text-foreground">
            Account Statement & Running Ledger
          </h2>
          <p className="text-xs text-muted-foreground">
            Chronological debtor ledger with cleared payment allocations and
            debt aging.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleExportCSV}
          disabled={!ledgerEntries.length}
          className="gap-1.5 h-8 text-xs font-medium"
        >
          <Download className="size-3.5" />
          Export CSV
        </Button>
      </div>

      <CanonicalDocumentViewer
        resourceType="statement"
        resourceId={clientId}
        title={`Account Statement - ${displayClientName}`}
        onDownloadPdf={handleDownloadPdf}
        isDownloadingPdf={isExporting}
      />
    </div>
  )
}
