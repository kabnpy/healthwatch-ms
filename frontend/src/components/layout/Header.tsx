import { Link } from "@tanstack/react-router"
import React from "react"
import { CommandMenu } from "@/components/Common/CommandMenu"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useBreadcrumbs } from "@/hooks/useBreadcrumbs"

export const Header = () => {
  const breadcrumbs = useBreadcrumbs()

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-6 md:px-8">
      <SidebarTrigger className="text-muted-foreground" />
      <Separator
        orientation="vertical"
        className="mx-1 data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center"
      />
      <div className="flex min-w-0 items-center gap-2 overflow-hidden">
        <Breadcrumb className="min-w-0">
          <BreadcrumbList className="flex-nowrap">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={crumb.href}>
                <BreadcrumbItem className="min-w-0">
                  {crumb.isCurrent ? (
                    <BreadcrumbPage className="truncate max-w-[120px] sm:max-w-[220px] md:max-w-none">
                      {crumb.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      className="truncate max-w-[90px] sm:max-w-[180px] md:max-w-none"
                      render={<Link to={crumb.href}>{crumb.label}</Link>}
                    />
                  )}
                </BreadcrumbItem>
                {index < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="ml-auto flex items-center">
        <CommandMenu />
      </div>
    </header>
  )
}
