"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SynaqLogo } from "@/components/brand/SynaqLogo";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { interfaceText } from "@/lib/i18n/interface";
import { useAccount } from "@/components/providers/AccountProvider";
import { useNavigation, isCurrentRoute } from "./useNavigation";

export function Sidebar() {
  const pathname = usePathname(), navItems = useNavigation();
  const { t, locale } = useLanguage(), { user } = useAccount();
  const copy = interfaceText[locale];
  if (pathname === "/login") return null;
  return <>
    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-card focus:p-3">{copy.skip}</a>
    <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r bg-card md:flex xl:w-60">
      <Link href="/" className="flex items-center gap-3 px-6 py-8">
        <SynaqLogo markClassName="w-9" wordmarkClassName="text-xl" subtitle={t.common.math} />
      </Link>
      <nav aria-label={copy.navigation} className="flex-1 space-y-1 overflow-y-auto px-3 pb-6">
        {navItems.map((item, index) => <Link key={item.href} href={item.href} aria-current={isCurrentRoute(pathname, item.href) ? "page" : undefined}
          className={cn("flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors", index === 4 && "!mt-5",
            isCurrentRoute(pathname, item.href) ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
          <item.icon aria-hidden="true" className="h-4 w-4 shrink-0" /><span>{item.name}</span>
        </Link>)}
      </nav>
      <div className="border-t px-6 py-5"><p className="truncate text-sm font-medium">{user?.name || t.common.user}</p><p className="mt-1 text-xs text-muted-foreground">{locale === "kk" ? "ТжКБ ҰБТ · B057" : "ЕНТ ТиПО · B057"}</p></div>
    </aside>
  </>;
}
