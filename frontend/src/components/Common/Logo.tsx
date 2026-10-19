import { Link } from "@tanstack/react-router"
import { Shield } from "lucide-react"

import { cn } from "@/lib/utils"

interface LogoProps {
  variant?: "full" | "icon" | "responsive"
  className?: string
  asLink?: boolean
}

export function Logo({
  variant = "full",
  className,
  asLink = true,
}: LogoProps) {
  const brandMark = (
    <div className={cn("flex items-center gap-2.5 font-sans", className)}>
      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-xs">
        <Shield className="size-4 stroke-[2.5]" />
      </div>
      <div className="flex flex-col leading-none group-data-[collapsible=icon]:hidden">
        <span className="text-sm font-extrabold tracking-tight uppercase text-foreground">
          HealthWatch
        </span>
        <span className="text-[8px] font-bold tracking-[0.22em] uppercase text-muted-foreground">
          Insurance Agency
        </span>
      </div>
    </div>
  )

  const iconOnly = (
    <div
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-xs",
        className,
      )}
    >
      <Shield className="size-4 stroke-[2.5]" />
    </div>
  )

  const content = variant === "icon" ? iconOnly : brandMark

  if (!asLink) {
    return content
  }

  return (
    <Link
      to="/"
      className="flex items-center outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md"
    >
      {content}
    </Link>
  )
}
