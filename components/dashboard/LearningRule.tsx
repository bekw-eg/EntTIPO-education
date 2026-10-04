"use client";
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Skill } from "@prisma/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { learningText } from "@/lib/i18n/learning";

export function LearningRule({ skill, actionId, completed }: { skill: Skill; actionId?: string; completed: boolean }) {
  const { locale } = useLanguage(), router = useRouter(), [busy, setBusy] = useState(false);
  const kk = locale === "kk", copy = learningText[kk ? "kk" : "ru"];
  async function markRead() {
    setBusy(true);
    try {
      const response = await fetch("/api/learning-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "complete_rule", actionId }) });
      if (!response.ok) throw new Error(); router.push("/");
    } catch { toast.error(copy.error); } finally { setBusy(false); }
  }
  return <div className="mx-auto max-w-3xl space-y-6 p-6"><div className="md:hidden flex justify-end"><LanguageSwitcher variant="compact" /></div><Card>
    <CardHeader><CardTitle>{kk ? skill.nameKk : skill.nameRu}</CardTitle><p className="text-muted-foreground">{kk ? skill.explanationKk : skill.explanationRu}</p></CardHeader>
    <CardContent className="space-y-6"><p className="rounded-xl border bg-primary/5 p-5 text-lg leading-relaxed">{kk ? skill.ruleKk : skill.ruleRu}</p>
      <p className="text-sm text-muted-foreground">{copy.checkHint}</p>
      <div className="flex flex-wrap gap-3">{actionId && !completed && <Button onClick={markRead} disabled={busy}>{copy.read}</Button>}
        <Button variant="outline" asChild><Link href="/">{copy.home}</Link></Button>{completed && <span>{copy.done}</span>}</div>
    </CardContent></Card></div>;
}
