"use client";
import { GraduationCap, History, User } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
export function useNavigation() {
  const { locale } = useLanguage(), kk = locale === "kk";
  return [
    { name: kk ? "Сынақ" : "Пробник", href: "/", icon: GraduationCap },
    { name: kk ? "Менің нәтижелерім" : "Мои результаты", href: "/results", icon: History },
    { name: "Аккаунт", href: "/account", icon: User },
  ];
}
export function isCurrentRoute(pathname: string, href: string) {
  return href === "/" ? pathname === "/" || pathname === "/exam" || pathname.startsWith("/exam/") : pathname === href;
}
