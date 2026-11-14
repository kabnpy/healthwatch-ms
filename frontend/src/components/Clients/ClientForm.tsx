import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Trash2 } from "lucide-react"
import { Controller, useFieldArray, useForm } from "react-hook-form"
import { z } from "zod"
import type { ClientCreate, ClientPublic, ClientUpdate } from "@/client"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
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
    <form
      onSubmit={form.handleSubmit(handleFormSubmit)}
      className="space-y-6"
    >
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Identity &amp; Tax
          </h3>
          <Separator className="mt-2" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Controller
            control={form.control}
            name="client_type"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Client Type</FieldLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <SelectTrigger aria-invalid={fieldState.invalid}>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Individual">Individual</SelectItem>
                    <SelectItem value="Corporate">Corporate</SelectItem>
                  </SelectContent>
                </Select>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="kra_pin"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>KRA PIN</FieldLabel>
                <Input
                  placeholder="A00..."
                  aria-invalid={fieldState.invalid}
                  {...field}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <div className="md:col-span-2">
            <Controller
              control={form.control}
              name="name"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Client Name</FieldLabel>
                  <Input
                    placeholder="Full Name or Company Name"
                    aria-invalid={fieldState.invalid}
                    {...field}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Contact &amp; Address
          </h3>
          <Separator className="mt-2" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Controller
            control={form.control}
            name="email"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Email</FieldLabel>
                <Input
                  type="email"
                  placeholder="client@example.com"
                  aria-invalid={fieldState.invalid}
                  {...field}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="phone"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Phone Number</FieldLabel>
                <Input
                  placeholder="07..."
                  aria-invalid={fieldState.invalid}
                  {...field}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <div className="md:col-span-2">
            <Controller
              control={form.control}
              name="physical_address"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Physical Address</FieldLabel>
                  <Input
                    placeholder="Building, Street, Area"
                    aria-invalid={fieldState.invalid}
                    {...field}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
        <Controller
          control={form.control}
          name="postal_number"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>P.O. Box</FieldLabel>
              <Input
                placeholder="12345"
                aria-invalid={fieldState.invalid}
                {...field}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="postal_code"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Postal Code</FieldLabel>
              <Input
                placeholder="00100"
                aria-invalid={fieldState.invalid}
                {...field}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="town"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Town</FieldLabel>
              <Input
                placeholder="Nairobi"
                aria-invalid={fieldState.invalid}
                {...field}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        </div>
      </div>

      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Key Contacts
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

            <Controller
              control={form.control}
              name={`contacts.${index}.name`}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Contact Name</FieldLabel>
                  <Input aria-invalid={fieldState.invalid} {...field} />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name={`contacts.${index}.role`}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Role (e.g. Accountant)</FieldLabel>
                  <Input aria-invalid={fieldState.invalid} {...field} />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name={`contacts.${index}.phone`}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Phone</FieldLabel>
                  <Input aria-invalid={fieldState.invalid} {...field} />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name={`contacts.${index}.email`}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Email</FieldLabel>
                  <Input aria-invalid={fieldState.invalid} {...field} />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
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
  )
}
