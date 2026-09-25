"use client";

import React from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { Locale } from "@/lib/i18n/types";
import { Globe } from "lucide-react";

interface LanguageSwitcherProps {
  variant?: "buttons" | "compact";
  className?: string;
}

const languages: { code: Locale; label: string; flag: string; short: string }[] = [
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

  return (
    <div className={`flex items-center gap-1.5 p-1 bg-muted/50 rounded-xl border ${className}`}>
      {languages.map((lang) => (
        <button
          key={lang.code}
          type="button"
          onClick={() => setLocale(lang.code)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
            locale === lang.code
              ? "bg-primary text-primary-foreground font-semibold shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <span>{lang.flag}</span>
          <span>{lang.label}</span>
        </button>
      ))}
    </div>
  );
}
