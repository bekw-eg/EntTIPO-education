"use client";
import { Header } from "@/components/layout/Header";
import { MathText } from "@/components/ui/MathText";
import { choiceStem } from "@/lib/choiceDisplay";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Skill } from "@prisma/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { learningText } from "@/lib/i18n/learning";
import { roadText } from "@/lib/i18n/learning-road";

export function LearningRule({ skill, actionId, roadNodeId, completed }: { skill: Skill; actionId?: string; roadNodeId?: string; completed: boolean }) {
  const { locale } = useLanguage(), router = useRouter(), [busy, setBusy] = useState(false);
  const kk = locale === "kk", copy = learningText[kk ? "kk" : "ru"];
  async function markRead() {
    setBusy(true);
    try {
      const response = await fetch(roadNodeId ? "/api/learning-road" : "/api/learning-plan", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(roadNodeId ? { action: "complete_theory", nodeId: roadNodeId } : { action: "complete_rule", actionId }) });
      if (!response.ok) throw new Error(); router.push(roadNodeId ? "/learning-road" : "/");
    } catch { toast.error(copy.error); } finally { setBusy(false); }
  }
  return <><Header title={kk ? skill.nameKk : skill.nameRu} /><div className="page-content reading-content">
    <MathText content={choiceStem(kk ? skill.explanationKk : skill.explanationRu)} />
    <section className="space-y-6"><div className="border-l-2 border-primary pl-5"><MathText content={choiceStem(kk ? skill.ruleKk : skill.ruleRu)} /></div>
      <p className="text-sm text-muted-foreground">{copy.checkHint}</p>
      <div className="flex flex-wrap gap-3">{(actionId || roadNodeId) && !completed && <Button onClick={markRead} disabled={busy}>{roadNodeId ? roadText[locale].read : copy.read}</Button>}
        <Button variant="outline" asChild><Link href={roadNodeId ? "/learning-road" : "/"}>{roadNodeId ? roadText[locale].back : copy.home}</Link></Button>{completed && <span>{copy.done}</span>}</div>
    </section></div></>;
}
