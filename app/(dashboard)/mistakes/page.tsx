"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MathDisplay } from "@/components/ui/MathDisplay";
import {
  RotateCcw,
  CheckCircle2,
  Filter,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { errorTypeTranslations } from "@/lib/i18n/translations";

export default function MistakesPage() {
  const { t, getTopicName, getErrorLabel } = useLanguage();

  const [mistakes, setMistakes] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [selectedErrorType, setSelectedErrorType] = useState<string>("");
  const [reviewFilter, setReviewFilter] = useState<string>("unreviewed");
  const [isLoading, setIsLoading] = useState(true);

  const fetchTopics = async () => {
    try {
      const res = await fetch("/api/topics");
      if (res.ok) {
        const data = await res.json();
        setTopics(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMistakes = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedTopic) params.set("topicId", selectedTopic);
      if (selectedErrorType) params.set("errorType", selectedErrorType);
      if (reviewFilter === "unreviewed") params.set("isReviewed", "false");
      if (reviewFilter === "reviewed") params.set("isReviewed", "true");

      const res = await fetch(`/api/mistakes?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setMistakes(data.mistakes || []);
      }
    } catch (e) {
      console.error(e);
      toast.error(t.mistakes.loading);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTopics();
  }, []);

  useEffect(() => {
    fetchMistakes();
  }, [selectedTopic, selectedErrorType, reviewFilter]);

  const toggleReviewed = async (mistakeId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/mistakes/${mistakeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isReviewed: !currentStatus }),
      });

      if (res.ok) {
        toast.success(
          !currentStatus ? t.mistakes.reviewedBadge : t.mistakes.returnToUnreviewed
        );
        setMistakes((prev) =>
          prev.map((m) =>
            m.id === mistakeId ? { ...m, isReviewed: !currentStatus } : m
          )
        );
      }
    } catch {
      toast.error("Error updating mistake");
    }
  };

  return (
    <div className="space-y-6">
      <Header
        title={t.mistakes.title}
        subtitle={t.mistakes.subtitle}
        actions={
          <Button asChild size="sm">
            <Link href="/practice?mode=review_mistakes">
              <RotateCcw className="w-4 h-4 mr-2" />
              {t.mistakes.trainMistakesBtn}
            </Link>
          </Button>
        }
      />

      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        {/* Filters */}
        <Card className="p-4 bg-card/60 backdrop-blur-sm">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Filter className="w-3.5 h-3.5" />
              <span>{t.mistakes.filtersLabel}</span>
            </div>

            {/* Topic Filter */}
            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              className="text-xs p-2 rounded-lg border bg-background text-foreground"
            >
              <option value="">{t.mistakes.allTopicsOption}</option>
              {topics.map((item) => (
                <option key={item.id} value={item.id}>
                  {getTopicName(item.name)}
                </option>
              ))}
            </select>

            {/* Error Type Filter */}
            <select
              value={selectedErrorType}
              onChange={(e) => setSelectedErrorType(e.target.value)}
              className="text-xs p-2 rounded-lg border bg-background text-foreground"
            >
              <option value="">{t.mistakes.allTypesOption}</option>
              {Object.keys(errorTypeTranslations).map((k) => (
                <option key={k} value={k}>
                  {getErrorLabel(k)}
                </option>
              ))}
            </select>

            {/* Review Status Filter */}
            <div className="flex items-center rounded-lg border bg-muted/30 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setReviewFilter("unreviewed")}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  reviewFilter === "unreviewed"
                    ? "bg-background font-semibold shadow-xs text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.mistakes.unreviewedTab}
              </button>
              <button
                type="button"
                onClick={() => setReviewFilter("reviewed")}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  reviewFilter === "reviewed"
                    ? "bg-background font-semibold shadow-xs text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.mistakes.reviewedTab}
              </button>
              <button
                type="button"
                onClick={() => setReviewFilter("all")}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  reviewFilter === "all"
                    ? "bg-background font-semibold shadow-xs text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.mistakes.allTab}
              </button>
            </div>
          </div>
        </Card>

        {/* List of Mistakes */}
        {isLoading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            {t.mistakes.loading}
          </div>
        ) : mistakes.length === 0 ? (
          <Card className="p-12 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto opacity-80" />
            <div className="space-y-1">
              <h3 className="font-bold text-lg">{t.mistakes.noMistakesTitle}</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                {t.mistakes.noMistakesDesc}
              </p>
            </div>
            <Button asChild size="sm">
              <Link href="/practice">{t.mistakes.toPracticeBtn}</Link>
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {mistakes.map((m) => {
              const q = m.question;
              const stepAnswers = m.attempt?.stepAnswers || [];
              const errorLabel = getErrorLabel(m.errorType);
              const topicName = q?.topic?.name ? getTopicName(q.topic.name) : t.common.math;

              return (
                <Card
                  key={m.id}
                  className={`overflow-hidden border transition-all ${
                    m.isReviewed ? "opacity-75 bg-muted/10" : ""
                  }`}
                >
                  <CardContent className="p-5 space-y-4">
                    {/* Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {topicName}
                        </Badge>
                        <Badge variant="destructive" className="text-xs">
                          {errorLabel}
                        </Badge>
                        {m.isReviewed && (
                          <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-600">
                            {t.mistakes.reviewedBadge}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(m.createdAt)}
                      </span>
                    </div>

                    {/* Question text & formula */}
                    <div className="space-y-2">
                      <h4 className="font-semibold text-base">{q?.title}</h4>
                      {q?.questionText && (
                        <p className="text-sm text-foreground/80 whitespace-pre-line">
                          {q.questionText}
                        </p>
                      )}
                      {q?.latex && (
                        <div className="p-3 bg-muted/30 rounded-lg text-center overflow-x-auto text-sm border my-2">
                          <MathDisplay math={q.latex} block={false} />
                        </div>
                      )}
                    </div>

                    {/* Step details from attempt if available */}
                    {stepAnswers.length > 0 && (
                      <div className="p-3 bg-muted/20 rounded-lg border space-y-2 text-xs">
                        <p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
                          {t.mistakes.yourStepAnswers}
                        </p>
                        <div className="space-y-1.5">
                          {stepAnswers.map((sa: any, sIdx: number) => {
                            const step = q?.steps?.find((s: any) => s.id === sa.stepId);
                            return (
                              <div
                                key={sa.id || sIdx}
                                className="flex items-center justify-between text-xs py-1 border-b last:border-0"
                              >
                                <span className="text-muted-foreground">
                                  {step?.prompt ? `${t.session.step} ${sIdx + 1}: ${step.prompt}` : `${t.session.step} ${sIdx + 1}`}
                                </span>
                                <span
                                  className={`font-mono font-medium ${
                                    sa.isCorrect
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-rose-600 dark:text-rose-400"
                                  }`}
                                >
                                  {sa.answer} {sa.isCorrect ? "✔" : "✘"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Explanation */}
                    {q?.explanation && (
                      <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 text-xs text-foreground/90 space-y-1">
                        <span className="font-semibold text-primary">
                          {t.mistakes.correctSolution}
                        </span>
                        <p className="whitespace-pre-line leading-relaxed">
                          {q.explanation}
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="pt-2 flex items-center justify-between gap-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleReviewed(m.id, m.isReviewed)}
                        className="text-xs"
                      >
                        {m.isReviewed
                          ? t.mistakes.returnToUnreviewed
                          : t.mistakes.markAsReviewed}
                      </Button>

                      <Button asChild size="sm" className="text-xs font-semibold">
                        <Link
                          href={`/practice?mode=specific_topic&topicId=${q?.topicId}`}
                        >
                          {t.mistakes.repeatSimilar}
                          <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
