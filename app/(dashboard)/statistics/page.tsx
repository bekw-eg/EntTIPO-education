"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { PageLoading, LoadError } from "@/components/ui/page-state";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { StatisticsCharts } from "@/components/statistics/StatisticsCharts";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { interfaceText } from "@/lib/i18n/interface";
import { DailyAccuracy } from "@/types";

type TopicProgress = { id: string; topicId: string; masteryScore: number; topic: { name: string } };
type Statistics = { overallAccuracy: number; totalSolved: number; totalAttempts: number; totalDays: number;
  dailyAccuracy: DailyAccuracy[]; topicProgress: TopicProgress[]; bestTopic: TopicProgress | null; weakestTopic: TopicProgress | null };
export default function StatisticsPage() {
  const { t, locale, getTopicName, getMasteryLabel } = useLanguage(), copy = interfaceText[locale];
  const [stats, setStats] = useState<Statistics | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError(false);
    try { const res = await fetch("/api/statistics", { cache: "no-store" }); if (!res.ok) throw new Error(); setStats(await res.json()); }
    catch { setError(true); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <><Header title={t.statistics.title} subtitle={t.statistics.subtitle} />
    <div className="page-content">
      {loading ? <PageLoading /> : error ? <LoadError retry={() => void load()} /> : stats && <>
        {stats.totalAttempts === 0 ? <section className="space-y-4 py-6">
          <h2 className="section-title">{copy.emptyProgress}</h2><p className="max-w-prose text-sm text-muted-foreground">{copy.emptyProgressHint}</p>
          <div className="flex flex-wrap gap-3"><Button asChild><Link href="/practice">{t.statistics.continuePractice}</Link></Button><Button asChild variant="outline"><Link href="/diagnostics">{locale === "en" ? "Diagnostics" : "Диагностика"}</Link></Button></div>
        </section> : <>
          <section className="flex flex-wrap items-start justify-between gap-4 rounded-lg border bg-card p-4 sm:p-6">
            <div className="min-w-0 space-y-2"><h2 className="section-title">{t.statistics.needsAttention}</h2>
              <p className="text-muted-foreground">{stats.weakestTopic ? getTopicName(stats.weakestTopic.topic.name) : copy.noReviewsHint}</p>
            </div>
            <Button asChild><Link href={stats.weakestTopic ? `/practice?mode=specific_topic&topicId=${stats.weakestTopic.topicId}` : "/practice"}>{t.statistics.continuePractice}</Link></Button>
          </section>
          <div className="metric-row">
            <StatsCard title={t.statistics.accuracyLabel} value={`${Math.round(stats.overallAccuracy)}%`} subtitle={t.statistics.accuracyAllTime} />
            <StatsCard title={t.statistics.tasksSolvedLabel} value={stats.totalSolved} subtitle={`${stats.totalAttempts} ${t.statistics.solutionAttempts}`} />
            <StatsCard title={t.statistics.daysCountLabel} value={stats.totalDays} subtitle={t.statistics.activeDays} />
            <StatsCard title={t.statistics.masteredCountLabel} value={`${stats.topicProgress.filter(item => item.masteryScore >= 85).length} / ${stats.topicProgress.length}`} subtitle={t.statistics.masteredRule} />
          </div>
          {stats.bestTopic && <p className="text-sm"><span className="text-muted-foreground">{t.statistics.strongestTopic}: </span>{getTopicName(stats.bestTopic.topic.name)} · {stats.bestTopic.masteryScore}%</p>}
          {stats.topicProgress.length > 0 && <section className="space-y-4">
            <h2 className="section-title">{t.statistics.allTopicsTitle}</h2>
            <div className="divide-y">{stats.topicProgress.map(tp => <div key={tp.id || tp.topicId} className="grid min-w-0 gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
              <p className="text-sm font-medium">{getTopicName(tp.topic.name)}</p>
              <div className="min-w-0 space-y-2"><p className="text-xs text-muted-foreground">{tp.masteryScore}% · {getMasteryLabel(tp.masteryScore)}</p>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${tp.masteryScore}%` }} /></div></div>
              <Button asChild variant="ghost" className="justify-start sm:justify-center"><Link href={`/practice?mode=specific_topic&topicId=${tp.topicId}`}>{t.statistics.practiceBtn}</Link></Button>
            </div>)}</div>
          </section>}
          <StatisticsCharts dailyAccuracy={stats.dailyAccuracy} topicProgress={stats.topicProgress} />
        </>}
      </>}
    </div>
  </>;
}
