"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { interfaceText } from "@/lib/i18n/interface";

export default function NotFound() {
  const { locale, t } = useLanguage(), copy = interfaceText[locale];
  return <div className="page-content reading-content space-y-4 py-16">
    <p className="text-sm text-muted-foreground">404</p><h1 className="page-title">{copy.notFound}</h1>
    <p className="text-muted-foreground">{copy.notFoundHint}</p>
    <Button asChild><Link href="/">{t.nav.home}</Link></Button>
  </div>;
}
