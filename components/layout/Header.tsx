"use client";
import { useAccount } from "@/components/providers/AccountProvider";
import Link from "next/link";
import { SynaqMark } from "@/components/brand/SynaqLogo";
import { ReactNode } from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { UserNav } from "./UserNav";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function Header({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  const { resolvedTheme, setTheme } = useTheme();
  const { locale } = useLanguage();
  const { user } = useAccount();
  return <header className="mx-auto w-full max-w-[var(--page-width)] px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8">
    <div className="mb-6 flex min-h-11 items-center justify-end gap-2">
      <Link href="/" aria-label="Synaq" className="mr-auto rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary md:hidden">
        <SynaqMark decorative className="w-8" />
      </Link>
      <LanguageSwitcher variant="compact" />{user && <UserNav />}
      <Button variant="ghost" size="icon" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        aria-label={locale === "kk" ? "Түсті режимді ауыстыру" : locale === "ru" ? "Переключить тему оформления" : "Toggle theme"}>
        <Sun className="h-4 w-4 dark:hidden" /><Moon className="hidden h-4 w-4 dark:block" />
      </Button>
    </div>
    <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-5">
      <div className="min-w-0 flex-1 basis-64"><h1 className="page-title">{title}</h1>
        {subtitle && <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex max-w-full flex-wrap gap-2">{actions}</div>}
    </div>
  </header>;
}
