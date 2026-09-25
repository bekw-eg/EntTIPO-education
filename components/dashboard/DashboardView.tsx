"use client";

import React from "react";
import Link from "next/link";
import {
  BookOpen,
  Target,
  BarChart3,
  AlertCircle,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/layout/Header";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { TopicProgressBar } from "@/components/dashboard/TopicProgressBar";
import { StreakCard } from "@/components/dashboard/StreakCard";
import { DailyGoalCard } from "@/components/dashboard/DailyGoalCard";
import { DashboardStats } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface DashboardViewProps {
  initialData: DashboardStats;
}

export function DashboardView({ initialData: data }: DashboardViewProps) {
  const { t, locale, getTopicName } = useLanguage();

  const getGreeting = () => {
    const hour = new Date().getHours();
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
    });
    return dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
  };

  return (
    <div className="space-y-6">
      <Header
        title={getGreeting()}
        subtitle={getFormattedDate()}
        actions={
          <Button asChild size="sm" className="hidden sm:flex shadow-sm">
            <Link href="/practice">
              <Zap className="w-4 h-4 mr-2" />
              {t.dashboard.quickStart}
            </Link>
          </Button>
        }
      />

      <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title={t.dashboard.todayTasks}
            value={`${data.todaySolved}`}
            subtitle={t.dashboard.tasksSolved}
            icon={<CheckCircle2 className="w-5 h-5" />}
            iconBg="bg-emerald-500/10 text-emerald-500"
          />
          <StatsCard
            title={t.dashboard.accuracy}
            value={`${data.overallAccuracy}%`}
            subtitle={t.dashboard.correctAnswers}
            icon={<Target className="w-5 h-5" />}
            iconBg="bg-blue-500/10 text-blue-500"
          />
          <StatsCard
            title={t.dashboard.streak}
            value={data.streak}
            subtitle={
              data.streak > 0 ? t.dashboard.streakDays : t.dashboard.startStreak
            }
            icon={<Zap className="w-5 h-5" />}
            iconBg="bg-orange-500/10 text-orange-500"
          />
          <StatsCard
            title={t.dashboard.totalSolved}
            value={data.totalSolved}
            subtitle={t.dashboard.tasksInDb}
            icon={<BarChart3 className="w-5 h-5" />}
            iconBg="bg-purple-500/10 text-purple-500"
          />
        </div>

        {/* Goal + Streak */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DailyGoalCard completed={data.todaySolved} target={data.todayTarget} />
          <StreakCard streak={data.streak} />
        </div>

        {/* CTA Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Button asChild size="lg" className="col-span-2 sm:col-span-1 font-semibold shadow-md">
            <Link href="/practice">
              <BookOpen className="w-4 h-4 mr-2" />
              {t.dashboard.startPractice}
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="border-border">
            <Link href="/practice?mode=weak_topics">{t.dashboard.weakTopics}</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="border-border">
            <Link href="/topics">{t.dashboard.chooseTopic}</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="border-border">
            <Link href="/mistakes">
              <AlertCircle className="w-4 h-4 mr-2 text-rose-500" />
              {t.dashboard.mistakes}
            </Link>
          </Button>
        </div>

        {/* Topics section: Weak & Strong */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Weak topics */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="text-rose-500 font-bold">↓</span> {t.dashboard.weakTopics}
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
                <p className="text-sm text-muted-foreground text-center py-6">
                  {t.dashboard.noWeakTopics}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Strong topics */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="text-emerald-500 font-bold">↑</span> {t.dashboard.strongTopics}
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
                <p className="text-sm text-muted-foreground text-center py-6">
                  {t.dashboard.noStrongTopics}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent attempts */}
        {data.recentAttempts.length > 0 && (
          <Card>
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
                        {attempt.question?.title ?? t.dashboard.taskFallback}
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
