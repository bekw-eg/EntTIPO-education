"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Target,
  Trophy,
  Calendar,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { StatisticsCharts } from "@/components/statistics/StatisticsCharts";
import { getMasteryBadgeColor } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function StatisticsPage() {
  const { t, getTopicName, getMasteryLabel } = useLanguage();
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/statistics");
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error("Failed to load statistics", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Header title={t.statistics.title} subtitle={t.statistics.subtitle} />
        <div className="p-12 text-center text-sm text-muted-foreground">
          {t.common.loading}
        </div>
      </div>
    );
  }

  const {
    overallAccuracy = 0,
    totalSolved = 0,
    totalAttempts = 0,
    totalDays = 0,
    dailyAccuracy = [],
    topicProgress = [],
    bestTopic = null,
    weakestTopic = null,
  } = stats || {};

  return (
    <div className="space-y-6">
      <Header
        title={t.statistics.title}
        subtitle={t.statistics.subtitle}
        actions={
          <Button asChild size="sm">
            <Link href="/practice">
              <Zap className="w-4 h-4 mr-2" />
              {t.statistics.continuePractice}
            </Link>
          </Button>
        }
      />

      <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
        {/* KPI Cards Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {t.statistics.accuracyLabel}
                </p>
                <p className="text-2xl font-bold">{Math.round(overallAccuracy)}%</p>
                <p className="text-[11px] text-muted-foreground">
                  {t.statistics.accuracyAllTime}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <Target className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {t.statistics.tasksSolvedLabel}
                </p>
                <p className="text-2xl font-bold">{totalSolved}</p>
                <p className="text-[11px] text-muted-foreground">
                  {totalAttempts} {t.statistics.solutionAttempts}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {t.statistics.daysCountLabel}
                </p>
                <p className="text-2xl font-bold">{totalDays}</p>
                <p className="text-[11px] text-muted-foreground">
                  {t.statistics.activeDays}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {t.statistics.masteredCountLabel}
                </p>
                <p className="text-2xl font-bold">
                  {topicProgress.filter((item: any) => item.masteryScore >= 85).length} / {topicProgress.length}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t.statistics.masteredRule}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                <Trophy className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Best and Weakest focus boxes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bestTopic && (
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <TrendingUp className="w-4 h-4" />
                    <span>{t.statistics.strongestTopic}</span>
                  </div>
                  <p className="font-bold text-base">
                    {getTopicName(bestTopic.topic?.name)}
                  </p>
                </div>
                <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  {bestTopic.masteryScore}%
                </span>
              </CardContent>
            </Card>
          )}

          {weakestTopic && (
            <Card className="border-rose-500/30 bg-rose-500/5">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                    <TrendingDown className="w-4 h-4" />
                    <span>{t.statistics.needsAttention}</span>
                  </div>
                  <p className="font-bold text-base">
                    {getTopicName(weakestTopic.topic?.name)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold text-rose-600 dark:text-rose-400">
                    {weakestTopic.masteryScore}%
                  </span>
                  <Button asChild size="sm" variant="outline" className="text-xs">
                    <Link href={`/practice?mode=specific_topic&topicId=${weakestTopic.topicId}`}>
                      {t.statistics.boostBtn}
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Recharts Analytics Charts */}
        <StatisticsCharts
          dailyAccuracy={dailyAccuracy}
          topicProgress={topicProgress}
        />

        {/* Complete Topics Progress Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t.statistics.allTopicsTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topicProgress.map((tp: any, index: number) => {
                const score = tp.masteryScore;
                const barColor =
                  score < 40
                    ? "bg-rose-500"
                    : score < 70
                    ? "bg-amber-500"
                    : score < 85
                    ? "bg-blue-500"
                    : "bg-emerald-500";

                const translatedName = getTopicName(tp.topic?.name || "");

                return (
                  <div
                    key={tp.id || index}
                    className="p-3 rounded-lg border bg-card/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 sm:w-1/3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-muted-foreground">
                          #{index + 1}
                        </span>
                        <p className="text-sm font-semibold truncate">
                          {translatedName}
                        </p>
                      </div>
                    </div>

                    {/* Bar */}
                    <div className="flex-1 sm:px-4 space-y-1">
                      <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                    </div>

                    {/* Stats & Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 text-xs">
                      <span className={`px-2 py-0.5 rounded-full font-semibold ${getMasteryBadgeColor(score)}`}>
                        {score}% · {getMasteryLabel(score)}
                      </span>
                      <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                        <Link href={`/practice?mode=specific_topic&topicId=${tp.topicId}`}>
                          {t.statistics.practiceBtn}
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
