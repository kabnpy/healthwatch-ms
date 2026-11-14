import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_layout/clients/$clientId/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/clients/$clientId/policies",
      params: { clientId: params.clientId },
      replace: true,
    })
  },
})
