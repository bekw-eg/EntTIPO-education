"use client";

import React from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { Locale } from "@/lib/i18n/types";
import { Globe } from "lucide-react";

interface LanguageSwitcherProps {
  variant?: "buttons" | "compact";
  className?: string;
}

export const languages: { code: Locale; label: string; flag: string; short: string }[] = [
  { code: "kk", label: "Қазақша", flag: "🇰🇿", short: "ҚАЗ" },
  { code: "ru", label: "Русский", flag: "🇷🇺", short: "РУС" },
  { code: "en", label: "English", flag: "🇬🇧", short: "ENG" },
];

export function LanguageSwitcher({
  variant = "buttons",
  className = "",
}: LanguageSwitcherProps) {
  const { locale, setLocale } = useLanguage();

  if (variant === "compact") {
    return (
      <div className={`flex items-center gap-1 bg-muted/60 p-1 rounded-lg border text-xs ${className}`}>
        <Globe className="w-3.5 h-3.5 text-muted-foreground ml-1 mr-0.5" />
        {languages.map((lang) => (
          <button
            key={lang.code}
            type="button"
            onClick={() => setLocale(lang.code)}
            title={lang.label}
            className={`px-2 py-1 rounded text-xs font-semibold transition-all ${
              locale === lang.code
                ? "bg-background text-primary shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {lang.short}
          </button>
        ))}
      </div>
    );
  }

  const currentLang = languages.find((l) => l.code === locale);

  return (
    <div className={`space-y-1.5 w-full ${className}`}>
      <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground">
        <span>
          {locale === "kk" ? "Тіл" : locale === "en" ? "Language" : "Язык"}
        </span>
        <span className="font-semibold text-foreground/80">
          {currentLang?.label}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1 p-1 bg-muted/50 rounded-xl border w-full">
        {languages.map((lang) => {
          const isActive = locale === lang.code;
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => setLocale(lang.code)}
              title={lang.label}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/80"
              }`}
            >
              <span className="text-sm leading-none shrink-0">{lang.flag}</span>
              <span>{lang.short}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
