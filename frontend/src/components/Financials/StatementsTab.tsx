import { useMemo, useState } from "react"
import type { ClientPublic } from "@/client"
import { ClientStatementView } from "@/components/Financials/ClientStatementView"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function StatementsTab({ clients }: { clients: ClientPublic[] }) {
  const [selectedStatementClientId, setSelectedStatementClientId] =
    useState<string>("")

  const statementClientId = selectedStatementClientId || (clients[0]?.id ?? "")
  const selectedClient = useMemo(
    () => clients.find((c) => c.id === statementClientId),
    [clients, statementClientId],
  )

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-muted/20 border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
              Client Account Selection
            </span>
            <p className="text-xs text-muted-foreground">
              Select a registered client portfolio to inspect their reconciled
              debt ledger, aged debt buckets, and payment allocations.
            </p>
          </div>

          <div className="w-full sm:w-80">
            <Select
              value={statementClientId}
              onValueChange={(val) => {
                if (val) setSelectedStatementClientId(val)
              }}
            >
              <SelectTrigger className="h-9 text-xs bg-background">
                <SelectValue placeholder="Choose a client..." />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    <span className="font-semibold">{c.name}</span>
                    {c.kra_pin && (
                      <span className="font-mono text-muted-foreground ml-2">
                        ({c.kra_pin})
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {statementClientId ? (
        <ClientStatementView
          clientId={statementClientId}
          clientName={selectedClient?.name}
          kraPin={selectedClient?.kra_pin}
        />
      ) : (
        <div className="py-12 border rounded-xl bg-card text-center text-muted-foreground text-xs">
          No clients available to generate statement.
        </div>
      )}
    </div>
  )
}
