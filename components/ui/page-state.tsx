"use client";

import { useLanguage } from "@/lib/i18n/LanguageContext";
import { interfaceText } from "@/lib/i18n/interface";
import { Button } from "./button";
import { Skeleton } from "./skeleton";

export function PageLoading() {
  const { t } = useLanguage();
  return <div role="status" className="space-y-5 py-6">
    <span className="sr-only">{t.common.loading}</span>
    <Skeleton className="h-6 w-2/3 max-w-sm" />
    <Skeleton className="h-24 w-full" />
    <Skeleton className="h-24 w-full" />
  </div>;
}

export function LoadError({ retry }: { retry: () => void }) {
  const { locale } = useLanguage(), copy = interfaceText[locale];
  return <div role="alert" className="space-y-4 rounded-lg border border-destructive/25 p-4 sm:p-6">
    <p className="max-w-prose text-sm leading-relaxed">{copy.loadError}</p>
    <Button variant="outline" onClick={retry}>{copy.retry}</Button>
  </div>;
}
