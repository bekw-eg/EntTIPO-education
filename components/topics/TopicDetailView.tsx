"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MathDisplay } from "@/components/ui/MathDisplay";
import { MathText } from "@/components/ui/MathText";
import {
  ArrowLeft,
  BookOpen,
  Zap,
  HelpCircle,
  AlertTriangle,
  Lightbulb,
  CheckCircle,
  Bot,
  Sparkles,
} from "lucide-react";
import { getMasteryBadgeColor, AiAction } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { getLocalizedLesson } from "@/lib/i18n/lessons";
import { contentText } from '@/lib/i18n/content';
import { AiTutorPanel } from "@/components/ai/AiTutorPanel";

interface TopicDetailViewProps {
  topic: any;
  masteryScore: number;
}

export function TopicDetailView({ topic, masteryScore }: TopicDetailViewProps) {
  const { t, locale, getTopicName, getMasteryLabel } = useLanguage();

  const localized = locale === 'kk' && topic.lesson?.contentKk ? topic.lesson.contentKk : getLocalizedLesson(topic.id, locale);
  const lesson = topic.lesson;

  const translatedName = localized?.title || getTopicName(topic.name);
  const description = localized?.description || contentText(topic.description, topic.descriptionKk, locale);
  const whatIsIt = localized?.whatIsIt || (lesson?.whatIsIt && contentText(lesson.whatIsIt, null, locale));
  const whenUsed = localized?.whenUsed || (lesson?.whenUsed && contentText(lesson.whenUsed, null, locale));
  const formulaLatex = localized?.formulaLatex || lesson?.formulaLatex;
  const formula = localized?.formula || lesson?.formula;
  const example = localized?.example || (lesson?.example && contentText(lesson.example, null, locale));
  const commonErrors = localized?.commonErrors || (lesson?.commonErrors && contentText(lesson.commonErrors, null, locale));

  const [isAiOpen, setIsAiOpen] = useState(false);
  const [selectedFormula, setSelectedFormula] = useState<string | undefined>(undefined);

  const openFormulaExplanation = (formulaString?: string) => {
    setSelectedFormula(formulaString || formulaLatex || formula || undefined);
    setIsAiOpen(true);
  };

  return (
    <div className="space-y-6">
      <Header
        title={translatedName}
        subtitle={description}
        actions={
          <Button asChild size="sm">
            <Link href={`/practice?mode=specific_topic&topicId=${topic.id}`}>
              <Zap className="w-4 h-4 mr-2" />
              {t.lesson.trainTopic}
            </Link>
          </Button>
        }
      />

      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        {/* Back Link & Mastery */}
        <div className="flex items-center justify-between">
          <Button asChild variant="ghost" size="sm">
            <Link href="/topics">
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              {t.lesson.allTopics}
            </Link>
          </Button>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t.lesson.yourLevel}</span>
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getMasteryBadgeColor(
                masteryScore
              )}`}
            >
              {masteryScore}% · {getMasteryLabel(masteryScore)}
            </span>
          </div>
        </div>

        {lesson || localized ? (
          <div className="space-y-6">
            {/* 1. Что это такое */}
            {whatIsIt && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-primary" />
                    {t.lesson.whatIsIt}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm sm:text-base leading-relaxed text-foreground/90 whitespace-pre-line">
                    {whatIsIt}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* 2. Когда это используется */}
            {whenUsed && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-amber-500" />
                    {t.lesson.whenUsed}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm sm:text-base leading-relaxed text-foreground/90 whitespace-pre-line">
                    {whenUsed}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* 3. Основная формула */}
            {(formulaLatex || formula) && (
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base flex items-center gap-2 text-primary">
                    <BookOpen className="w-4 h-4" />
                    {t.lesson.keyFormula}
                  </CardTitle>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openFormulaExplanation(formulaLatex || formula || undefined)}
                    className="h-7 text-xs border-primary/40 bg-background/90 text-primary hover:bg-primary/10 font-semibold shadow-2xs"
                  >
                    <Bot className="w-3.5 h-3.5 mr-1 text-primary" />
                    {t.ai.didNotUnderstand}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2">
                  {formulaLatex && (
                    <div className="py-3 px-4 bg-background/80 rounded-xl border text-center overflow-x-auto shadow-xs">
                      <MathDisplay math={formulaLatex} block />
                    </div>
                  )}
                  {formula && (
                    <p className="text-xs text-muted-foreground text-center font-mono">
                      {formula}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 4. Простой пример */}
            {example && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle className="w-4 h-4" />
                    {t.lesson.example}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-4 bg-muted/30 rounded-xl border">
                    <MathText content={example} />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 5. Типичные ошибки */}
            {commonErrors && (
              <Card className="border-rose-500/20 bg-rose-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-rose-600 dark:text-rose-400">
                    <AlertTriangle className="w-4 h-4" />
                    {t.lesson.commonErrors}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
                    {commonErrors}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <Card className="p-8 text-center text-muted-foreground">
            {t.common.loading}
          </Card>
        )}

        {/* 6. Тренировочные задания */}
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">{t.lesson.trainingTasks}</h3>
            <span className="text-xs text-muted-foreground">
              {t.lesson.inDatabase} {topic.questions?.length || 0}
            </span>
          </div>

          <div className="space-y-3">
            {topic.questions?.map((q: any, idx: number) => (
              <Card key={q.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold font-mono bg-muted px-2 py-0.5 rounded">
                        #{idx + 1}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t.topics.difficulty}: {q.difficulty}/5
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t.lesson.stepsCount} {q.steps?.length || 0}
                      </span>
                    </div>

                    <p className="text-sm font-medium">{contentText(q.title, q.titleKk, locale)}</p>

                    {q.latex && (
                      <div className="py-2 px-3 bg-muted/30 rounded-lg text-center overflow-x-auto text-sm border">
                        <MathDisplay math={q.latex} block={false} />
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="pt-4 flex justify-center">
            <Button asChild size="lg" className="px-8 font-semibold shadow-md">
              <Link href={`/practice?mode=specific_topic&topicId=${topic.id}`}>
                <Zap className="w-5 h-5 mr-2" />
                {t.lesson.startTrainingTopic} «{translatedName}»
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <AiTutorPanel
        isOpen={isAiOpen}
        onClose={() => setIsAiOpen(false)}
        topicId={topic.id}
        formulaLatex={selectedFormula}
        formulaName={translatedName}
        initialAction="explain_formula"
      />
    </div>
  );
}
