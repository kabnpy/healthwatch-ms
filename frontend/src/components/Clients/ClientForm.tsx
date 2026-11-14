import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Trash2 } from "lucide-react"
import { useFieldArray, useForm } from "react-hook-form"
import { z } from "zod"
import type { ClientCreate, ClientPublic, ClientUpdate } from "@/client"
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
import { LoadingButton } from "@/components/ui/loading-button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

const contactSchema = z.object({
  name: z.string().min(1, "Contact name is required"),
  role: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").or(z.literal("")).optional(),
})

const formSchema = z.object({
  client_type: z.enum(["Individual", "Corporate"]),
  name: z.string().min(1, "Name is required"),
  kra_pin: z.string().min(11, "KRA PIN must be 11 characters").max(11),
  email: z.string().email("Invalid email").or(z.literal("")),
  phone: z.string().min(10, "Phone number is required"),
  physical_address: z.string().optional(),
  postal_number: z.string().optional(),
  postal_code: z.string().optional(),
  town: z.string().optional(),
  contacts: z.array(contactSchema).default([]),
})

type FormData = z.infer<typeof formSchema>

interface ClientFormProps {
  initialData?: ClientPublic
  onSubmit: (data: ClientCreate | ClientUpdate) => void
  onCancel?: () => void
  isLoading?: boolean
  submitLabel?: string
}

export const ClientForm = ({
  initialData,
  onSubmit,
  onCancel,
  isLoading,
  submitLabel = "Save Client",
}: ClientFormProps) => {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      client_type: (initialData?.client_type as any) || "Individual",
      name: initialData?.name || "",
      kra_pin: initialData?.kra_pin || "",
      email: initialData?.email || "",
      phone: initialData?.phone || "",
      physical_address: (initialData as any)?.physical_address || "",
      postal_number: (initialData as any)?.postal_number || "",
      postal_code: (initialData as any)?.postal_code || "",
      town: (initialData as any)?.town || "",
      contacts: (initialData?.contacts as any) || [],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "contacts",
  })

  const handleFormSubmit = (data: FormData) => {
    const formattedData = {
      ...data,
      email: data.email === "" ? null : data.email,
      physical_address: data.physical_address || null,
      postal_number: data.postal_number || null,
      postal_code: data.postal_code || null,
      town: data.town || null,
    }
    onSubmit(formattedData as any)
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleFormSubmit)}
        className="space-y-4"
      >
        <FormField
          control={form.control}
          name="client_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Client Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Individual">Individual</SelectItem>
                  <SelectItem value="Corporate">Corporate</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="kra_pin"
          render={({ field }) => (
            <FormItem>
              <FormLabel>KRA PIN</FormLabel>
              <FormControl>
                <Input placeholder="A00..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Client Name</FormLabel>
              <FormControl>
                <Input placeholder="Full Name or Company Name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="client@example.com"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Number</FormLabel>
              <FormControl>
                <Input placeholder="07..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="physical_address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Physical Address</FormLabel>
              <FormControl>
                <Input placeholder="Building, Street, Area" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-3 gap-4 border-t pt-4">
          <FormField
            control={form.control}
            name="postal_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>P.O. Box</FormLabel>
                <FormControl>
                  <Input placeholder="12345" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="postal_code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Postal Code</FormLabel>
                <FormControl>
                  <Input placeholder="00100" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="town"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Town</FormLabel>
                <FormControl>
                  <Input placeholder="Nairobi" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Client Contacts
            </h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() =>
                append({ name: "", role: "", phone: "", email: "" })
              }
            >
              <Plus className="size-4" />
              Add Contact
            </Button>
          </div>
          <Separator />

          {fields.map((field, index) => (
            <div
              key={field.id}
              className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/10 relative group"
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove contact"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-destructive"
                onClick={() => remove(index)}
              >
                <Trash2 className="size-4" />
              </Button>

              <FormField
                control={form.control}
                name={`contacts.${index}.name`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`contacts.${index}.role`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role (e.g. Accountant)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`contacts.${index}.phone`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`contacts.${index}.email`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          ))}

          {fields.length === 0 && (
            <p className="text-center text-xs text-muted-foreground italic py-4">
              No additional contacts added.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-4 pt-4">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <LoadingButton type="submit" loading={isLoading}>
            {submitLabel}
          </LoadingButton>
        </div>
      </form>
    </Form>
  )
}
