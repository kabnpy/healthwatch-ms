import { useMatches } from "@tanstack/react-router"
import { useMemo } from "react"

export interface BreadcrumbItem {
  label: string
  href: string
  isCurrent: boolean
}

const routeConfig: Record<string, string> = {
  "": "Home",
  admin: "Admin",
  users: "User Management",
  settings: "Settings",
  clients: "Clients",
  overview: "Overview",
  policies: "Policies",
  invoices: "Invoices",
  "risk-notes": "Risk Notes",
  documents: "Documents",
}

export const useBreadcrumbs = () => {
  const matches = useMatches()

  const breadcrumbs = useMemo(() => {
    return matches
      .filter(
        (match) =>
          match.pathname !== "/" && !match.pathname.includes("_layout"),
      )
      .map((match, index, array) => {
        const pathSegments = match.pathname.split("/").filter(Boolean)
        const lastSegment = pathSegments[pathSegments.length - 1] || ""

        // Try to get a label from our config
        let label = routeConfig[lastSegment] || lastSegment

        // Check if we have data from loader (only override dynamic segments, not known static routes)
        const data = match.loaderData as any
        if (data && !(lastSegment in routeConfig)) {
          if (data.name) {
            label = data.name
          } else if (data.policy_number) {
            label = data.policy_number
          }
        }

        // Handle dynamic IDs (simple heuristic: if it looks like a UUID or numeric ID and not in config and not replaced by name)
        const isId =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-12a-f]{12}$/i.test(
            lastSegment,
          ) ||
          /^[0-9a-f]{24}$/i.test(lastSegment) ||
          /^\d+$/.test(lastSegment)

        if (isId && label === lastSegment) {
          label = `${lastSegment.substring(0, 8)}...`
        }

        // Title case for unknown segments
        if (label === lastSegment && !isId) {
          label =
            lastSegment.charAt(0).toUpperCase() +
            lastSegment.slice(1).replace(/-/g, " ")
        }

        return {
          label,
          href: match.pathname,
          isCurrent: index === array.length - 1,
        }
      })
  }, [matches])

  // Prepend Home if not already there and we have breadcrumbs
  const finalBreadcrumbs: BreadcrumbItem[] = [
    { label: "Home", href: "/", isCurrent: breadcrumbs.length === 0 },
    ...breadcrumbs,
  ]

  return finalBreadcrumbs
}
