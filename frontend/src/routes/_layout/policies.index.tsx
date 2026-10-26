import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_layout/policies/")({
  beforeLoad: () => {
    throw redirect({ to: "/clients" })
  },
  component: () => null,
})
