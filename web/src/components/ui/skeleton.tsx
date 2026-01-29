"use client";

import { cn } from "@/lib/utils";

type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted/50", className)}
      {...props}
    />
  );
}

// Skeleton for metric cards matching the dashboard grid
export function MetricCardSkeleton() {
  return (
    <div className="rounded-lg border border-l-4 border-l-muted p-2 space-y-2">
      <div className="flex items-start justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-3 rounded-full" />
      </div>
      <Skeleton className="h-6 w-16" />
      <Skeleton className="h-3 w-12" />
    </div>
  );
}

// Grid of skeleton cards for the dashboard
export function MetricGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <MetricCardSkeleton key={i} />
      ))}
    </div>
  );
}

// Skeleton for the chart area
export function ChartSkeleton() {
  return (
    <div className="rounded-xl border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-5 rounded-full" />
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}
