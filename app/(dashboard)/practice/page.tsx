"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Dices, AlertTriangle, Book, RotateCcw, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import Link from "next/link";
import { diagnosticText } from "@/lib/i18n/diagnostics";

interface UnfinishedSession {
  id: string;
  mode: "mixed" | "weak_topics" | "specific_topic" | "review_mistakes";
  completedCount: number;
  totalCount: number;
}

function PracticeSetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, getTopicName, locale } = useLanguage();
  const skillId = searchParams.get("skillId") || undefined;

  const initialMode = searchParams.get("mode") || "mixed";
  const initialTopic = searchParams.get("topicId") || "";

  const [totalCount, setTotalCount] = useState<number>(20);
  const [mode, setMode] = useState<string>(initialMode);
  const [topicId, setTopicId] = useState<string>(initialTopic);
  const [topics, setTopics] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [unfinishedSessions, setUnfinishedSessions] = useState<UnfinishedSession[]>([]);

  useEffect(() => {
    const fetchTopics = async () => {
      try {
        const res = await fetch("/api/topics");
        if (res.ok) {
          const data = await res.json();
          setTopics(data);
        }
      } catch (err) {
        console.error("Failed to fetch topics", err);
      }
    };
    fetchTopics();
    fetch("/api/sessions?status=active", { cache: "no-store" })
      .then(async (res) => { if (res.ok) setUnfinishedSessions(await res.json()); })
      .catch((error) => console.error("Could not load unfinished sessions", error));
  }, []);

  const counts = [10, 20, 30, 40, 50];
  const modes = [
    {
      id: "mixed",
      title: t.practice.modes.mixed.title,
      desc: t.practice.modes.mixed.desc,
      icon: Dices,
    },
    {
      id: "weak_topics",
      title: t.practice.modes.weak_topics.title,
      desc: t.practice.modes.weak_topics.desc,
      icon: AlertTriangle,
    },
    {
      id: "specific_topic",
      title: t.practice.modes.specific_topic.title,
      desc: t.practice.modes.specific_topic.desc,
      icon: Book,
    },
    {
      id: "review_mistakes",
      title: t.practice.modes.review_mistakes.title,
      desc: t.practice.modes.review_mistakes.desc,
      icon: RotateCcw,
    },
  ];

  const handleSubmit = async () => {
    if (mode === "specific_topic" && !topicId) {
      toast.error(t.practice.selectTopicToast);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          totalCount: Number(totalCount),
          topicId: mode === "specific_topic" ? topicId : undefined,
          skillId,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error creating session");
      }

      const data = await res.json();
      router.push(`/practice/session/${data.id}`);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Error");
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-8 animate-slide-in">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          {t.practice.setupTitle}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">
          {t.practice.setupSubtitle}
        </p>
      </div>

      <Link href="/diagnostics" className="block rounded-xl border p-4 hover:bg-muted/50">
        <span className="font-semibold">{diagnosticText[locale === "kk" ? "kk" : "ru"].title}</span>
        <p className="mt-1 text-sm text-muted-foreground">{diagnosticText[locale === "kk" ? "kk" : "ru"].intro}</p>
      </Link>

      {unfinishedSessions.length > 0 && <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t.practice.unfinished}</h2>
        {unfinishedSessions.map((session) => <Card key={session.id} className="p-4 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">{t.practice.modes[session.mode]?.title}</p>
            <p className="text-xs text-muted-foreground">{t.summary.solved}: {session.completedCount} / {session.totalCount}</p>
          </div>
          <Button variant="outline" onClick={() => router.push(`/practice/session/${session.id}`)}>
            {t.practice.resume}<ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Card>)}
      </section>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Count Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{t.practice.tasksCount}</CardTitle>
            <CardDescription>{t.practice.tasksCountDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {counts.map((count) => (
                <Button
                  key={count}
                  type="button"
                  variant={totalCount === count ? "default" : "outline"}
                  onClick={() => setTotalCount(count)}
                  className="flex-1 min-w-[60px]"
                >
                  {count}
                </Button>
              ))}
            </div>

            <div className="space-y-1.5 pt-2">
              <Label htmlFor="customCount" className="text-xs text-muted-foreground">
                {t.practice.customVariant}
              </Label>
              <Input
                id="customCount"
                type="number"
                min="1"
                max="100"
                value={totalCount}
                onChange={(e) =>
                  setTotalCount(
                    Math.min(100, Math.max(1, parseInt(e.target.value) || 10))
                  )
                }
                className="max-w-[140px]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Mode Information & Topic selection if specific */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{t.practice.modeDetails}</CardTitle>
            <CardDescription>
              {mode === "specific_topic"
                ? t.practice.deepPractice
                : t.practice.adaptiveSelection}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mode === "specific_topic" ? (
              <div className="space-y-2">
                <Label htmlFor="topicSelect">{t.practice.topicLabel}</Label>
                <select
                  id="topicSelect"
                  value={topicId}
                  onChange={(e) => setTopicId(e.target.value)}
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  <option value="">{t.practice.chooseTopicPlaceholder}</option>
                  {topics.map((item) => (
                    <option key={item.id} value={item.id}>
                      {getTopicName(item.name)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="p-3 bg-muted/40 rounded-lg text-sm text-muted-foreground leading-relaxed">
                {t.practice.adaptiveHint}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mode Selection Cards */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">{t.practice.trainingMode}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {modes.map((m) => {
            const Icon = m.icon;
            const isSelected = mode === m.id;
            return (
              <div
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-4 ${
                  isSelected
                    ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary"
                    : "border-border hover:border-primary/40 hover:bg-muted/30"
                }`}
              >
                <div
                  className={`p-2.5 rounded-xl shrink-0 ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-sm sm:text-base">{m.title}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-normal">
                    {m.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Start Button */}
      <div className="pt-4 flex justify-end">
        <Button
          onClick={handleSubmit}
          disabled={isLoading}
          size="lg"
          className="w-full sm:w-auto px-8 font-semibold text-base shadow-md"
        >
          {isLoading ? (
            t.practice.preparingTasks
          ) : (
            <>
              {t.practice.startPracticeBtn} ({totalCount})
              <ArrowRight className="w-5 h-5 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default function PracticeSetupPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">...</div>}>
      <PracticeSetupContent />
    </Suspense>
  );
}
