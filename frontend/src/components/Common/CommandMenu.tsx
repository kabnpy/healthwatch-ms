import { useNavigate } from "@tanstack/react-router"
import {
  Calculator,
  Clock,
  CreditCard,
  LayoutDashboard,
  Library,
  Receipt as ReceiptIcon,
  RefreshCw,
  Search,
  Settings,
  Shield,
  User,
  Users,
} from "lucide-react"
import * as React from "react"

import { AdvisoryRatingCalculator } from "@/components/Insurance/AdvisoryRatingCalculator"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { useInvoices } from "@/hooks/useFinancials"
import { useClients, usePolicies } from "@/hooks/useInsurance"
import { usePaymentRecords } from "@/hooks/usePayments"
import { getPolicyDisplayName } from "@/utils/insurance"

export function CommandMenu() {
  const [open, setOpen] = React.useState(false)
  const [ratingCalcOpen, setRatingCalcOpen] = React.useState(false)
  const navigate = useNavigate()

  const { data: clientsData } = useClients(0, 50)
  const { data: policiesData } = usePolicies(undefined, 0, 100)
  const { data: invoicesData } = useInvoices(undefined, 0, 50)
  const { data: paymentsData } = usePaymentRecords(undefined, 0, 50)

  // Expiring policies within 30 days
  const expiringPolicies = React.useMemo(() => {
    const now = Date.now()
    return (
      policiesData?.data?.filter((p) => {
        if (!p.active_note?.coverage_end) return false
        const end = new Date(p.active_note.coverage_end).getTime()
        const days = Math.ceil((end - now) / (1000 * 60 * 60 * 24))
        return days >= 0 && days <= 30
      }) || []
    )
  }, [policiesData])

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false)
    command()
  }, [])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative inline-flex items-center justify-start whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 w-full max-w-sm"
      >
        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
        <span className="text-muted-foreground">
          Search clients, policies, renewals...
        </span>
        <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search clients, policies, renewals..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          {/* Quick Actions & Navigation */}
          <CommandGroup heading="Quick Navigation">
            <CommandItem
              onSelect={() => runCommand(() => navigate({ to: "/" }))}
            >
              <LayoutDashboard className="mr-2 h-4 w-4" />
              <span>Agency Command Deck</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => navigate({ to: "/renewals" }))}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              <span>Renewals Desk ({expiringPolicies.length} due)</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => navigate({ to: "/policies" }))}
            >
              <Shield className="mr-2 h-4 w-4" />
              <span>Policies Portfolio</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => navigate({ to: "/clients" }))}
            >
              <Users className="mr-2 h-4 w-4" />
              <span>Client Portfolio</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => navigate({ to: "/financials" }))}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              <span>Financials & Accounts Hub</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => setRatingCalcOpen(true))}
            >
              <Calculator className="mr-2 h-4 w-4" />
              <span>Advisory Rating Calculator (Quick Quote)</span>
              <CommandShortcut>⌥Q</CommandShortcut>
            </CommandItem>
          </CommandGroup>

          {expiringPolicies.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Renewals Due (≤30 Days)">
                {expiringPolicies.map((policy) => {
                  const displayName = getPolicyDisplayName(policy)
                  const daysLeft = Math.ceil(
                    (new Date(policy.active_note!.coverage_end).getTime() -
                      Date.now()) /
                      (1000 * 60 * 60 * 24),
                  )
                  return (
                    <CommandItem
                      key={policy.id}
                      value={`renewal ${policy.policy_number} ${displayName}`}
                      onSelect={() => {
                        runCommand(() =>
                          navigate({
                            to: "/clients/$clientId/policies/$policyId",
                            params: {
                              clientId: policy.client_id,
                              policyId: policy.id,
                            },
                          }),
                        )
                      }}
                    >
                      <Clock className="mr-2 h-4 w-4 text-amber-600" />
                      <div className="flex flex-col">
                        <span>{displayName}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {policy.policy_number}
                        </span>
                      </div>
                      <CommandShortcut className="text-amber-600 font-bold">
                        {daysLeft}d left
                      </CommandShortcut>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </>
          )}

          <CommandSeparator />

          <CommandGroup heading="Clients">
            {clientsData?.data.map((client) => (
              <CommandItem
                key={client.id}
                value={`${client.name} ${client.kra_pin || ""} ${client.phone || ""} ${client.email || ""}`}
                onSelect={() => {
                  runCommand(() =>
                    navigate({
                      to: "/clients/$clientId/overview",
                      params: { clientId: client.id },
                    }),
                  )
                }}
              >
                <User className="mr-2 h-4 w-4" />
                <span>{client.name}</span>
                <CommandShortcut>
                  {client.kra_pin || client.phone}
                </CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Policies">
            {policiesData?.data.map((policy) => {
              const displayName = getPolicyDisplayName(policy)
              return (
                <CommandItem
                  key={policy.id}
                  value={`${policy.policy_number} ${displayName}`}
                  onSelect={() => {
                    runCommand(() =>
                      navigate({
                        to: "/clients/$clientId/policies/$policyId",
                        params: {
                          clientId: policy.client_id,
                          policyId: policy.id,
                        },
                      }),
                    )
                  }}
                >
                  <Shield className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span>{displayName}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {policy.policy_number}
                    </span>
                  </div>
                  <CommandShortcut>{policy.status}</CommandShortcut>
                </CommandItem>
              )
            })}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Invoices">
            {invoicesData?.data.map((invoice) => (
              <CommandItem
                key={invoice.id}
                value={invoice.invoice_number}
                onSelect={() => {
                  runCommand(() =>
                    navigate({
                      to: "/clients/$clientId/invoices",
                      params: { clientId: invoice.client_id },
                    }),
                  )
                }}
              >
                <ReceiptIcon className="mr-2 h-4 w-4" />
                <span>{invoice.invoice_number}</span>
                <CommandShortcut>
                  KES {(invoice.total_amount || 0).toLocaleString()}
                </CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Payment Records (Cleared Funds)">
            {paymentsData?.data.map((record) => (
              <CommandItem
                key={record.id}
                value={`${record.reference_number || ""} ${record.payment_method}`}
                onSelect={() => {
                  runCommand(() =>
                    navigate({
                      to: "/financials",
                    }),
                  )
                }}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                <span>{record.reference_number || "Payment Record"}</span>
                <CommandShortcut>
                  KES {Number(record.amount || 0).toLocaleString()}
                </CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="System">
            <CommandItem
              onSelect={() =>
                runCommand(() => navigate({ to: "/catalog/products" }))
              }
            >
              <Library className="mr-2 h-4 w-4" />
              <span>Product Catalog</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => navigate({ to: "/settings" }))}
            >
              <Settings className="mr-2 h-4 w-4" />
              <span>System Settings</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <AdvisoryRatingCalculator
        isOpen={ratingCalcOpen}
        onOpenChange={setRatingCalcOpen}
      />
    </>
  )
}
