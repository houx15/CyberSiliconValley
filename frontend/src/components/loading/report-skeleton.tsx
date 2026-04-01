import { Skeleton } from '@/components/ui/skeleton';

export function ReportSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="rounded-3xl border border-border/60 p-6">
        <div className="space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>

      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="rounded-3xl border border-border/60 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-12 w-12 rounded-full" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((__, skillIndex) => (
              <Skeleton key={skillIndex} className="h-6 w-16 rounded-full" />
            ))}
          </div>
          <div className="mt-4 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
          <div className="mt-4 flex gap-2">
            <Skeleton className="h-9 w-28 rounded-xl" />
            <Skeleton className="h-9 w-20 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}
