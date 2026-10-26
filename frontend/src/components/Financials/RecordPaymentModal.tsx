import { Check, CreditCard, Receipt, Sparkles, X } from "lucide-react"
import { useState } from "react"
import type { PaymentMethod } from "@/client"
import { FileUploadZone } from "@/components/Common/FileUploadZone"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import useCustomToast from "@/hooks/useCustomToast"
import { useUploadDocument } from "@/hooks/useDocuments"
import { useInvoices } from "@/hooks/useFinancials"
import { useClients } from "@/hooks/useInsurance"
import { useAllocatePayment, useCreatePaymentRecord } from "@/hooks/usePayments"
import { parsePaymentConfirmation } from "@/utils/paymentParser"

interface RecordPaymentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialClientId?: string
  initialInvoiceId?: string
  initialAmount?: string | number
  onSuccess?: () => void
}

const PAYMENT_METHODS: Array<{
  value: PaymentMethod
  label: string
  hint: string
}> = [
  { value: "mpesa", label: "M-Pesa", hint: "Paybill / Till Reference" },
  {
    value: "bank_transfer",
    label: "Bank Transfer",
    hint: "EFT / RTGS Reference",
  },
  { value: "cheque", label: "Cheque", hint: "Bank Cheque Number" },
  { value: "cash", label: "Cash", hint: "Direct Cash Receipt" },
  {
    value: "ipf",
    label: "Insurance Premium Financing (IPF)",
    hint: "Bank IPF Facility",
  },
]

export function RecordPaymentModal({
  open,
  onOpenChange,
  initialClientId,
  initialInvoiceId,
  initialAmount,
  onSuccess,
}: RecordPaymentModalProps) {
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const { data: clientsData } = useClients(0, 500)

  const [clientId, setClientId] = useState(initialClientId || "")
  const [amount, setAmount] = useState(
    initialAmount ? String(initialAmount) : "",
  )
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("mpesa")
  const [referenceNumber, setReferenceNumber] = useState("")
  const [payerName, setPayerName] = useState("")
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0],
  )
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  // Invoice allocation toggle
  const [allocateToInvoice, setAllocateToInvoice] = useState(
    Boolean(initialInvoiceId),
  )
  const [targetInvoiceId, setTargetInvoiceId] = useState(initialInvoiceId || "")

  // Fetch open invoices for selected client
  const { data: invoicesData } = useInvoices(clientId || undefined, 0, 50)

  const unpaidInvoices = (invoicesData?.data || []).filter(
    (inv) => Number(inv.balance_due || 0) > 0,
  )

  const createPaymentMutation = useCreatePaymentRecord()
  const allocatePaymentMutation = useAllocatePayment()
  const uploadDocMutation = useUploadDocument()

  const isSubmitting =
    createPaymentMutation.isPending ||
    allocatePaymentMutation.isPending ||
    uploadDocMutation.isPending

  const [pasteText, setPasteText] = useState("")
  const [parsedBanner, setParsedBanner] = useState<string | null>(null)

  const handlePasteChange = (text: string) => {
    setPasteText(text)
    if (!text.trim()) {
      setParsedBanner(null)
      return
    }

    const parsed = parsePaymentConfirmation(text)
    if (parsed) {
      if (parsed.amount) {
        setAmount(parsed.amount.toFixed(2))
      }
      if (parsed.reference) {
        setReferenceNumber(parsed.reference)
      }
      if (parsed.paymentDate) {
        setPaymentDate(parsed.paymentDate)
      }
      if (parsed.paymentMethod) {
        setPaymentMethod(parsed.paymentMethod)
      }
      if (parsed.payerName) {
        setPayerName(parsed.payerName)
      }

      // Check for exact matching unpaid invoice
      if (parsed.amount && unpaidInvoices.length > 0) {
        const exactMatch = unpaidInvoices.find(
          (inv) =>
            Math.abs(Number(inv.balance_due || 0) - (parsed.amount || 0)) <
            0.01,
        )
        if (exactMatch) {
          setTargetInvoiceId(exactMatch.id)
          setAllocateToInvoice(true)
          setParsedBanner(
            `Extracted ${parsed.reference} for KES ${parsed.amount.toLocaleString()}. Auto-matched open Invoice #${exactMatch.invoice_number}.`,
          )
          showSuccessToast(
            `Parsed ${parsed.reference} and matched Invoice #${exactMatch.invoice_number}`,
          )
          return
        }
      }

      setParsedBanner(
        `Extracted ${parsed.reference} (${parsed.paymentMethod.toUpperCase()}) for KES ${
          parsed.amount ? parsed.amount.toLocaleString() : "N/A"
        }.`,
      )
      showSuccessToast(
        `Parsed ${parsed.reference} (${parsed.paymentMethod.toUpperCase()})`,
      )
    }
  }

  const handleClearPaste = () => {
    setPasteText("")
    setParsedBanner(null)
  }

  const handleClientChange = (val: string) => {
    setClientId(val)
    setTargetInvoiceId("")
  }

  const handleInvoiceSelect = (invId: string) => {
    setTargetInvoiceId(invId)
    const inv = unpaidInvoices.find((i) => i.id === invId)
    if (inv && (!amount || Number(amount) === 0)) {
      setAmount(String(inv.balance_due || inv.total_amount || ""))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const parsedAmount = parseFloat(amount)
    if (!clientId) {
      showErrorToast("Please select a client.")
      return
    }
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      showErrorToast("Please enter a valid positive payment amount.")
      return
    }
    if (!referenceNumber.trim()) {
      showErrorToast("Payment reference number is required.")
      return
    }

    try {
      // 1. Record Gross Payment Record
      const paymentRecord = await createPaymentMutation.mutateAsync({
        client_id: clientId,
        amount: parsedAmount.toFixed(2),
        payment_date: paymentDate,
        payment_method: paymentMethod,
        reference_number: referenceNumber.trim(),
        payer_name: payerName.trim() || undefined,
      })

      // 2. Upload proof if provided
      if (selectedFile && paymentRecord?.id) {
        await uploadDocMutation.mutateAsync({
          file: selectedFile,
          entity_type: "PaymentRecord",
          entity_id: paymentRecord.id,
          document_type: "Proof of Payment",
          metadata: {
            method: paymentMethod,
            reference: referenceNumber.trim(),
          },
        })
      }

      // 3. If immediate allocation requested and target invoice selected
      if (allocateToInvoice && targetInvoiceId && paymentRecord?.id) {
        const allocAmount = Math.min(
          parsedAmount,
          Number(
            unpaidInvoices.find((i) => i.id === targetInvoiceId)?.balance_due ||
              parsedAmount,
          ),
        )
        await allocatePaymentMutation.mutateAsync({
          id: paymentRecord.id,
          data: {
            payment_record_id: paymentRecord.id,
            invoice_id: targetInvoiceId,
            amount: allocAmount.toFixed(2) as any,
          },
        })
      }

      showSuccessToast(
        allocateToInvoice && targetInvoiceId
          ? "Payment recorded and successfully allocated to invoice."
          : "Payment logged to client ledger as unallocated receipt.",
      )

      onOpenChange(false)
      onSuccess?.()
    } catch (err: any) {
      showErrorToast(err?.detail || err?.message || "Failed to record payment.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <CreditCard className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Cashiering & Payment Ingestion
              </DialogTitle>
              <DialogDescription className="text-xs">
                Log funds received into agency accounts and allocate against
                policy invoices.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Quick-Fill: M-Pesa SMS / Bank Advice Parser */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                <Sparkles className="size-3.5 text-primary" />
                Quick-Fill: Paste M-Pesa SMS / Bank Advice
              </Label>
              {pasteText && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearPaste}
                  className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="size-3 mr-1" /> Clear
                </Button>
              )}
            </div>
            <Textarea
              placeholder="Paste raw Safaricom M-Pesa SMS confirmation or bank clearing text to auto-fill payment reference, amount, payer, and invoice..."
              value={pasteText}
              onChange={(e) => handlePasteChange(e.target.value)}
              className="text-xs bg-background resize-none min-h-[50px] font-mono"
              rows={2}
            />
            {parsedBanner && (
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded">
                <Check className="size-3 shrink-0" />
                <span>{parsedBanner}</span>
              </div>
            )}
          </div>

          {/* Client Selection */}
          {!initialClientId && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Client Name *</Label>
              <Select value={clientId} onValueChange={handleClientChange}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select insurance client..." />
                </SelectTrigger>
                <SelectContent>
                  {clientsData?.data?.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.name} {c.kra_pin ? `(${c.kra_pin})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Amount and Payment Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Amount Received (KES) *
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-mono font-bold text-muted-foreground">
                  KES
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min="1"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-12 font-mono text-sm tabular-nums text-right font-bold"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Payment Date *</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="text-xs"
                required
              />
            </div>
          </div>

          {/* Payment Method & Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Payment Channel *</Label>
              <Select
                value={paymentMethod}
                onValueChange={(val) => setPaymentMethod(val as PaymentMethod)}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select channel" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem
                      key={m.value}
                      value={m.value}
                      className="text-xs"
                    >
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Reference Code / Number *
              </Label>
              <Input
                placeholder="e.g. QHX472910, CHQ-00123"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="text-xs font-mono uppercase"
                required
              />
            </div>
          </div>

          {/* Payer Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Payer / Remitter Name
            </Label>
            <Input
              placeholder="e.g. John Doe, ABC Logistics Ltd"
              value={payerName}
              onChange={(e) => setPayerName(e.target.value)}
              className="text-xs"
            />
          </div>

          {/* Allocation Toggle & Selector */}
          <div className="rounded-lg border p-3.5 bg-muted/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold flex items-center gap-1.5">
                  <Receipt className="size-3.5 text-primary" />
                  Direct Invoice Allocation
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Apply payment to extinguish an open client invoice balance
                  immediately.
                </p>
              </div>
              <input
                type="checkbox"
                id="allocate-toggle"
                checked={allocateToInvoice}
                onChange={(e) => setAllocateToInvoice(e.target.checked)}
                className="size-4 rounded border-gray-300 text-primary cursor-pointer"
              />
            </div>

            {allocateToInvoice && (
              <div className="space-y-2 pt-2 border-t">
                {unpaidInvoices.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    {clientId
                      ? "No open or unpaid invoices found for this client. Payment will be held as unallocated credit."
                      : "Please select a client to view outstanding invoices."}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold text-muted-foreground uppercase">
                      Select Outstanding Invoice
                    </Label>
                    <Select
                      value={targetInvoiceId}
                      onValueChange={handleInvoiceSelect}
                    >
                      <SelectTrigger className="text-xs">
                        <SelectValue placeholder="Choose open invoice..." />
                      </SelectTrigger>
                      <SelectContent>
                        {unpaidInvoices.map((inv) => (
                          <SelectItem
                            key={inv.id}
                            value={inv.id}
                            className="text-xs"
                          >
                            <span className="font-mono font-bold mr-2">
                              {inv.invoice_number}
                            </span>
                            &bull; Due: KES{" "}
                            {Number(inv.balance_due || 0).toLocaleString()}{" "}
                            (Total: KES{" "}
                            {Number(inv.total_amount || 0).toLocaleString()})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Proof of Payment Upload */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Proof of Payment (Bank Slip / M-Pesa SMS / Cheque Leaf)
            </Label>
            <FileUploadZone
              selectedFile={selectedFile}
              onFileSelect={(file) => setSelectedFile(file)}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
            >
              <Check className="size-3.5" />
              {isSubmitting ? "Processing..." : "Record & Post Payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
