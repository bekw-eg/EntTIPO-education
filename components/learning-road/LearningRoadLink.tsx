"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { roadText } from "@/lib/i18n/learning-road";
export function LearningRoadLink() {
  const { locale } = useLanguage();
  return <Button asChild><Link href="/learning-road">{roadText[locale].continue}</Link></Button>;
}
