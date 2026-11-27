import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function PolicyDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between border-b pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-20" /> {/* Breadcrumb part */}
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-24" /> {/* Breadcrumb part */}
          </div>
          <Skeleton className="h-9 w-64" /> {/* Display Name */}
          <Skeleton className="h-4 w-32" /> {/* Policy Number */}
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div className="flex gap-2 border-b pb-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>

      {/* Content Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start pt-6">
        <div className="lg:col-span-3 space-y-6">
          {/* Template Skeleton */}
          <div className="border rounded-lg shadow-xl overflow-hidden bg-card">
            <div className="p-1 border-b">
              <Skeleton className="h-3 w-32 mx-auto" />
            </div>
            <div className="p-8 space-y-8">
              <div className="flex justify-between">
                <Skeleton className="h-16 w-32" />
                <Skeleton className="h-16 w-32" />
              </div>
              <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
              <div className="grid grid-cols-2 gap-8">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            </div>
          </div>
        </div>
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-12 w-16" />
            </CardContent>
          </Card>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}
