"use client";

import React from "react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Zap, CheckCircle2 } from "lucide-react";
import { getMasteryBadgeColor } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { getLocalizedLesson } from "@/lib/i18n/lessons";
import { contentText } from '@/lib/i18n/content';

interface TopicItem {
  id: string;
  name: string;
  description: string;
  descriptionKk?: string | null;
  difficulty: number;
  order: number;
  masteryScore: number;
  questionsCount: number;
}

interface TopicsViewProps {
  topics: TopicItem[];
}

export function TopicsView({ topics }: TopicsViewProps) {
  const { t, locale, getTopicName, getMasteryLabel } = useLanguage();

  const masteredCount = topics.filter((item) => item.masteryScore >= 85).length;
  const inProgressCount = topics.filter(
    (item) => item.masteryScore >= 40 && item.masteryScore < 85
  ).length;
  const weakCount = topics.filter((item) => item.masteryScore < 40).length;

  return (
    <div className="space-y-6">
      <Header
        title={t.topics.catalogTitle}
        subtitle={t.topics.catalogSubtitle}
      />

      <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
        <p className="text-sm text-muted-foreground">
          {locale === "kk" ? "Тақырыптар тізімі емтиханды толық қамтуды растамайды." : locale === "en" ? "The topic list does not confirm complete exam coverage." : "Список тем не подтверждает полное покрытие экзамена."}{" "}
          <Link href="/exam-coverage" className="underline">{locale === "kk" ? "Қамтуды тексеру" : locale === "en" ? "Check coverage" : "Проверить покрытие"}</Link>
        </p>
        {/* Progress summary banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-emerald-500/5 border-emerald-500/20">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">
                  {t.topics.mastered}
                </p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {masteredCount} / {topics.length}
                </p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-emerald-500 opacity-80" />
            </CardContent>
          </Card>

          <Card className="bg-blue-500/5 border-blue-500/20">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">
                  {t.topics.inProgress}
                </p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {inProgressCount} / {topics.length}
                </p>
              </div>
              <BookOpen className="w-8 h-8 text-blue-500 opacity-80" />
            </CardContent>
          </Card>

          <Card className="bg-rose-500/5 border-rose-500/20">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">
                  {t.topics.needsAttention}
                </p>
                <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                  {weakCount} / {topics.length}
                </p>
              </div>
              <Zap className="w-8 h-8 text-rose-500 opacity-80" />
            </CardContent>
          </Card>
        </div>

        {/* Topics grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {topics.map((topic, index) => {
            const barColor =
              topic.masteryScore < 40
                ? "bg-rose-500"
                : topic.masteryScore < 70
                ? "bg-amber-500"
                : topic.masteryScore < 85
                ? "bg-blue-500"
                : "bg-emerald-500";

            const localized = getLocalizedLesson(topic.id, locale);
            const translatedName = localized?.title || getTopicName(topic.name);
            const translatedDesc = localized?.description || contentText(topic.description, topic.descriptionKk, locale);

            return (
              <Card
                key={topic.id}
                className="overflow-hidden border transition-all duration-200 hover:shadow-md hover:border-primary/40 flex flex-col justify-between"
              >
                <CardContent className="p-5 space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-mono font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        #{index + 1}
                      </span>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getMasteryBadgeColor(
                          topic.masteryScore
                        )}`}
                      >
                        {topic.masteryScore}% · {getMasteryLabel(topic.masteryScore)}
                      </span>
                    </div>

                    <h3 className="font-bold text-base leading-snug line-clamp-1">
                      {translatedName}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {translatedDesc}
                    </p>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                        style={{ width: `${topic.masteryScore}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>
                        {t.topics.difficulty}: {topic.difficulty}/5
                      </span>
                      <span>
                        {topic.questionsCount} {t.topics.tasksCount}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t flex items-center gap-2">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                    >
                      <Link href={`/topics/${topic.id}`}>
                        <BookOpen className="w-3.5 h-3.5 mr-1.5" />
                        {t.topics.theory}
                      </Link>
                    </Button>
                    <Button asChild size="sm" className="flex-1 text-xs">
                      <Link
                        href={`/practice?mode=specific_topic&topicId=${topic.id}`}
                      >
                        <Zap className="w-3.5 h-3.5 mr-1.5" />
                        {t.topics.practice}
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
