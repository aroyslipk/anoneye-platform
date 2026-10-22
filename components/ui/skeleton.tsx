import { cn } from "@/lib/utils/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden="true" />;
}

export function PageSkeleton() {
  return (
    <div className="shell py-10 sm:py-14" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      <Skeleton className="h-5 w-28" />
      <Skeleton className="mt-4 h-10 w-2/3 max-w-md" />
      <Skeleton className="mt-3 h-4 w-1/2 max-w-sm" />
      <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <Skeleton key={key} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="mt-6 h-64 rounded-2xl" />
    </div>
  );
}
