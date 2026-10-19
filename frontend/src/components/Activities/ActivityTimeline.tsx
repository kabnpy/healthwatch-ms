import {
  Calendar,
  type Clock,
  FileText,
  Mail,
  MessageSquare,
  PhoneCall,
  Plus,
  Shield,
  User,
} from "lucide-react"
import { useState } from "react"
import type { ActivityType } from "@/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import useCustomToast from "@/hooks/useCustomToast"
import { useActivities, useCreateActivity } from "@/hooks/useInsurance"
import { cn } from "@/lib/utils"

interface ActivityTimelineProps {
  clientId?: string
  policyId?: string
  renewalId?: string
  className?: string
}

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: typeof Clock; color: string; bg: string }
> = {
  note: {
    label: "Agent Note",
    icon: FileText,
    color: "text-amber-600 dark:text-amber-400 border-amber-500/20",
    bg: "bg-amber-500/10",
  },
  call: {
    label: "Phone Call",
    icon: PhoneCall,
    color: "text-blue-600 dark:text-blue-400 border-blue-500/20",
    bg: "bg-blue-500/10",
  },
  phone_call: {
    label: "Phone Call",
    icon: PhoneCall,
    color: "text-blue-600 dark:text-blue-400 border-blue-500/20",
    bg: "bg-blue-500/10",
  },
  email: {
    label: "Email Correspondence",
    icon: Mail,
    color: "text-purple-600 dark:text-purple-400 border-purple-500/20",
    bg: "bg-purple-500/10",
  },
  meeting: {
    label: "Meeting / Review",
    icon: Calendar,
    color: "text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    bg: "bg-emerald-500/10",
  },
  system: {
    label: "System Event",
    icon: Shield,
    color: "text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
    bg: "bg-zinc-500/10",
  },
}

export function ActivityTimeline({
  clientId,
  policyId,
  renewalId,
  className,
}: ActivityTimelineProps) {
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const { data: activitiesData, isLoading } = useActivities(
    clientId,
    policyId,
    renewalId,
    0,
    100,
  )
  const createMutation = useCreateActivity()

  const [selectedType, setSelectedType] = useState<ActivityType>(
    "note" as ActivityType,
  )
  const [content, setContent] = useState("")

  const activities = activitiesData?.data || []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return

    if (!clientId) {
      showErrorToast("Client context is required to log an activity.")
      return
    }

    try {
      await createMutation.mutateAsync({
        client_id: clientId,
        policy_id: policyId || undefined,
        renewal_id: renewalId || undefined,
        activity_type: selectedType,
        body: content.trim(),
      })
      setContent("")
      showSuccessToast("Activity logged to operational timeline.")
    } catch (err: any) {
      showErrorToast(err?.message || "Failed to log activity.")
    }
  }

  const formatTimestamp = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString("en-KE", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {/* Quick Log Form */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <MessageSquare className="size-4 text-primary" />
              Log Operational Activity
            </span>
            <span className="text-[11px] font-normal text-muted-foreground uppercase tracking-wider">
              Append-Only Audit Log
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {/* Type Switcher */}
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { type: "note", label: "Note", icon: FileText },
                  { type: "call", label: "Phone Call", icon: PhoneCall },
                  { type: "email", label: "Email", icon: Mail },
                  { type: "meeting", label: "Meeting", icon: Calendar },
                ] as const
              ).map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedType(type as ActivityType)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer",
                    selectedType === type
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-muted/40 hover:bg-muted text-muted-foreground border-border",
                  )}
                >
                  <Icon className="size-3" />
                  {label}
                </button>
              ))}
            </div>

            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`Log ${selectedType} details, negotiation outcomes, or operational instructions...`}
              rows={3}
              className="text-xs resize-none"
            />

            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                disabled={!content.trim() || createMutation.isPending}
                className="gap-1.5 text-xs h-8 cursor-pointer"
              >
                <Plus className="size-3.5" />
                {createMutation.isPending ? "Logging..." : "Record Activity"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Timeline Feed */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Activity Timeline ({activities.length})
          </h4>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">
            Loading timeline events...
          </div>
        ) : activities.length === 0 ? (
          <div className="p-8 text-center border rounded-lg bg-muted/10 text-xs text-muted-foreground">
            No operational activities logged yet. Record client calls, agent
            notes, or meetings above.
          </div>
        ) : (
          <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-px before:bg-border">
            {activities.map((act) => {
              const meta =
                (act.activity_type && TYPE_CONFIG[act.activity_type]) ||
                TYPE_CONFIG.note
              const Icon = meta.icon

              return (
                <div key={act.id} className="relative group">
                  {/* Timeline Node Icon */}
                  <div
                    className={cn(
                      "absolute -left-6 top-1.5 flex size-5 items-center justify-center rounded-full border bg-background shadow-xs",
                      meta.color,
                    )}
                  >
                    <Icon className="size-2.5" />
                  </div>

                  {/* Activity Card */}
                  <div className="rounded-lg border bg-card p-3.5 shadow-2xs hover:border-zinc-500/40 transition-colors">
                    <div className="flex items-center justify-between gap-2 border-b pb-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border",
                            meta.color,
                            meta.bg,
                          )}
                        >
                          {meta.label}
                        </span>
                        {act.created_by_id && (
                          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1 font-mono">
                            <User className="size-3 text-muted-foreground" />
                            Staff ({act.created_by_id.substring(0, 8)})
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {formatTimestamp(act.created_at || "")}
                      </span>
                    </div>

                    <div className="text-xs text-foreground leading-relaxed whitespace-pre-wrap font-sans">
                      {act.body}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
