"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface StreakCardProps {
  streak: number;
}

export function StreakCard({ streak }: StreakCardProps) {
  const { t } = useLanguage();

  const getStreakLabel = (n: number) => {
    if (n === 0) return t.dashboard.startStreak;
    if (n === 1) return t.dashboard.daySingle;
    if (n >= 2 && n <= 4) return t.dashboard.daysFew;
    return t.dashboard.daysMany;
  };

  return (
    <Card className="overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-transparent to-red-500/5" />
      <CardContent className="p-5 relative">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{t.dashboard.streak}</p>
            <div className="flex items-baseline gap-1">
              <p className="text-3xl font-bold">{streak}</p>
              <p className="text-sm text-muted-foreground">{getStreakLabel(streak)}</p>
            </div>
            {streak >= 7 && (
              <p className="text-xs text-orange-500 font-medium mt-1">
                {t.dashboard.daysStreakAwesome}
              </p>
            )}
          </div>
          <Flame
            className={cn(
              "w-12 h-12 transition-colors",
              streak > 0 ? "text-orange-500" : "text-muted-foreground"
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}
