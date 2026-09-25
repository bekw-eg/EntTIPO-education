"use client";

import { cn } from "@/lib/utils";
import { getMasteryBadgeColor } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface TopicProgressBarProps {
  name: string;
  masteryScore: number;
}

export function TopicProgressBar({ name, masteryScore }: TopicProgressBarProps) {
  const { getTopicName } = useLanguage();
  const translatedName = getTopicName(name);

  const barColor =
    masteryScore < 40
      ? "bg-rose-500"
      : masteryScore < 70
      ? "bg-amber-500"
      : masteryScore < 85
      ? "bg-blue-500"
      : "bg-emerald-500";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium truncate flex-1">{translatedName}</span>
        <span
          className={cn(
            "text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap",
            getMasteryBadgeColor(masteryScore)
          )}
        >
          {masteryScore}%
        </span>
      </div>
      <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColor)}
          style={{ width: `${masteryScore}%` }}
        />
      </div>
    </div>
  );
}
