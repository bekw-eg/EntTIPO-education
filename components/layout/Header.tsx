"use client";

import { ReactNode } from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { UserNav } from "./UserNav";
import { useLanguage } from '@/lib/i18n/LanguageContext';

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const { locale } = useLanguage();

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex flex-col min-w-0 pr-4">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight truncate">{title}</h1>
          {subtitle && (
            <p className="text-xs sm:text-sm text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <LanguageSwitcher variant="compact" />
          <UserNav />
          {actions}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="h-9 w-9"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">{locale === 'kk' ? 'Түсті режимді ауыстыру' : locale === 'ru' ? 'Переключить тему оформления' : 'Toggle theme'}</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
