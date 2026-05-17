import { Skeleton } from "@/components/ui/skeleton";

/** Liste aus Karten (z.B. Posts, Events, Kampagnen). */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-gray-200 bg-white p-4"
        >
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** KPI-Kachel-Reihe + Inhaltsblock (Dashboard). */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-gray-200 bg-white p-4"
          >
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-7 w-24" />
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <Skeleton className="h-5 w-40" />
        <div className="mt-4 space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-4/6" />
        </div>
      </div>
    </div>
  );
}

/** Tabellen-Skelett. */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div
      className="overflow-hidden rounded-lg border border-gray-200"
      aria-hidden="true"
    >
      <div className="border-b border-gray-200 bg-gray-50 p-3">
        <Skeleton className="h-4 w-32" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-gray-100 p-3 last:border-0"
        >
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="ml-auto h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
