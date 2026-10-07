"use client";
import { LayoutDashboard, BookOpen, Library, RotateCcw, BarChart3, GraduationCap, Compass, ClipboardCheck, ListChecks } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { roadText } from "@/lib/i18n/learning-road";

export function useNavigation() {
  const { t, locale } = useLanguage();
  return [
    { name: t.nav.home, href: "/", icon: LayoutDashboard },
    { name: roadText[locale].title, href: "/learning-road", icon: Compass },
    { name: t.nav.practice, href: "/practice", icon: BookOpen },
    { name: locale === "kk" ? "Емтихан" : locale === "en" ? "Exam" : "Экзамен", href: "/exam", icon: GraduationCap },
    { name: locale === "en" ? "Diagnostics" : locale === "kk" ? "Диагностика" : "Диагностика навыков", href: "/diagnostics", icon: ClipboardCheck },
    { name: t.nav.topics, href: "/topics", icon: Library },
    { name: t.nav.mistakes, href: "/mistakes", icon: RotateCcw },
    { name: t.nav.statistics, href: "/statistics", icon: BarChart3 },
    { name: locale === "en" ? "Geometry" : "Геометрия", href: "/geometry", icon: Compass },
    { name: locale === "kk" ? "Емтиханды қамту" : locale === "en" ? "Exam coverage" : "Покрытие экзамена", href: "/exam-coverage", icon: ListChecks },
  ];
}
export function isCurrentRoute(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}
