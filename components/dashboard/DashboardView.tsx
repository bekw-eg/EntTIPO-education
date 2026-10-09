"use client";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/LanguageContext";
export function DashboardView() {
  const { locale } = useLanguage();
  return <><Header title={locale === "kk" ? "Математика сынағы" : "Пробный тест по математике"} />
    <div className="page-content reading-content"><Button asChild><Link href="/exam">{locale === "kk" ? "Сынақты ашу" : "Открыть пробник"}</Link></Button></div></>;
}
