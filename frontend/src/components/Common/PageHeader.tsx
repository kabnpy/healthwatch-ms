import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: ReactNode
  eyebrow?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  className?: string
}

export function PageHeader({
  title,
  eyebrow,
  subtitle,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {eyebrow}
          </div>
        ) : null}
        <h1
          className={cn(
            "text-3xl font-extrabold tracking-tight",
            eyebrow && "mt-1",
          )}
        >
          {title}
        </h1>
        {subtitle ? (
          <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      ) : null}
    </div>
  )
}
