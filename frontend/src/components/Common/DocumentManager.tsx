import { zodResolver } from "@hookform/resolvers/zod"
import type { ColumnDef } from "@tanstack/react-table"
import { Eye, FileIcon, Plus, Trash2 } from "lucide-react"
import { Suspense, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { DataTable } from "@/components/Common/DataTable"
import { DocumentViewer } from "@/components/Documents/DocumentViewer"
import PendingItems from "@/components/Pending/PendingItems"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  useDeleteDocument,
  useDocuments,
  useUploadDocument,
} from "@/hooks/useDocuments"
import { DocumentViewerModal } from "./DocumentViewerModal"
import { FileUploadZone } from "./FileUploadZone"

interface DocumentManagerProps {
  entityId: string
  entityType: "Client" | "Policy" | "Claim" | "Receipt"
  title?: string
}

const DOCUMENT_PRESETS: Record<string, string[]> = {
  Policy: [
    "Logbook",
    "Valuation Report",
    "Police Abstract",
    "Policy Schedule",
    "Cover Note",
  ],
  Client: [
    "KRA PIN Certificate",
    "National ID / Passport",
    "Certificate of Incorporation",
    "Utility Bill",
  ],
  Claim: ["Accident Photos", "Repair Estimate", "Claim Form", "Police Report"],
  Receipt: ["Proof of Payment", "Bank Slip", "M-Pesa Screenshot"],
}

const uploadSchema = z.object({
  document_type: z.string().min(1, "Document type is required"),
  file: z.instanceof(File, { message: "File is required" }),
})

export function DocumentManager({
  entityId,
  entityType,
  title = "Documents",
}: DocumentManagerProps) {
  const { data: documentsData, isLoading } = useDocuments(entityId, entityType)
  const uploadMutation = useUploadDocument()
  const deleteMutation = useDeleteDocument()

  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)

  const form = useForm<z.infer<typeof uploadSchema>>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      document_type: DOCUMENT_PRESETS[entityType]?.[0] || "",
    },
  })

  const onSubmit = async (values: z.infer<typeof uploadSchema>) => {
    await uploadMutation.mutateAsync({
      file: values.file,
      entity_type: entityType,
      entity_id: entityId,
      document_type: values.document_type,
    })
    form.reset()
    setIsUploadOpen(false)
  }

  const columns: ColumnDef<any>[] = useMemo(
    () => [
      {
        accessorKey: "document_type",
        header: "Type",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <FileIcon className="size-4 text-muted-foreground" />
            <span className="font-medium">{row.original.document_type}</span>
          </div>
        ),
      },
      {
        accessorKey: "mime_type",
        header: "Format",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground uppercase">
            {row.original.mime_type?.split("/")[1] || "File"}
          </span>
        ),
      },
      {
        accessorKey: "uploaded_at",
        header: "Date",
        cell: ({ row }) => (
          <span className="text-sm">
            {new Date(row.original.uploaded_at).toLocaleDateString()}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedDocId(row.original.id)}
            >
              <Eye className="size-4 mr-2" />
              View
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => deleteMutation.mutate(row.original.id)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ),
      },
    ],
    [deleteMutation],
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight text-primary">
          {title}
        </h2>
        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="size-4" />
              Upload
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload {entityType} Document</DialogTitle>
              <DialogDescription>
                Select a file to attach to this {entityType}.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="document_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Document Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DOCUMENT_PRESETS[entityType]?.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="file"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>File</FormLabel>
                      <FormControl>
                        <FileUploadZone
                          selectedFile={field.value}
                          onFileSelect={(file) => field.onChange(file)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setIsUploadOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={uploadMutation.isPending}>
                    {uploadMutation.isPending
                      ? "Uploading..."
                      : "Save Document"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        columns={columns}
        data={documentsData?.data || []}
        searchPlaceholder="Filter documents..."
        isLoading={isLoading}
      />

      {/* Lightbox Viewer */}
      {selectedDocId && (
        <DocumentViewerModal
          isOpen={!!selectedDocId}
          onClose={() => setSelectedDocId(null)}
          title="View Document"
        >
          <Suspense fallback={<PendingItems />}>
            <DocumentViewer
              id={selectedDocId}
              type="external"
              onClose={() => setSelectedDocId(null)}
            />
          </Suspense>
        </DocumentViewerModal>
      )}
    </div>
  )
}
