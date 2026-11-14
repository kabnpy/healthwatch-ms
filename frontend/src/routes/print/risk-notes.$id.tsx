import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Suspense } from "react"
import { z } from "zod"

import { RiskNotesService } from "@/client"
import { CanonicalDocumentViewer } from "@/components/Documents/CanonicalDocumentViewer"
import PendingItems from "@/components/Pending/PendingItems"
import { useDocumentPdfExport } from "@/hooks/useDocumentJobs"

const searchSchema = z.object({
  mode: z.enum(["invoice", "certificate"]).default("invoice").optional(),
})

function getRiskNoteQueryOptions(id: string) {
  return {
    queryFn: async () =>
      (await RiskNotesService.notesReadRiskNote({ path: { id } })).data,
    queryKey: ["risk-notes", id],
  }
}

export const Route = createFileRoute("/print/risk-notes/$id")({
  component: RiskNotePrint,
  validateSearch: (search) => searchSchema.parse(search),
})

function RiskNotePrintContent({ id }: { id: string }) {
  const { data: riskNote } = useSuspenseQuery(getRiskNoteQueryOptions(id))
  const { exportPdf, isExporting } = useDocumentPdfExport()

  const handleDownloadPdf = async () => {
    try {
      await exportPdf({
        resource_type: "risk_note" as any,
        resource_id: riskNote.id,
      })
    } catch (err) {
      console.error("Failed to generate official PDF:", err)
    }
  }

  return (
    <div className="max-w-[950px] mx-auto bg-white shadow-lg print:shadow-none min-h-screen p-4">
      <CanonicalDocumentViewer
        resourceType="risk_note"
        resourceId={riskNote.id}
        title={`Risk Note - ${riskNote.risk_note_number || "Schedule"}`}
        onDownloadPdf={handleDownloadPdf}
        isDownloadingPdf={isExporting}
      />
    </div>
  )
}

function RiskNotePrint() {
  const { id } = Route.useParams()
  return (
    <Suspense fallback={<PendingItems />}>
      <RiskNotePrintContent id={id} />
    </Suspense>
  )
}
