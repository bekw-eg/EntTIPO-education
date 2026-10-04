"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Locale, TranslationSchema } from "./types";
import { translations, topicNamesTranslations, errorTypeTranslations } from "./translations";
import { translateContent } from './content';

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslationSchema;
  getTopicName: (russianName: string) => string;
  getErrorLabel: (errorType: string) => string;
  getMasteryLabel: (score: number) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ru");

  useEffect(() => {
    // Read persisted locale from localStorage
    let saved: Locale | null = null;
    try { saved = localStorage.getItem("ent_tipo_locale") as Locale | null; } catch { /* Use the default when browser storage is disabled. */ }
    if (saved && (saved === "ru" || saved === "kk" || saved === "en")) {
      setLocaleState(saved);
      document.documentElement.lang = saved;
      document.cookie = `ent_tipo_locale=${saved}; Path=/; SameSite=Lax; Max-Age=31536000`;
    }
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    try { localStorage.setItem("ent_tipo_locale", newLocale); } catch { /* Locale still changes when storage is disabled. */ }
    document.documentElement.lang = newLocale;
    document.cookie = `ent_tipo_locale=${newLocale}; Path=/; SameSite=Lax; Max-Age=31536000`;
  };

  const t = translations[locale] || translations.ru;

  const getTopicName = (russianName: string): string => {
    if (!russianName) return "";
    const entry = topicNamesTranslations[russianName];
    if (entry) {
      return entry[locale] || russianName;
    }
    return locale === 'kk' ? translateContent(russianName) ?? 'Тақырып' : russianName;
  };

  const getErrorLabel = (errorType: string): string => {
    if (!errorType) return "";
    const entry = errorTypeTranslations[errorType];
    if (entry) {
      return entry[locale] || errorType;
    }
    return errorType;
  };

  const getMasteryLabel = (score: number): string => {
    if (score < 40) return t.masteryLevels.weak;
    if (score < 70) return t.masteryLevels.developing;
    if (score < 85) return t.masteryLevels.good;
    return t.masteryLevels.mastered;
  };

  return (
    <LanguageContext.Provider
      value={{
        locale,
        setLocale,
        t,
        getTopicName,
        getErrorLabel,
        getMasteryLabel,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
