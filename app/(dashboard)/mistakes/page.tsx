"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChoiceMath } from "@/components/practice/ChoiceMath";
import { PageLoading, LoadError } from "@/components/ui/page-state";
import { interfaceText } from "@/lib/i18n/interface";
import { MathDisplay } from "@/components/ui/MathDisplay";
import { MathText } from '@/components/ui/MathText';
import {
  RotateCcw,
  CheckCircle2,
  Filter,
  ArrowRight,
  Bot,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { contentText, answerText } from '@/lib/i18n/content';
import { errorTypeTranslations } from "@/lib/i18n/translations";
import { AiTutorPanel } from "@/components/ai/AiTutorPanel";
import { AiAction } from "@/types";
import { diagnosticText } from "@/lib/i18n/diagnostics";
import { learningText } from "@/lib/i18n/learning";
import { useRouter } from "next/navigation";

export default function MistakesPage() {
  const { t, getTopicName, getErrorLabel, locale } = useLanguage();
  const router = useRouter();
  const copy = learningText[locale === "kk" ? "kk" : "ru"];
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const [mistakes, setMistakes] = useState<any[]>([]);
  const [weakSkills, setWeakSkills] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [selectedErrorType, setSelectedErrorType] = useState<string>("");
  const [reviewFilter, setReviewFilter] = useState<string>("unreviewed");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // AI Panel state
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<any>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | undefined>(undefined);
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | undefined>(undefined);
  const [aiAction, setAiAction] = useState<AiAction>("analyze_error");

  const handleReviewSkillWithAi = (skill: any) => {
    setSelectedTopicId(skill.topicId);
    setSelectedQuestion(null);
    setSelectedAttemptId(undefined);
    setAiAction("explain_topic");
    setAiPanelOpen(true);
  };

  const handleReviewMistakeWithAi = (m: any) => {
    setSelectedQuestion(m.question);
    setSelectedTopicId(m.topicId);
    setSelectedAttemptId(m.attemptId);
    setAiAction("analyze_error");
    setAiPanelOpen(true);
  };

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
    setIsLoading(true); setLoadError(false);
    try {
      const params = new URLSearchParams();
      if (selectedTopic) params.set("topicId", selectedTopic);
      if (selectedErrorType) params.set("errorType", selectedErrorType);
      if (reviewFilter === "unreviewed") params.set("state", "outstanding");
      if (reviewFilter === "reviewed") params.set("state", "confirmed");
      if (reviewFilter === "due") params.set("state", "due");

      const res = await fetch(`/api/mistakes?${params.toString()}`);
      if (!res.ok) throw new Error();
      if (res.ok) {
        const data = await res.json();
        setMistakes(data.mistakes || []);
        if (data.weakSkills) {
          setWeakSkills(data.weakSkills);
        }
      }
    } catch (e) {
      setLoadError(true);
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
          !currentStatus ? copy.viewed : copy.unmarkViewed
        );
        setMistakes((prev) =>
          prev.map((m) =>
            m.id === mistakeId ? { ...m, isReviewed: !currentStatus } : m
          )
        );
      }
    } catch {
      toast.error(copy.error);
    }
  };

  const startCheck = async (mistakeId: string) => {
    setCheckingId(mistakeId);
    try {
      const response = await fetch(`/api/mistakes/${mistakeId}/check`, { method: "POST" });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (data.href) router.push(data.href);
      else setMistakes((prev) => prev.map((m) => m.id === mistakeId ? { ...m, checkUnavailable: true } : m));
    } catch { toast.error(copy.error); } finally { setCheckingId(null); }
  };

  return (
    <div className="min-w-0">
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

      <div className="page-content">
        {/* Мои слабые навыки */}
        {weakSkills.length > 0 && (
          <Card className="border overflow-hidden shadow-xs">
            <div className="p-4 sm:p-5 border-b bg-muted/20 flex items-center justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-sm sm:text-base">
                  {t.ai.myWeakSkills}
                </h3>
              </div>
              <Badge variant="outline" className="text-xs">
                {weakSkills.length}
              </Badge>
            </div>

            <div className="divide-y">
              {weakSkills.slice(0, 5).map((skill, idx) => {
                const errorLabel = getErrorLabel(skill.skillName);
                const displayName =
                  locale === "kk" ? skill.skillNameKk || getErrorLabel(skill.skillName) : errorLabel !== skill.skillName ? errorLabel : skill.skillName;

                return (
                  <div
                    key={skill.skillKey || idx}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/10 transition-colors"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm sm:text-base text-foreground">
                          {displayName}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {getTopicName(skill.topicName)}
                        </Badge>
                        <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full">
                          {skill.count} {t.ai.mistakesCount}
                        </span>
                      </div>

                      <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span>
                          {t.ai.lastMistake}:{" "}
                          <strong className="text-foreground">
                            {contentText(skill.lastQuestionTitle, skill.lastQuestionTitleKk, locale)}
                          </strong>
                        </span>
                        <span>•</span>
                        <span>
                          Mastery:{" "}
                          <strong className="text-primary">
                            {skill.masteryScore === null ? diagnosticText[locale === "kk" ? "kk" : "ru"].insufficient : `${skill.masteryScore}%`}
                          </strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleReviewSkillWithAi(skill)}
                        className="text-xs h-8 border-primary/40 text-primary hover:bg-primary/10 font-semibold"
                      >
                        <Bot className="w-3.5 h-3.5 mr-1.5 text-primary" />
                        {t.ai.reviewWithAi}
                      </Button>

                      <Button asChild size="sm" className="text-xs h-8 font-semibold">
                        <Link
                          href={`/practice?mode=mixed&skillId=${skill.skillKey}`}
                        >
                          {t.ai.repeat}
                          <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Filters */}
        <Card className="border-0 rounded-none border-b bg-transparent pb-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Filter className="w-3.5 h-3.5" />
              <span>{t.mistakes.filtersLabel}</span>
            </div>

            {/* Topic Filter */}
            <select
              aria-label={t.mistakes.allTopicsOption}
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              className="min-w-0 w-full sm:w-auto text-sm p-2 rounded-md border bg-card text-foreground"
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
              aria-label={t.mistakes.allTypesOption}
              value={selectedErrorType}
              onChange={(e) => setSelectedErrorType(e.target.value)}
              className="min-w-0 w-full sm:w-auto text-sm p-2 rounded-md border bg-card text-foreground"
            >
              <option value="">{t.mistakes.allTypesOption}</option>
              {Object.keys(errorTypeTranslations).map((k) => (
                <option key={k} value={k}>
                  {getErrorLabel(k)}
                </option>
              ))}
            </select>

            {/* Review Status Filter */}
            <div className="flex flex-wrap items-center gap-1 text-sm">
              <button
                type="button"
                onClick={() => setReviewFilter("unreviewed")}
                className={`min-h-11 px-3 py-2 rounded-md transition-colors ${
                  reviewFilter === "unreviewed"
                    ? "bg-background font-semibold shadow-xs text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {copy.outstanding}
              </button>
              <button
                type="button"
                onClick={() => setReviewFilter("reviewed")}
                className={`min-h-11 px-3 py-2 rounded-md transition-colors ${
                  reviewFilter === "reviewed"
                    ? "bg-background font-semibold shadow-xs text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {copy.verifiedTab}
              </button>
              <button type="button" onClick={() => setReviewFilter("due")} className={`min-h-11 px-3 py-2 rounded-md text-xs ${reviewFilter === "due" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>{copy.dueTab}</button>
              <button
                type="button"
                onClick={() => setReviewFilter("all")}
                className={`min-h-11 px-3 py-2 rounded-md transition-colors ${
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
          <PageLoading />
        ) : loadError ? <LoadError retry={() => void fetchMistakes()} /> : mistakes.length === 0 ? (
          <Card className="border-0 bg-transparent py-8 space-y-4">

            <div className="space-y-1">
              <h3 className="font-bold text-lg">{selectedTopic || selectedErrorType ? interfaceText[locale].noMatches : reviewFilter === "due" ? interfaceText[locale].noReviews : t.mistakes.noMistakesTitle}</h3>
              <p className="text-sm text-muted-foreground max-w-prose">
                {reviewFilter === "due" ? interfaceText[locale].noReviewsHint : t.mistakes.noMistakesDesc}
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
                    m.confirmedAt ? "bg-muted/10" : ""
                  }`}
                >
                  <CardContent className="p-5 space-y-4">
                    {/* Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {topicName}
                        </Badge>
                        <Badge variant="destructive" className="text-xs">
                          {errorLabel}
                        </Badge>
                        {m.isReviewed && (
                          <Badge variant="secondary" className="text-xs text-muted-foreground">
                            {copy.viewed}
                          </Badge>
                        )}
                        {m.confirmedAt && <Badge className="bg-emerald-600 text-xs">{copy.confirmed}</Badge>}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(m.createdAt)}
                      </span>
                    </div>

                    {/* Question text & formula */}
                    <div className="space-y-2">
                      <h4 className="font-semibold text-base">{contentText(q?.title, q?.titleKk, locale)}</h4>
                      {q?.questionText && (
                        <MathText className="text-sm text-foreground/80" content={contentText(q.questionText, q.questionTextKk, locale).replace(/\[GEOMETRY:[\s\S]*?\]/g, '')} />
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
                        <p className="font-medium text-muted-foreground text-xs">
                          {t.mistakes.yourStepAnswers}
                        </p>
                        <div className="space-y-1.5">
                          {stepAnswers.map((sa: any, sIdx: number) => {
                            const step = q?.steps?.find((s: any) => s.id === sa.stepId);
                            return (
                              <div
                                key={sa.id || sIdx}
                                className="flex flex-wrap items-start justify-between gap-3 text-sm py-2 border-b last:border-0"
                              >
                                <span className="text-muted-foreground">
                                  {step?.prompt ? `${t.session.step} ${sIdx + 1}: ${contentText(step.prompt, step.promptKk, locale)}` : `${t.session.step} ${sIdx + 1}`}
                                </span>
                                <span
                                  className={`min-w-0 max-w-full overflow-x-auto font-medium ${
                                    sa.isCorrect
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-rose-600 dark:text-rose-400"
                                  }`}
                                >
                                  <ChoiceMath text={answerText(sa.answer, step, locale)} />
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
                        <MathText className="leading-relaxed" content={contentText(q.explanation, q.explanationKk, locale)} />
                      </div>
                    )}

                    <div className="space-y-1 text-sm">
                      <p className="text-muted-foreground">{copy.checkHint}</p>
                      {m.skill && <Link className="text-primary underline" href={`/learn/rules/${m.skillId}`}>{locale === "kk" ? m.skill.nameKk : m.skill.nameRu}</Link>}
                      {m.nextReviewDay && <p>{copy.next}: <strong>{m.nextReviewDay}</strong>{m.reviewDue && <span className="ml-2 text-amber-700 dark:text-amber-400">{copy.due}</span>}</p>}
                      {m.confirmationAttempt && <p className="text-xs text-muted-foreground">{copy.checkedTask}: <Link className="text-primary underline" href={`/practice/session/${m.confirmationAttempt.sessionId}`}>{contentText(m.confirmationAttempt.question.title, m.confirmationAttempt.question.titleKk, locale)}</Link> · {formatDate(m.confirmationAttempt.createdAt)}</p>}
                      {!m.skillId && <p className="text-amber-700 dark:text-amber-400">{copy.unmapped}</p>}
                      {m.checkUnavailable && <p role="status" className="text-amber-700 dark:text-amber-400">{copy.noSimilar}</p>}
                    </div>

                    {/* Actions */}
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleReviewed(m.id, m.isReviewed)}
                        className="text-xs"
                      >
                        {m.isReviewed
                          ? copy.unmarkViewed
                          : copy.markViewed}
                      </Button>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleReviewMistakeWithAi(m)}
                          className="text-xs h-8 border-primary/40 text-primary hover:bg-primary/10 font-semibold"
                        >
                          <Bot className="w-3.5 h-3.5 mr-1 text-primary" />
                          {t.ai.reviewWithAi}
                        </Button>

                        {(!m.confirmedAt || m.reviewDue) && <Button size="sm" className="text-xs h-8 font-semibold" disabled={!!checkingId || !m.skillId} onClick={() => startCheck(m.id)}>
                            {m.confirmedAt ? copy.review : copy.verify}
                            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                        </Button>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <AiTutorPanel
        isOpen={aiPanelOpen}
        onClose={() => setAiPanelOpen(false)}
        question={selectedQuestion}
        topicId={selectedTopicId}
        attemptId={selectedAttemptId}
        hasAttempted={true}
        initialAction={aiAction}
      />
    </div>
  );
}
