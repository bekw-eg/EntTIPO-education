"use client";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { Locale } from "@/lib/i18n/types";
export const languages: { code: Locale; label: string; short: string }[] = [
  { code: "kk", label: "Қазақша", short: "ҚАЗ" }, { code: "ru", label: "Русский", short: "РУС" }, { code: "en", label: "English", short: "ENG" },
];
export function LanguageSwitcher({ variant = "buttons", className = "" }: { variant?: "buttons" | "compact"; className?: string }) {
  const { locale, setLocale } = useLanguage();
  return <div role="group" aria-label={locale === "kk" ? "Тіл" : locale === "en" ? "Language" : "Язык"}
    className={"flex items-center gap-0.5 " + (variant === "buttons" ? "w-full " : "") + className}>
    {languages.map(lang => <button key={lang.code} type="button" title={lang.label} aria-label={lang.label} aria-pressed={locale === lang.code}
      onClick={() => setLocale(lang.code)} className={"min-h-11 min-w-11 rounded-md px-2 text-xs transition-colors " + (locale === lang.code ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
      {lang.short}
    </button>)}
  </div>;
}
