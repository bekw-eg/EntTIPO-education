"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface DailyGoalCardProps {
  completed: number;
  target: number;
}

export function DailyGoalCard({ completed, target }: DailyGoalCardProps) {
  const { t } = useLanguage();
  const pct = Math.min(100, Math.round((completed / Math.max(target, 1)) * 100));
  const done = completed >= target;

  return (
    <Card className={cn("overflow-hidden relative", done && "border-emerald-500/50")}>
      {done && <div className="absolute inset-0 bg-emerald-500/5" />}
      <CardContent className="p-5 relative">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-muted-foreground">{t.dashboard.dailyGoal}</p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-bold">{completed}</span>
              <span className="text-muted-foreground">/ {target}</span>
            </div>
          </div>
          <div
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center",
              done
                ? "bg-emerald-500/10 text-emerald-500"
                : "bg-primary/10 text-primary"
            )}
          >
            <Target className="w-5 h-5" />
          </div>
        </div>
        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700",
              done ? "bg-emerald-500" : "bg-primary"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          {done
            ? t.dashboard.goalCompleted
            : `${target - completed} ${t.dashboard.remainingTasks}`}
        </p>
      </CardContent>
    </Card>
  );
}
