"use client";
import { Header } from "@/components/layout/Header";
import { LoadError } from "@/components/ui/page-state";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function ErrorPage({ reset }: { reset: () => void }) {
  const { t } = useLanguage();
  return <><Header title={t.common.appName} /><div className="page-content reading-content"><LoadError retry={reset} /></div></>;
}
