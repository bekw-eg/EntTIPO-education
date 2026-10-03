"use client";

import React from "react";
import { Trophy, Target, ArrowRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { SessionStats } from "@/types";

interface SessionSummaryProps {
  session: SessionStats;
  onGoToDashboard: () => void;
  onNewSession: () => void;
}

export default function SessionSummary({
  session,
  onGoToDashboard,
  onNewSession,
}: SessionSummaryProps) {
  const { t } = useLanguage();
  const { correctCount, completedCount, attemptCount, correctAttemptCount } = session;
  const accuracy =
    attemptCount > 0 ? Math.round((correctAttemptCount / attemptCount) * 100) : 0;

  const getMessage = () => {
    if (accuracy >= 80) return t.summary.excellent;
    if (accuracy >= 60) return t.summary.good;
    return t.summary.keepPracticing;
  };

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (accuracy / 100) * circumference;

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-8 animate-in fade-in zoom-in-95 duration-500">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">{t.summary.title}</h1>
        <p className="text-xl text-muted-foreground">{getMessage()}</p>
      </div>

      <div className="bg-card p-8 rounded-2xl border shadow-sm flex flex-col items-center">
        {/* Circular Progress */}
        <div className="relative w-40 h-40 flex items-center justify-center mb-8">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              className="text-muted/40"
              strokeWidth="12"
              stroke="currentColor"
              fill="transparent"
              r={radius}
              cx="80"
              cy="80"
            />
            <circle
              className={`${
                accuracy >= 80
                  ? "text-emerald-500"
                  : accuracy >= 60
                  ? "text-blue-500"
                  : "text-amber-500"
              }`}
              strokeWidth="12"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
              r={radius}
              cx="80"
              cy="80"
            />
          </svg>
          <div className="absolute flex flex-col items-center justify-center">
            <span className="text-3xl font-bold">{accuracy}%</span>
            <span className="text-xs text-muted-foreground uppercase font-semibold">
              {t.summary.attemptAccuracy}
            </span>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 w-full border-t pt-6 text-center">
          <div>
            <p className="text-2xl font-bold">{completedCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t.summary.solved}</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {correctCount}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{t.summary.correct}</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {completedCount - correctCount}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{t.summary.wrong}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-5">
          {t.summary.attempts}: {attemptCount}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button
          variant="outline"
          size="lg"
          onClick={onGoToDashboard}
          className="w-full sm:w-auto"
        >
          {t.summary.toDashboard}
        </Button>
        <Button
          size="lg"
          onClick={onNewSession}
          className="w-full sm:w-auto font-semibold"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          {t.summary.newSession}
        </Button>
      </div>
    </div>
  );
}
