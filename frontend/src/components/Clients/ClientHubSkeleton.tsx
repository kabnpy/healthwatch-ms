import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function ClientHubSkeleton() {
  return (
    <div className="flex flex-col gap-8 animate-in fade-in-50 duration-200">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between border-b pb-6">
        <div className="space-y-2">
          <Skeleton className="h-10 w-72" /> {/* Client Name */}
          <Skeleton className="h-4 w-44" /> {/* Client Type • Hub */}
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div className="w-full">
        <div className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground gap-1">
          <Skeleton className="h-8 w-20 rounded-sm" />
          <Skeleton className="h-8 w-20 rounded-sm" />
          <Skeleton className="h-8 w-20 rounded-sm" />
          <Skeleton className="h-8 w-24 rounded-sm" />
          <Skeleton className="h-8 w-20 rounded-sm" />
        </div>

        {/* Content Area */}
        <div className="flex flex-col gap-6 pt-4 pb-12 mt-4">
          {/* 1. Entity Profile & Contact Dossier Strip */}
          <Card className="border-border/80 bg-card shadow-xs">
            <CardContent className="p-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-3 min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Skeleton className="h-6 w-32 rounded-md" />
                    <Skeleton className="h-6 w-36 rounded-md" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-2 gap-x-6">
                    <div className="flex items-center gap-2">
                      <Skeleton className="size-3.5 rounded-full" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Skeleton className="size-3.5 rounded-full" />
                      <Skeleton className="h-4 w-40" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Skeleton className="size-3.5 rounded-full" />
                      <Skeleton className="h-4 w-44" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0">
                  <Skeleton className="h-8 w-32 rounded-md" />
                  <Skeleton className="h-8 w-28 rounded-md" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Operational Metrics Ribbon (4 Cards) */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="size-4 rounded-xs" />
                </CardHeader>
                <CardContent className="space-y-1.5">
                  <Skeleton className="h-7 w-24" />
                  <Skeleton className="h-3 w-36" />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 3. Operational Two-Column Workspace */}
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
            {/* Left Column: Policies Portfolio */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-7 w-24 rounded-md" />
              </div>
              <Card>
                <CardContent className="p-0 divide-y">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="p-3.5 flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-4 w-32 font-mono" />
                          <Skeleton className="h-4 w-14 rounded-full" />
                        </div>
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-36" />
                      </div>
                      <Skeleton className="h-8 w-24 rounded-md shrink-0" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Activity Timeline */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-7 w-20 rounded-md" />
              </div>
              <Card>
                <CardContent className="p-4 space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex gap-3">
                      <Skeleton className="size-7 rounded-full shrink-0" />
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center justify-between">
                          <Skeleton className="h-3.5 w-24" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-3/4" />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
