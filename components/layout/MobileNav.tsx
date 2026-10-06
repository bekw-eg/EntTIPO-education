"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BookOpen, Library, AlertCircle, BarChart3, Compass, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { roadText } from "@/lib/i18n/learning-road";

export function MobileNav() {
  const pathname = usePathname();
  const { t, locale } = useLanguage();

  const navItems = [
    { name: t.nav.home, href: "/", icon: LayoutDashboard },
    { name: roadText[locale].title, href: "/learning-road", icon: Compass },
    { name: t.nav.practice, href: "/practice", icon: BookOpen },
    { name: locale === 'kk' ? 'Емтихан' : locale === 'en' ? 'Exam' : 'Экзамен', href: "/exam", icon: GraduationCap },
    { name: "Диагностика", href: "/diagnostics", icon: AlertCircle },
    { name: t.nav.topics, href: "/topics", icon: Library },
    { name: "3D", href: "/geometry", icon: Compass },
    { name: t.nav.mistakes, href: "/mistakes", icon: AlertCircle },
    { name: t.nav.statistics, href: "/statistics", icon: BarChart3 },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur z-50 mobile-nav-safe">
      <nav className="flex items-center h-16 px-1 overflow-x-auto">
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
                "flex flex-col items-center justify-center flex-1 min-w-14 h-full space-y-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                isActive
                  ? "text-primary font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] text-center">
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
