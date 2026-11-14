import { createFileRoute } from "@tanstack/react-router"
import { ActivityTimeline } from "@/components/Activities/ActivityTimeline"

export const Route = createFileRoute("/_layout/clients/$clientId/activity")({
  component: ClientActivity,
})

function ClientActivity() {
  const { clientId } = Route.useParams()

  return (
    <div className="pt-2 pb-12">
      <ActivityTimeline clientId={clientId} />
    </div>
  )
}
