"use client";

import React from "react";
import Link from "next/link";
import {
  BookOpen,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/layout/Header";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { TopicProgressBar } from "@/components/dashboard/TopicProgressBar";

import { DashboardStats } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { contentText } from '@/lib/i18n/content';
import { DailyLearningPlanCard } from "./DailyLearningPlanCard";
import { PreparationView } from "@/components/learning-road/PreparationView";
import { preparationText } from "@/lib/i18n/preparation";

interface DashboardViewProps {
  initialData: DashboardStats;
}

export function DashboardView({ initialData: data }: DashboardViewProps) {
  const { t, locale, getTopicName } = useLanguage();
  const [dailyOpen, setDailyOpen] = React.useState(false);

  const getGreeting = () => {
    const hour = Number(new Intl.DateTimeFormat("en", { timeZone: data.timeZone ?? "Asia/Qyzylorda", hour: "numeric", hourCycle: "h23" }).format(new Date()));
    if (hour < 12) return t.dashboard.morningGreeting;
    if (hour < 18) return t.dashboard.afternoonGreeting;
    return t.dashboard.eveningGreeting;
  };

  const getFormattedDate = () => {
    const localeMap = {
      ru: "ru-RU",
      kk: "kk-KZ",
      en: "en-US",
    };
    const dateStr = new Date().toLocaleDateString(localeMap[locale] || "ru-RU", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: data.timeZone ?? "Asia/Qyzylorda",
    });
    return dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
  };

  return (
    <div className="min-w-0">
      <Header
        title={getGreeting()}
        subtitle={getFormattedDate()}
      />

      <div className="page-content">
        <PreparationView compact />
        <details className="border-b py-4" onToggle={event => setDailyOpen(event.currentTarget.open)}><summary className="cursor-pointer text-sm font-medium">{preparationText[locale].daily}</summary>{dailyOpen && <DailyLearningPlanCard />}</details>
        {/* Stats Grid */}
        <div className="metric-row">
          <StatsCard
            title={t.dashboard.todayTasks}
            value={`${data.todaySolved}`}
            subtitle={t.dashboard.tasksSolved}
          />
          <StatsCard
            title={t.dashboard.accuracy}
            value={`${data.overallAccuracy}%`}
            subtitle={t.dashboard.correctAnswers}
          />
          <StatsCard
            title={t.dashboard.streak}
            value={data.streak}
            subtitle={
              data.streak > 0 ? t.dashboard.streakDays : t.dashboard.startStreak
            }
          />
          <StatsCard
            title={t.dashboard.totalSolved}
            value={data.totalSolved}
            subtitle={`${data.totalAttempts} ${t.statistics.solutionAttempts}`}
          />
        </div>



        {/* CTA Buttons */}
        <div className="flex flex-wrap gap-2 border-b pb-6">
          <Button asChild variant="ghost">
            <Link href="/practice">
              <BookOpen className="w-4 h-4 mr-2" />
              {t.dashboard.startPractice}
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/practice?mode=weak_topics">{t.dashboard.weakTopics}</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/topics">{t.dashboard.chooseTopic}</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/mistakes">
              <AlertCircle className="w-4 h-4 mr-2 text-muted-foreground" />
              {t.dashboard.mistakes}
            </Link>
          </Button>
        </div>

        {/* Topics section: Weak & Strong */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Weak topics */}
          <Card className="border-0 bg-transparent">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="text-muted-foreground font-semibold">↓</span> {t.dashboard.weakTopics}
              </CardTitle>
              {data.weakTopics.length > 0 && (
                <Button asChild variant="ghost" size="sm" className="text-xs h-7">
                  <Link href="/practice?mode=weak_topics">{t.dashboard.trainWeak}</Link>
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {data.weakTopics.length > 0 ? (
                data.weakTopics.slice(0, 5).map((p) => (
                  <TopicProgressBar
                    key={p.topicId}
                    name={p.topic.name}
                    masteryScore={p.masteryScore}
                  />
                ))
              ) : (
                <p className="text-sm text-muted-foreground py-4">
                  {t.dashboard.noWeakTopics}
                  <Link href="/diagnostics" className="mt-2 block text-primary underline">{locale === "en" ? "Diagnostics" : "Диагностика"}</Link>
                </p>
              )}
            </CardContent>
          </Card>

          {/* Strong topics */}
          <Card className="border-0 bg-transparent">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="text-muted-foreground font-semibold">↑</span> {t.dashboard.strongTopics}
              </CardTitle>
              <Button asChild variant="ghost" size="sm" className="text-xs h-7">
                <Link href="/topics">{t.dashboard.allTopics}</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.strongTopics.length > 0 ? (
                data.strongTopics.slice(0, 5).map((p) => (
                  <TopicProgressBar
                    key={p.topicId}
                    name={p.topic.name}
                    masteryScore={p.masteryScore}
                  />
                ))
              ) : (
                <p className="text-sm text-muted-foreground py-4">
                  {t.dashboard.noStrongTopics}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent attempts */}
        {data.recentAttempts.length > 0 && (
          <Card className="border-0 bg-transparent">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t.dashboard.recentSolutions}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.recentAttempts.slice(0, 5).map((attempt) => (
                  <div
                    key={attempt.id}
                    className="flex items-center justify-between py-2.5 border-b last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                         {contentText(attempt.question?.title, attempt.question?.titleKk, locale) || t.dashboard.taskFallback}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {getTopicName(attempt.question?.topic?.name)}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ml-3 ${
                        attempt.isCorrect
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : attempt.isPartial
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                      }`}
                    >
                      {attempt.isCorrect
                        ? t.dashboard.correct
                        : attempt.isPartial
                        ? t.dashboard.partial
                        : t.dashboard.error}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
