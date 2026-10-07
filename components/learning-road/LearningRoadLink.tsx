"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { roadText } from "@/lib/i18n/learning-road";
export function LearningRoadLink({ legacy = false }: { legacy?: boolean }) {
  const { locale } = useLanguage();
  return <Button asChild><Link href={legacy ? "/learning-road?legacy=1" : "/learning-road"}>{roadText[locale].continue}</Link></Button>;
}
