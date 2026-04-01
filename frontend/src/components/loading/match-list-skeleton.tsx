import { Skeleton } from '@/components/ui/skeleton';

export function MatchListSkeleton() {
  return (
    <div className="space-y-3 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>

      <div className="grid grid-cols-6 gap-4 border-b border-border/60 py-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-4 w-16" />
        ))}
      </div>

      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="grid grid-cols-6 gap-4 border-b border-border/40 py-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <Skeleton className="h-6 w-12 rounded-full" />
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}
