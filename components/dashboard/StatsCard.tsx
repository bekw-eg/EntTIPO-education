"use client";
import { cn } from "@/lib/utils";
export function StatsCard({ title, value, subtitle, className }: {
  title: string; value: string | number; subtitle?: string; className?: string;
}) {
  return <div className={cn("min-w-0 space-y-1", className)}>
    <p className="text-sm text-muted-foreground">{title}</p>
    <p className="text-2xl font-semibold tabular-nums">{value}</p>
    {subtitle && <p className="text-xs leading-relaxed text-muted-foreground">{subtitle}</p>}
  </div>;
}
