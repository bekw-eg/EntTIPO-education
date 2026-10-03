"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Library,
  AlertCircle,
  BarChart3,
  GraduationCap,
  Sun,
  Moon,
  Compass,
} from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();

  const navItems = [
    { name: t.nav.home, href: "/", icon: LayoutDashboard },
    { name: t.nav.practice, href: "/practice", icon: BookOpen },
    { name: t.nav.topics, href: "/topics", icon: Library },
    { name: "Геометрия", href: "/geometry", icon: Compass },
    { name: t.nav.mistakes, href: "/mistakes", icon: AlertCircle },
    { name: t.nav.statistics, href: "/statistics", icon: BarChart3 },
  ];

  return (
    <div className="hidden md:flex flex-col w-64 border-r bg-card h-screen sticky top-0 justify-between">
      <div>
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <span className="font-bold text-lg leading-tight block">{t.common.appName}</span>
            <span className="text-xs text-muted-foreground">{t.common.math}</span>
          </div>
        </div>

        <nav className="px-4 space-y-1.5">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname?.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t space-y-3">
        {/* Language selector in sidebar */}
        <LanguageSwitcher variant="buttons" className="w-full" />

        {/* Theme toggle */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="w-full justify-start gap-2 h-9 text-xs"
        >
          <Sun className="h-4 w-4 dark:hidden text-amber-500" />
          <Moon className="hidden h-4 w-4 dark:block text-blue-400" />
          <span>{t.theme.switchTheme}</span>
        </Button>

        {/* User badge */}
        <div className="flex items-center gap-3 pt-1 px-1">
          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-xs font-bold">
            U
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold leading-none truncate">
              {t.common.user}
            </span>
            <span className="text-[11px] text-muted-foreground mt-0.5">
              {t.common.ent2025}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
