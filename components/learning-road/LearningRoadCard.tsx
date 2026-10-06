"use client";
import Link from "next/link";
import { Route, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { roadText } from "@/lib/i18n/learning-road";
import { useLearningRoad } from "./useLearningRoad";

export function LearningRoadCard() {
  const { locale } = useLanguage(), copy = roadText[locale];
  const { road, error, reload } = useLearningRoad();
  const focus = road?.nodes.find(node => node.status === "CURRENT");
  return <Card className="border-primary/20"><CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
    <Route aria-hidden="true" className="h-8 w-8 shrink-0 text-primary" />
    <div className="flex-1 min-w-0 space-y-2"><h2 className="font-semibold">{copy.title}</h2>
      {error ? <Button variant="ghost" onClick={() => { void reload(); }}>{copy.reload}</Button> : !road ? <p role="status" className="text-sm text-muted-foreground">{copy.loading}</p> : <>
        <p className="text-sm text-muted-foreground">{focus ? `${copy.focus}: ${locale === "kk" ? focus.nameKk : focus.nameRu}` : road.finished ? copy.finished : copy.empty}</p>
        {!!road.nodes.length && <><p className="text-xs">{road.completedCount} / {road.nodes.length} · {copy.progress}</p>
          <Progress aria-label={copy.progress} value={100 * road.completedCount / road.nodes.length} className="h-1.5 max-w-sm" /></>}
      </>}
    </div>
    <Button asChild className="shrink-0"><Link href="/learning-road">{copy.continue}<ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" /></Link></Button>
  </CardContent></Card>;
}
