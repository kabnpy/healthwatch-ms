import { zodResolver } from "@hookform/resolvers/zod"
import { type SubmitHandler, useForm } from "react-hook-form"
import { toast } from "sonner"
import * as z from "zod"
import { FileUploadZone } from "@/components/Common/FileUploadZone"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useClients } from "@/hooks/useClients"
import { useUploadDocument } from "@/hooks/useDocuments"
import { useCreateReceipt } from "@/hooks/useFinancials"

const formSchema = z.object({
  client_id: z.string().min(1, "Please select a client"),
  receipt_number: z.string().min(1, "Receipt number is required"),
  amount: z.coerce.number().min(1, "Amount must be greater than 0"),
  date_received: z.string().min(1, "Date is required"),
  mode: z.string().min(1, "Payment mode is required"),
  reference: z.string().min(1, "Reference is required"),
  notes: z.string().optional(),
  file: z.instanceof(File, { message: "Proof of payment is required" }),
})

type FormValues = z.infer<typeof formSchema>

interface AddReceiptFormProps {
  onSuccess: () => void
  onCancel: () => void
  initialClientId?: string
}

export function AddReceiptForm({
  onSuccess,
  onCancel,
  initialClientId,
}: AddReceiptFormProps) {
  const { data: clientsData } = useClients(0, 1000)
  const createReceipt = useCreateReceipt()
  const uploadDocument = useUploadDocument()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      client_id: initialClientId || "",
      receipt_number: `RCT-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
      date_received: new Date().toISOString().split("T")[0],
      amount: 0,
      mode: "MPESA",
      reference: "",
      notes: "",
    } as any,
  })

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    try {
      // 1. Create the Receipt record
      const receipt = await createReceipt.mutateAsync({
        client_id: values.client_id,
        receipt_number: values.receipt_number,
        amount: values.amount,
        date_received: values.date_received,
        mode: values.mode,
        reference: values.reference,
        notes: values.notes,
      } as any)

      // 2. Upload the attachment linked to the Receipt ID
      await uploadDocument.mutateAsync({
        file: values.file,
        entity_type: "Receipt",
        entity_id: receipt.id,
        document_type: "Proof of Payment",
        metadata: {
          mode: values.mode,
          reference: values.reference,
        },
      })

      toast.success("Receipt and proof saved successfully")
      onSuccess()
    } catch (_error) {
      toast.error("Failed to process receipt")
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-4">
        {!initialClientId && (
          <FormField
            control={form.control as any}
            name="client_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Client</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {clientsData?.data.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control as any}
            name="receipt_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Receipt Number</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control as any}
            name="date_received"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date Received</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control as any}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount (KES)</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control as any}
            name="mode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Mode</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Mode" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="MPESA">MPESA</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control as any}
          name="reference"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reference (e.g. MPESA Code)</FormLabel>
              <FormControl>
                <Input placeholder="ABC123XYZ" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control as any}
          name="file"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Proof of Payment (Scan/Screenshot)</FormLabel>
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
          <Button variant="outline" type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createReceipt.isPending || uploadDocument.isPending}
          >
            {createReceipt.isPending || uploadDocument.isPending
              ? "Processing..."
              : "Create Receipt"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
